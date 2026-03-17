/**
 * Migration Cloud Functions
 *
 * migrateWinesToProducts: One-time callable that copies wine entities from
 * tenants/{tenantId}/wines/ into tenants/{tenantId}/products/, merging
 * duplicates by normalizedName. Idempotent — skips wines already migrated
 * (matched via wineEntityId on the product doc).
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { buildNormalizedName } = require("./lib/pipeline/productNormalize");

const db = admin.firestore();

async function verifyTenantMembership(uid, tenantId) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
  }
  return userSnap.data();
}

exports.migrateWinesToProducts = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId } = data;
    if (!tenantId) {
      throw new functions.https.HttpsError("invalid-argument", "tenantId required");
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    const tenantRef = db.collection("tenants").doc(tenantId);

    // Load all wines
    const winesSnap = await tenantRef.collection("wines").get();
    if (winesSnap.empty) {
      return { migrated: 0, merged: 0, skipped: 0, total: 0 };
    }

    // Load existing products and index by normalizedName + wineEntityId
    const productsSnap = await tenantRef.collection("products").get();
    const productsByNormalized = new Map(); // normalizedName → product doc
    const migratedWineIds = new Set();      // wineEntityIds already in products/

    for (const doc of productsSnap.docs) {
      const d = doc.data();
      if (d.normalizedName) {
        productsByNormalized.set(d.normalizedName, { id: doc.id, ...d });
      }
      if (d.wineEntityId) {
        migratedWineIds.add(d.wineEntityId);
      }
    }

    let migrated = 0;
    let merged = 0;
    let skipped = 0;
    const total = winesSnap.size;

    for (const wineDoc of winesSnap.docs) {
      const wine = wineDoc.data();
      const wineId = wineDoc.id;

      // Idempotent: skip if already migrated
      if (migratedWineIds.has(wineId)) {
        skipped++;
        continue;
      }

      const normalizedName = wine.normalizedName || buildNormalizedName(wine.name || "");
      const existingProduct = normalizedName ? productsByNormalized.get(normalizedName) : null;

      if (existingProduct) {
        // Merge into existing product
        const mergedSourceNames = [
          ...new Set([
            ...(existingProduct.sourceNames || []),
            ...(wine.sourceNames || []),
          ]),
        ];
        const mergedImportIds = [
          ...new Set([
            ...(existingProduct.importIds || []),
            ...(wine.importIds || []),
          ]),
        ];

        await tenantRef.collection("products").doc(existingProduct.id).update({
          sourceNames: mergedSourceNames,
          importIds: mergedImportIds,
          wineEntityId: wineId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        merged++;
      } else {
        // Create new product from wine
        const sanitizedName = (wine.name || "").trim().slice(0, 150);
        const productRef = tenantRef.collection("products").doc();
        const productData = {
          name: wine.name || "",
          normalizedName: normalizedName,
          displayName: wine.displayName || sanitizedName,
          sourceNames: wine.sourceNames || [],
          producer: wine.producer || "",
          vintage: wine.vintage || null,
          type: "nv",
          status: "active",
          source: "migration",
          wineEntityId: wineId,
          metadata: wine.metadata || {},
          importIds: wine.importIds || [],
          firstSeen: wine.firstSeen || admin.firestore.FieldValue.serverTimestamp(),
          lastSeen: wine.lastSeen || admin.firestore.FieldValue.serverTimestamp(),
          createdAt: wine.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        };

        await productRef.set(productData);

        // Track in local map so subsequent wines with same normalizedName merge
        productsByNormalized.set(normalizedName, { id: productRef.id, ...productData });
        migrated++;
      }

      // Track so re-runs skip this wine
      migratedWineIds.add(wineId);
    }

    console.log(
      `[migrateWinesToProducts] ${tenantId}: ${migrated} migrated, ${merged} merged, ${skipped} skipped, ${total} total`
    );

    return { migrated, merged, skipped, total };
  });
