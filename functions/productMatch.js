/**
 * Product Matching Cloud Function — AI fuzzy matching for import products.
 *
 * Called after a client-side exact match pass finds unmatched product names.
 * Uses the shared deduplicateEntities helper (same pattern as extractWines
 * in billback.js) to run AI fuzzy matching against the tenant's product
 * catalog, then updates matched product docs and returns results.
 */
const { functions, admin, db, anthropicApiKey, verifyTenantMembership } = require("./helpers");
const { deduplicateEntities } = require("./entityDedup");
const { buildNormalizedName, sanitizeProductName } = require("./lib/pipeline/productNormalize");

// ─── matchProductsFromImport ────────────────────────────────────

exports.matchProductsFromImport = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, importId, unmatchedNames } = data;
    if (!tenantId || !importId || !Array.isArray(unmatchedNames) || unmatchedNames.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "tenantId, importId, and unmatchedNames[] required"
      );
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    // Load existing products
    const productsSnap = await db
      .collection("tenants").doc(tenantId)
      .collection("products").get();

    const existingProducts = productsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "",
      sourceNames: d.data().sourceNames || [],
    }));

    // Build raw names set
    const rawNames = new Set(unmatchedNames.filter((n) => typeof n === "string" && n.trim()));

    if (rawNames.size === 0) {
      return { matched: [], unmatched: [], pending: [] };
    }

    // Run AI deduplication
    const { linked, unmatched, pendingMatches } = await deduplicateEntities({
      rawNames,
      existingEntities: existingProducts,
      normalizeFn: buildNormalizedName,
      sanitizeFn: (name) => sanitizeProductName(name),
      aiPromptPreamble: `You are a wine and spirits product matching expert.
Match each NEW product name to the most similar EXISTING product. Consider:
- Vintage matters: "2018 Margaux" ≠ "2019 Margaux"
- Abbreviations: "Ch." = "Chateau", "Dom." = "Domaine", "Cht." = "Chateau"
- Accent variations: "Côtes" = "Cotes", "Château" = "Chateau"
- Bottle size suffixes (750ml, 1.5L) should be ignored for matching
- Producer names may be embedded in the product name
- SKU codes and internal reference numbers are NOT product names`,
      anthropicApiKey: anthropicApiKey.value(),
      entityType: "product",
      tenantId,
      importId,
    });

    // Update matched product docs — append rawName to sourceNames
    const matched = [];
    for (const { rawName, entityId } of linked) {
      try {
        await db
          .collection("tenants").doc(tenantId)
          .collection("products").doc(entityId)
          .update({
            sourceNames: admin.firestore.FieldValue.arrayUnion(rawName),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        matched.push({ name: rawName, productId: entityId });
      } catch (err) {
        console.error(`[matchProductsFromImport] Failed to update product ${entityId}:`, err.message);
        matched.push({ name: rawName, productId: entityId });
      }
    }

    // Write pending matches for review
    const pending = [];
    for (const match of pendingMatches) {
      try {
        await db
          .collection("tenants").doc(tenantId)
          .collection("pendingMatches").add({
            newName: match.newName,
            suggestedMatch: match.suggestedMatch,
            confidence: match.confidence,
            entityType: "product",
            importId,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        pending.push({
          name: match.newName,
          suggestedMatch: match.suggestedMatch,
          confidence: match.confidence,
        });
      } catch (err) {
        console.error(`[matchProductsFromImport] Failed to write pending match:`, err.message);
      }
    }

    // Update import doc with match metadata
    try {
      const importRef = db
        .collection("tenants").doc(tenantId)
        .collection("imports").doc(importId);
      await importRef.update({
        matchedProducts: matched.map((m) => m.name),
        unmatchedProducts: unmatched,
        productMatchRun: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(`[matchProductsFromImport] Failed to update import ${importId}:`, err.message);
    }

    console.log(
      `[matchProductsFromImport] ${tenantId}/${importId}: ${matched.length} matched, ${unmatched.length} unmatched, ${pending.length} pending`
    );

    return { matched, unmatched, pending };
  });
