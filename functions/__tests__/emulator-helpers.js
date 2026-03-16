/**
 * Firebase Emulator test helpers.
 *
 * Provides setup/teardown for integration tests using the Firebase
 * Local Emulator Suite (Firestore + Functions).
 *
 * REQUIREMENTS:
 *   - Java runtime (for Firestore emulator)
 *   - Firebase CLI: npm install -g firebase-tools
 *   - Start emulator: firebase emulators:start --only firestore --project demo-test
 *
 * USAGE:
 *   import { getTestDb, clearFirestore } from "./emulator-helpers.js";
 *   const db = getTestDb();
 *   beforeEach(() => clearFirestore());
 */

const admin = require("firebase-admin");
const { CHUNK_SIZE } = require("../lib/pipeline/index");

const PROJECT_ID = "demo-test";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;

let app;

/**
 * Initialize firebase-admin connected to the Firestore emulator.
 * Safe to call multiple times — returns cached instance.
 */
function getTestDb() {
  if (!app) {
    process.env.FIRESTORE_EMULATOR_HOST = `${FIRESTORE_HOST}:${FIRESTORE_PORT}`;
    app = admin.initializeApp({ projectId: PROJECT_ID }, "test-app");
  }
  return admin.firestore(app);
}

/**
 * Clear all Firestore data in the emulator.
 * Call in beforeEach() for test isolation.
 */
async function clearFirestore() {
  const http = require("http");
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: FIRESTORE_HOST,
        port: FIRESTORE_PORT,
        path: `/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
        method: "DELETE",
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", resolve);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Seed a tenant with config and test data.
 */
async function seedTenant(db, tenantId, config = {}) {
  await db.collection("tenants").doc(tenantId).set({
    name: `Test Tenant ${tenantId}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("tenants").doc(tenantId)
    .collection("config").doc("main").set({
      userRole: "winery",
      useNormalizedModel: true,
      ...config,
    });

  return tenantId;
}

/**
 * Seed a user profile linked to a tenant.
 */
async function seedUser(db, uid, tenantId, role = "admin") {
  await db.collection("users").doc(uid).set({
    email: `${uid}@test.com`,
    tenantId,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Seed an import with normalized rows.
 */
async function seedImport(db, tenantId, importId, meta, rows) {
  const importRef = db.collection("tenants").doc(tenantId)
    .collection("imports").doc(importId);

  await importRef.set({
    ...meta,
    rowCount: rows.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Chunk rows (500 per doc)
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunkIdx = Math.floor(i / CHUNK_SIZE);
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await importRef.collection("rows").doc(String(chunkIdx)).set({
      idx: chunkIdx,
      items: chunk,
    });
  }
}

module.exports = {
  getTestDb,
  clearFirestore,
  seedTenant,
  seedUser,
  seedImport,
  PROJECT_ID,
};
