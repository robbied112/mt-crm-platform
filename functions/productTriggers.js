/**
 * Product Hierarchy Triggers — maintain denormalized counters.
 *
 * Counters are updated server-side via Firestore triggers so that
 * reps (who can write skus/ but not producers/ or masterProducts/)
 * don't need cross-collection write permissions.
 *
 * Counters maintained:
 *   producers.skuCount          — total SKUs under this producer
 *   producers.masterProductCount — total master products under this producer
 *   masterProducts.skuCount     — total SKUs under this master product
 */
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { admin, db } = require("./helpers");

// ─── SKU counters ────────────────────────────────────────────────

exports.onSkuCreated = onDocumentCreated(
  "tenants/{tenantId}/skus/{skuId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { tenantId } = event.params;
    const batch = db.batch();

    if (data.masterProductId) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("masterProducts").doc(data.masterProductId),
        { skuCount: admin.firestore.FieldValue.increment(1) }
      );
    }
    if (data.producerId) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("producers").doc(data.producerId),
        { skuCount: admin.firestore.FieldValue.increment(1) }
      );
    }

    await batch.commit();
  }
);

exports.onSkuDeleted = onDocumentDeleted(
  "tenants/{tenantId}/skus/{skuId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { tenantId } = event.params;
    const batch = db.batch();

    if (data.masterProductId) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("masterProducts").doc(data.masterProductId),
        { skuCount: admin.firestore.FieldValue.increment(-1) }
      );
    }
    if (data.producerId) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("producers").doc(data.producerId),
        { skuCount: admin.firestore.FieldValue.increment(-1) }
      );
    }

    await batch.commit();
  }
);

// ─── Master Product counters ─────────────────────────────────────

exports.onMasterProductCreated = onDocumentCreated(
  "tenants/{tenantId}/masterProducts/{productId}",
  async (event) => {
    const data = event.data?.data();
    if (!data?.producerId) return;

    const { tenantId } = event.params;
    await db.collection("tenants").doc(tenantId)
      .collection("producers").doc(data.producerId)
      .update({ masterProductCount: admin.firestore.FieldValue.increment(1) });
  }
);

exports.onMasterProductDeleted = onDocumentDeleted(
  "tenants/{tenantId}/masterProducts/{productId}",
  async (event) => {
    const data = event.data?.data();
    if (!data?.producerId) return;

    const { tenantId } = event.params;
    await db.collection("tenants").doc(tenantId)
      .collection("producers").doc(data.producerId)
      .update({ masterProductCount: admin.firestore.FieldValue.increment(-1) });
  }
);
