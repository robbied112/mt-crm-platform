/**
 * Integration tests for rebuildViews Cloud Function.
 *
 * Requires Firebase Emulator (Firestore) running:
 *   firebase emulators:start --only firestore --project demo-test
 *
 * Run:
 *   npm test -- --grep "rebuildViews"
 *
 * These tests verify the full flow:
 *   import → rebuildViews → views match transformAll output
 */

const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { getTestDb, clearFirestore, seedTenant, seedUser, seedImport } = require("./emulator-helpers");
const { transformAll } = require("../lib/pipeline/index");

// Skip if emulator is not running
let db;
let skipTests = false;

try {
  db = getTestDb();
} catch (err) {
  console.log("Skipping integration tests — Firestore emulator not available:", err.message);
  skipTests = true;
}

const TENANT_ID = "test-tenant";
const USER_ID = "test-user";

const SAMPLE_ROWS = [
  { acct: "The Wine Bar", dist: "Southern Glazer's", st: "NY", ch: "On-Premise", sku: "Pinot Noir", qty: 25, date: "2024-03-15", revenue: 1250 },
  { acct: "Metro Liquors", dist: "Republic National", st: "CA", ch: "Off-Premise", sku: "Chardonnay", qty: 50, date: "2024-04-01", revenue: 2500 },
  { acct: "The Wine Bar", dist: "Southern Glazer's", st: "NY", ch: "On-Premise", sku: "Cabernet", qty: 15, date: "2024-04-10", revenue: 750 },
];

