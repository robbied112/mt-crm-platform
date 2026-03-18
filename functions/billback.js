/**
 * Billback Cloud Functions — PDF extraction + wine entity dedup
 *
 * parseBillbackPDF: Accepts base64 PDF, calls Claude Vision, returns structured line items
 * extractWines: Auto-extracts wine entities from billback imports with AI dedup
 */
const { onCall, HttpsError, admin, db, anthropicApiKey, verifyTenantMembership } = require("./helpers");
const { deduplicateEntities } = require("./entityDedup");
const { buildNormalizedName } = require("./lib/pipeline/productNormalize");

// ─── Wine Name Helpers ──────────────────────────────────────────

function sanitizeWineName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/[<>{}[\]\\|`~!@#$%^&*()+=;:'"]/g, "")
    .trim()
    .slice(0, 150);
}

function normalizeWineName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\b(750\s*ml|1\.5\s*l|375\s*ml|3\s*l|magnum|jeroboam|half\s*bottle)\b/gi, "") // remove bottle sizes
    .replace(/[<>{}[\]\\|`~!@#$%^&*()+=;:'"]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractVintage(name) {
  const match = String(name).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

// ─── parseBillbackPDF ───────────────────────────────────────────

exports.parseBillbackPDF = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, pdfBase64 } = req.data;
    if (!tenantId || !pdfBase64) {
      throw new HttpsError("invalid-argument", "tenantId and pdfBase64 required");
    }

    // Validate PDF size (base64 is ~33% larger than binary)
    const estimatedBytes = pdfBase64.length * 0.75;
    if (estimatedBytes > 10 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "PDF is too large. Maximum size is 10MB.");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY not configured");
    }

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    let extracted = null;
    let retries = 0;

    while (retries < 2) {
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: `You are a billback/trade spend extraction expert for the wine and spirits industry.

Extract ALL line items from this billback PDF. For each line item, extract:
- wine: The wine/product name (include vintage if present)
- producer: The producer/winery/supplier name
- distributor: The distributor name (often in the header)
- amount: The dollar amount as a number (positive = charge, negative = credit)
- qty: Number of cases as a number (if available, else 0)
- date: The date (ISO format YYYY-MM-DD)
- type: The billback type (e.g., "depletion allowance", "marketing", "sampling", "placement fee", "price reduction", "other")
- invoiceNo: Invoice or reference number (often in header)

Return ONLY valid JSON: { "lineItems": [...], "metadata": { "distributor": "...", "invoiceNo": "...", "date": "...", "totalAmount": 0 } }`,
              },
            ],
          }],
        });

        const text = response.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("AI could not extract billback data from this PDF");
        }
        extracted = JSON.parse(jsonMatch[0]);
        break;
      } catch (err) {
        retries++;
        if (retries >= 2) {
          console.error(`[parseBillbackPDF] Claude failed for ${tenantId}:`, err.message);
          throw new HttpsError("internal", `PDF extraction failed: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Validate and normalize line items
    const lineItems = (extracted.lineItems || [])
      .filter((item) => item && item.wine)
      .map((item) => ({
        wine: String(item.wine || "").trim(),
        producer: String(item.producer || "").trim(),
        distributor: String(item.distributor || extracted.metadata?.distributor || "").trim(),
        amount: parseFloat(item.amount) || 0,
        qty: parseFloat(item.qty) || 0,
        date: String(item.date || "").trim(),
        type: String(item.type || "other").trim(),
        invoiceNo: String(item.invoiceNo || extracted.metadata?.invoiceNo || "").trim(),
      }));

    console.log(`[parseBillbackPDF] ${tenantId}: extracted ${lineItems.length} line items`);

    return {
      lineItems,
      metadata: extracted.metadata || {},
    };
  });

// ─── extractWines ───────────────────────────────────────────────

exports.extractWines = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, importId } = req.data;
    if (!tenantId || !importId) {
      throw new HttpsError("invalid-argument", "tenantId and importId required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    // Load import rows
    const importRef = db.collection("tenants").doc(tenantId).collection("imports").doc(importId);
    const importSnap = await importRef.get();
    if (!importSnap.exists) {
      throw new HttpsError("not-found", "Import not found");
    }

    const rowsSnap = await importRef.collection("rows").get();
    const rows = rowsSnap.docs
      .map((d) => ({ idx: d.data().idx, items: d.data().items }))
      .sort((a, b) => a.idx - b.idx)
      .flatMap((c) => c.items);

    // Extract unique wine names
    const rawNames = new Set();
    const wineMetadata = {}; // wine name → { producers, distributors, types }
    for (const row of rows) {
      const wine = (row.wine || "").trim();
      if (!wine) continue;
      rawNames.add(wine);

      if (!wineMetadata[wine]) {
        wineMetadata[wine] = { producers: [], distributors: [], types: [] };
      }
      if (row.producer) wineMetadata[wine].producers.push(row.producer);
      if (row.dist) wineMetadata[wine].distributors.push(row.dist);
      if (row.type) wineMetadata[wine].types.push(row.type);
    }

    if (rawNames.size === 0) {
      return { status: "skipped", reason: "no_wines", created: 0, linked: 0, pending: 0 };
    }

    // Load existing products for dedup
    const productsSnap = await db.collection("tenants").doc(tenantId).collection("products").get();
    const existingProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Deduplicate using shared helper
    const { linked, unmatched, pendingMatches } = await deduplicateEntities({
      rawNames,
      existingEntities: existingProducts,
      normalizeFn: buildNormalizedName,
      sanitizeFn: sanitizeWineName,
      aiPromptPreamble: `You are a wine deduplication expert.
Match each NEW wine name to the most similar EXISTING wine. Consider:
- Vintage matters: "2018 Margaux" ≠ "2019 Margaux"
- Abbreviations: "Ch." = "Chateau", "Dom." = "Domaine"
- Accent variations: "Côtes" = "Cotes"
- Bottle size suffixes should be ignored
- Producer names may be included in wine name`,
      anthropicApiKey: anthropicApiKey.value(),
      entityType: "product",
      tenantId,
      importId,
    });

    // Write pending matches
    for (const match of pendingMatches) {
      await db.collection("tenants").doc(tenantId)
        .collection("pendingWineMatches").add({
          newName: match.newName,
          suggestedMatch: match.suggestedMatch,
          confidence: match.confidence,
          importId,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // Create new product entities for unmatched
    let created = 0;
    for (const name of unmatched) {
      const sanitized = sanitizeWineName(name);
      if (!sanitized) continue;

      const meta = wineMetadata[name] || {};
      const producerCounts = {};
      for (const p of (meta.producers || [])) {
        producerCounts[p] = (producerCounts[p] || 0) + 1;
      }
      const producer = Object.entries(producerCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      const productRef = db.collection("tenants").doc(tenantId).collection("products").doc();
      await productRef.set({
        name: sanitized,
        normalizedName: buildNormalizedName(name),
        displayName: sanitized,
        sourceNames: [name],
        producer,
        vintage: extractVintage(name),
        type: "nv",
        status: "active",
        source: "billback",
        metadata: {
          distributors: [...new Set(meta.distributors || [])],
          types: [...new Set(meta.types || [])],
        },
        importIds: [importId],
        firstSeen: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created++;
    }

    // Update linked products with import reference
    for (const { entityId } of linked) {
      await db.collection("tenants").doc(tenantId)
        .collection("products").doc(entityId)
        .update({
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          importIds: admin.firestore.FieldValue.arrayUnion(importId),
        }).catch(() => {});
    }

    console.log(`[extractWines] ${tenantId}/${importId}: ${created} products created, ${linked.length} linked, ${pendingMatches.length} pending`);
    return { status: "success", created, linked: linked.length, pending: pendingMatches.length };
  });
