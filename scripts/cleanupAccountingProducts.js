/**
 * One-time cleanup: delete QuickBooks accounting items that were
 * incorrectly auto-created as products in the Portfolio.
 *
 * Usage:
 *   node scripts/cleanupAccountingProducts.js <tenantId> [--dry-run]
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or default Firebase credentials.
 */

import admin from "firebase-admin";

// Same patterns used in transformData.js _isAccountingItem
const ACCOUNTING_PATTERNS = [
  "tax item", "sales tax", "shipping", "discount", "adjustment",
  "refund", "fee", "surcharge", "service charge", "finance charge",
  "crv", "deposit", "redemption", "collection", "credit memo",
  "payment", "write-off", "write off", "bad debt", "rounding",
  "freight", "handling", "delivery charge", "convenience fee",
  "processing fee", "restocking", "sales item",
];

function isAccountingItem(name) {
  const lower = (name || "").toLowerCase();
  return ACCOUNTING_PATTERNS.some(p => lower.includes(p));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tenantId = args.find(a => !a.startsWith("--"));

  if (!tenantId) {
    console.error("Usage: node scripts/cleanupAccountingProducts.js <tenantId> [--dry-run]");
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  const productsRef = db.collection(`tenants/${tenantId}/products`);
  const snapshot = await productsRef.get();

  console.log(`Found ${snapshot.size} total products for tenant ${tenantId}`);

  const toDelete = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name || data.displayName || "";
    if (isAccountingItem(name)) {
      toDelete.push({ id: doc.id, name });
    }
  }

  if (toDelete.length === 0) {
    console.log("No accounting items found. Nothing to clean up.");
    return;
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Will delete ${toDelete.length} accounting items:\n`);
  for (const item of toDelete) {
    console.log(`  - ${item.name} (${item.id})`);
  }

  if (dryRun) {
    console.log("\nDry run complete. Re-run without --dry-run to delete.");
    return;
  }

  // Delete in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.delete(productsRef.doc(item.id));
    }
    await batch.commit();
    console.log(`Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} items)`);
  }

  console.log(`\nDone. Deleted ${toDelete.length} accounting items from portfolio.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