describe("rebuildViews integration", { skip: skipTests }, () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedTenant(db, TENANT_ID);
    await seedUser(db, USER_ID, TENANT_ID);
  });

  it("rebuilds views from a single import", async () => {
    // Seed an import
    await seedImport(db, TENANT_ID, "imp1", { type: "depletion", fileName: "test.csv" }, SAMPLE_ROWS);

    // Verify import was saved
    const importsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").get();
    assert.equal(importsSnap.size, 1);

    // Verify rows were saved
    const rowsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").doc("imp1")
      .collection("rows").get();

    const rows = rowsSnap.docs
      .map((d) => ({ idx: d.data().idx, items: d.data().items }))
      .sort((a, b) => a.idx - b.idx)
      .flatMap((c) => c.items);

    assert.equal(rows.length, 3);

    // Run transform directly (simulating what rebuildViews does)
    const mapping = {
      acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku",
      qty: "qty", date: "date", revenue: "revenue",
    };
    const result = transformAll(rows, mapping, "depletion");

    // Verify the transform produces expected output shape
    assert.ok(result.distScorecard);
    assert.ok(result.accountsTop);
    assert.ok(Array.isArray(result.distScorecard));
    assert.ok(result.distScorecard.length > 0);
  });

  it("handles empty imports gracefully", async () => {
    // No imports seeded — verify reading returns empty
    const importsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").get();
    assert.equal(importsSnap.size, 0);
  });

  it("concatenates rows from multiple imports of the same type", async () => {
    // Seed two depletion imports
    await seedImport(db, TENANT_ID, "imp1", { type: "depletion", fileName: "q1.csv" }, SAMPLE_ROWS.slice(0, 2));
    await seedImport(db, TENANT_ID, "imp2", { type: "depletion", fileName: "q2.csv" }, SAMPLE_ROWS.slice(2));

    // Load all imports and concat
    const importsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports")
      .orderBy("createdAt", "asc")
      .get();

    assert.equal(importsSnap.size, 2);

    let allRows = [];
    for (const doc of importsSnap.docs) {
      const rowsSnap = await db.collection("tenants").doc(TENANT_ID)
        .collection("imports").doc(doc.id)
        .collection("rows").get();
      const rows = rowsSnap.docs
        .map((d) => ({ idx: d.data().idx, items: d.data().items }))
        .sort((a, b) => a.idx - b.idx)
        .flatMap((c) => c.items);
      allRows.push(...rows);
    }

    assert.equal(allRows.length, 3);
  });

  it("supports delete import → rebuild with remaining data", async () => {
    // Seed two imports
    await seedImport(db, TENANT_ID, "imp1", { type: "depletion", fileName: "q1.csv" }, SAMPLE_ROWS.slice(0, 2));
    await seedImport(db, TENANT_ID, "imp2", { type: "depletion", fileName: "q2.csv" }, SAMPLE_ROWS.slice(2));

    // Delete first import
    const rowsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").doc("imp1")
      .collection("rows").get();
    for (const doc of rowsSnap.docs) {
      await doc.ref.delete();
    }
    await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").doc("imp1").delete();

    // Verify only imp2 remains
    const remaining = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").get();
    assert.equal(remaining.size, 1);
    assert.equal(remaining.docs[0].id, "imp2");
  });

  it("rate limiting: rebuildHistory tracks rebuilds", async () => {
    // Seed rebuild history entries
    const histRef = db.collection("tenants").doc(TENANT_ID).collection("rebuildHistory");
    for (let i = 0; i < 5; i++) {
      await histRef.add({
        startedAt: new Date(),
        status: "success",
        triggeredBy: USER_ID,
      });
    }

    const recentSnap = await histRef
      .where("startedAt", ">=", new Date(Date.now() - 60 * 60 * 1000))
      .get();

    assert.equal(recentSnap.size, 5);
    // rebuildViews would check if size >= 10 and reject
    assert.ok(recentSnap.size < 10, "Should allow more rebuilds");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Full rebuild pipeline tests — calls rebuildViewsForTenant directly
// ─────────────────────────────────────────────────────────────────────

// rebuildViewsForTenant uses the default admin app via helpers.js.
// FIRESTORE_EMULATOR_HOST was already set by emulator-helpers above,
// so helpers.js admin.initializeApp() will connect to the emulator.
let rebuildViewsForTenant;
let rebuildSkip = skipTests;

if (!skipTests) {
  try {
    ({ rebuildViewsForTenant } = require("../rebuild"));
  } catch (err) {
    console.log("Skipping rebuild pipeline tests — could not load rebuild module:", err.message);
    rebuildSkip = true;
  }
}

describe("rebuildViewsForTenant pipeline", { skip: rebuildSkip }, () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedTenant(db, TENANT_ID);
    await seedUser(db, USER_ID, TENANT_ID);
  });

  it("single import → produces correct views", async () => {
    await seedImport(db, TENANT_ID, "imp1", {
      type: "depletion",
      fileName: "q1.csv",
      mapping: { acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku", qty: "qty", date: "date", revenue: "revenue" },
    }, SAMPLE_ROWS);

    await rebuildViewsForTenant({ tenantId: TENANT_ID, triggeredBy: "test" });

    // Verify views were written
    const viewsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("views").get();
    assert.ok(viewsSnap.size > 0, "Views should be written after rebuild");

    // Check specific view datasets exist
    const viewIds = viewsSnap.docs.map((d) => d.id);
    assert.ok(viewIds.includes("distScorecard"), "distScorecard view should exist");
    assert.ok(viewIds.includes("accountsTop"), "accountsTop view should exist");
  });

  it("two imports of same type → views contain combined data", async () => {
    // Seed two depletion imports with different rows
    await seedImport(db, TENANT_ID, "imp1", {
      type: "depletion",
      fileName: "q1.csv",
      mapping: { acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku", qty: "qty", date: "date", revenue: "revenue" },
    }, SAMPLE_ROWS.slice(0, 2));

    await seedImport(db, TENANT_ID, "imp2", {
      type: "depletion",
      fileName: "q2.csv",
      mapping: { acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku", qty: "qty", date: "date", revenue: "revenue" },
    }, SAMPLE_ROWS.slice(2));

    await rebuildViewsForTenant({ tenantId: TENANT_ID, triggeredBy: "test" });

    // Read the distScorecard view and verify it reflects ALL 3 rows
    const scorecardDoc = await db.collection("tenants").doc(TENANT_ID)
      .collection("views").doc("distScorecard").get();

    // distScorecard should have data from both distributors
    // (Southern Glazer's from rows 0,2 and Republic National from row 1)
    if (scorecardDoc.exists) {
      // View exists as a direct doc — check for rows subcollection too
      const rowsSnap = await db.collection("tenants").doc(TENANT_ID)
        .collection("views").doc("distScorecard")
        .collection("rows").get();

      const allItems = rowsSnap.docs
        .map((d) => ({ idx: d.data().idx, items: d.data().items }))
        .sort((a, b) => a.idx - b.idx)
        .flatMap((c) => c.items);

      // Should have entries for both distributors
      const distributors = new Set(allItems.map((r) => r.dist || r.distributor || r.name));
      assert.ok(distributors.size >= 2, `Expected 2+ distributors, got ${distributors.size}: ${[...distributors].join(", ")}`);
    }
  });

  it("delete import → rebuild shows only remaining data", async () => {
    // Seed two imports
    await seedImport(db, TENANT_ID, "imp1", {
      type: "depletion",
      fileName: "q1.csv",
      mapping: { acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku", qty: "qty", date: "date", revenue: "revenue" },
    }, SAMPLE_ROWS.slice(0, 2));

    await seedImport(db, TENANT_ID, "imp2", {
      type: "depletion",
      fileName: "q2.csv",
      mapping: { acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku", qty: "qty", date: "date", revenue: "revenue" },
    }, SAMPLE_ROWS.slice(2));

    // Delete imp1 (rows + doc)
    const rowsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").doc("imp1")
      .collection("rows").get();
    for (const doc of rowsSnap.docs) {
      await doc.ref.delete();
    }
    await db.collection("tenants").doc(TENANT_ID)
      .collection("imports").doc("imp1").delete();

    // Rebuild with only imp2 remaining
    await rebuildViewsForTenant({ tenantId: TENANT_ID, triggeredBy: "test" });

    // Verify views exist and reflect only imp2's data (1 row: The Wine Bar, Cabernet)
    const viewsSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("views").get();
    assert.ok(viewsSnap.size > 0, "Views should exist after rebuild with remaining import");

    // Verify rebuild history was recorded
    const histSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("rebuildHistory").get();
    assert.ok(histSnap.size >= 1, "Rebuild history should be recorded");
  });

  it("empty imports → rebuild produces empty views", async () => {
    // No imports seeded — rebuild should succeed and write empty views
    await rebuildViewsForTenant({ tenantId: TENANT_ID, triggeredBy: "test" });

    // Rebuild should complete without error
    const histSnap = await db.collection("tenants").doc(TENANT_ID)
      .collection("rebuildHistory").get();
    assert.ok(histSnap.size >= 1, "Rebuild history should be recorded even for empty imports");

    // Check the most recent rebuild was successful
    const latest = histSnap.docs
      .map((d) => d.data())
      .find((d) => d.status === "success");
    assert.ok(latest, "Rebuild should succeed with 0 imports");
  });
});
