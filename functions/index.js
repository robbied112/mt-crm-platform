const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();
const db = admin.firestore();

// -------------------------------------------------------------------
// Stripe Webhook Handler  (v1 Cloud Function with Secret Manager)
// -------------------------------------------------------------------
// Listens for Stripe events and updates tenant subscription status
// in Firestore so the client app can read it.
//
// SETUP (one-time):
// 1. Set your Stripe secrets via Secret Manager:
//      firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
//      firebase functions:secrets:set STRIPE_SECRET_KEY
//
// 2. In the Stripe Dashboard > Developers > Webhooks, create an
//    endpoint pointing to:
//      https://us-central1-mt-crm-platform.cloudfunctions.net/stripeWebhook
//    and subscribe to these events:
//      - checkout.session.completed
//      - customer.subscription.updated
//      - customer.subscription.deleted
//      - invoice.payment_succeeded
//      - invoice.payment_failed
//
// 3. Deploy:
//      firebase deploy --only functions
// -------------------------------------------------------------------

const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

exports.stripeWebhook = functions
  .runWith({ secrets: [stripeWebhookSecret, stripeSecretKey] })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const webhookSecret = stripeWebhookSecret.value();
    const secretKey = stripeSecretKey.value();

    // Guard: require both secrets to be configured
    if (!webhookSecret || !secretKey) {
      console.error("Stripe secrets not configured. Set STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY.");
      res.status(500).send("Webhook not configured");
      return;
    }

    // Guard: require stripe-signature header
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.error("Missing stripe-signature header");
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    // Verify webhook signature
    let event;
    const stripe = require("stripe")(secretKey);
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    const eventType = event.type;
    console.log("Stripe event received:", eventType);

    try {
      switch (eventType) {
        // A customer completed checkout (new subscription)
        case "checkout.session.completed": {
          const session = event.data.object;
          const tenantId = session.client_reference_id;
          const customerEmail = session.customer_details?.email || session.customer_email || "";
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (!tenantId) {
            console.warn("No client_reference_id (tenantId) on checkout session. Cannot update tenant.");
            break;
          }

          // Determine plan from line items or metadata
          const plan = session.metadata?.plan || "Growth";

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: "active",
              plan: plan,
              customerId: customerId,
              subscriptionId: subscriptionId,
              customerEmail: customerEmail,
              activatedAt: admin.firestore.FieldValue.serverTimestamp(),
              nextBilling: null, // Will be set by subscription.updated
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} activated on ${plan} plan`);
          break;
        }

        // Subscription updated (renewal, plan change, etc.)
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const tenantId = await findTenantByCustomerId(subscription.customer);

          if (!tenantId) {
            console.warn("No tenant found for customer:", subscription.customer);
            break;
          }

          const status = subscription.status === "active" ? "active" :
                         subscription.status === "trialing" ? "trial" :
                         subscription.status === "past_due" ? "past_due" : "inactive";

          const nextBilling = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
            : null;

          const planName = subscription.items?.data?.[0]?.price?.nickname || "Growth";

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: status,
              plan: planName,
              subscriptionId: subscription.id,
              nextBilling: nextBilling,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} subscription updated: ${status}`);
          break;
        }

        // Subscription cancelled
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const tenantId = await findTenantByCustomerId(subscription.customer);

          if (!tenantId) {
            console.warn("No tenant found for customer:", subscription.customer);
            break;
          }

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: "cancelled",
              cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} subscription cancelled`);
          break;
        }

        // Payment succeeded (for logging / receipts)
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const tenantId = await findTenantByCustomerId(invoice.customer);

          if (tenantId) {
            await db.collection("tenants").doc(tenantId).collection("invoices").add({
              invoiceId: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: "paid",
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              receiptUrl: invoice.hosted_invoice_url || "",
            });
            console.log(`Invoice recorded for tenant ${tenantId}: $${(invoice.amount_paid / 100).toFixed(2)}`);
          }
          break;
        }

        // Payment failed
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const tenantId = await findTenantByCustomerId(invoice.customer);

          if (tenantId) {
            await db.collection("tenants").doc(tenantId).set({
              subscription: {
                status: "past_due",
                lastPaymentFailed: admin.firestore.FieldValue.serverTimestamp(),
              },
            }, { merge: true });
            console.log(`Payment failed for tenant ${tenantId}`);
          }
          break;
        }

        default:
          console.log("Unhandled event type:", eventType);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Error processing webhook:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

// -------------------------------------------------------------------
// AI Column Mapper — callable Cloud Function
// -------------------------------------------------------------------
// Accepts file column headers + sample rows, calls Claude to map them
// to internal CRM fields, and optionally transforms + saves to Firestore.
//
// Call from frontend:
//   const aiMap = httpsCallable(functions, 'aiMapper');
//   const result = await aiMap({ headers, sampleRows, tenantId });
// -------------------------------------------------------------------

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const INTERNAL_FIELDS = [
  { field: "acct",       label: "Account / Customer Name" },
  { field: "dist",       label: "Distributor / Wholesaler" },
  { field: "st",         label: "State" },
  { field: "ch",         label: "Channel" },
  { field: "sku",        label: "Product / SKU / Item" },
  { field: "qty",        label: "Quantity / Volume" },
  { field: "date",       label: "Date / Period" },
  { field: "revenue",    label: "Revenue / Amount" },
  { field: "stage",      label: "Pipeline Stage" },
  { field: "owner",      label: "Owner / Sales Rep" },
  { field: "estValue",   label: "Deal Value" },
  { field: "oh",         label: "On Hand (Inventory)" },
  { field: "doh",        label: "Days on Hand" },
  { field: "lastOrder",  label: "Last Order Date" },
  { field: "orderCycle", label: "Order Cycle" },
];

// ─── Extracted Helpers (were duplicated 3-4x) ───────────────────

/**
 * Verify that the authenticated user belongs to the specified tenant.
 * @throws {functions.https.HttpsError} if not a member
 */
async function verifyTenantMembership(uid, tenantId) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
    throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
  }
  return userSnap.data();
}

/**
 * Build the AI mapping prompt for column detection.
 * @param {string[]} headers - Column headers
 * @param {object[]} rows - Sample rows (first 8 used)
 * @param {string} userRole - "supplier" or "distributor"
 * @returns {string} The prompt text
 */
function buildAIPrompt(headers, rows, userRole) {
  const roleContext = userRole === "distributor"
    ? "You are a data mapping expert for a beverage/CPG distributor CRM. The user is a distributor tracking suppliers/vendors and their own stores/locations."
    : "You are a data mapping expert for a beverage/CPG supplier CRM. The user is a supplier tracking distributors and retail accounts.";

  const table = [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
  ].join("\n");

  return `${roleContext} Map each column to an internal field.

INTERNAL FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n")}

SOURCE DATA:
${table}

Return JSON: { "mapping": { "<field>": "<column>" }, "monthColumns": [], "weekColumns": [], "uploadType": "quickbooks"|"depletion"|"sales"|"purchases"|"inventory"|"pipeline"|"unknown", "confidence": { "<field>": 0.0-1.0 } }

Return ONLY valid JSON.`;
}

/**
 * Safely parse JSON from an AI response text.
 * @param {string} text - Raw AI response
 * @returns {object} Parsed JSON
 * @throws {functions.https.HttpsError} if no valid JSON found or parse fails
 */
function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new functions.https.HttpsError("internal", "AI returned no valid JSON");
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new functions.https.HttpsError("internal", `AI returned invalid JSON: ${err.message}`);
  }
}

exports.aiMapper = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { headers, sampleRows, userRole = "supplier" } = data;
    if (!headers || !sampleRows) {
      throw new functions.https.HttpsError("invalid-argument", "headers and sampleRows required");
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError("failed-precondition", "ANTHROPIC_API_KEY not configured");
    }

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const prompt = buildAIPrompt(headers, sampleRows, userRole);
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    return parseAIResponse(response.content[0].text.trim());
  });

// -------------------------------------------------------------------
// AI Ingest Pipeline — callable Cloud Function
// -------------------------------------------------------------------
// Processes a full file through the AI mapper + transform + Firestore save.
// For use from admin tools or CLI.
// -------------------------------------------------------------------

const DATASETS = [
  "distScorecard", "reorderData", "accountsTop", "pipelineAccounts",
  "pipelineMeta", "inventoryData", "newWins", "distHealth",
  "reEngagementData", "placementSummary", "qbDistOrders", "acctConcentration",
  "spendByWine", "spendByDistributor", "billbackSummary",
];

exports.aiIngest = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { headers, rows, tenantId = "default", userRole = "supplier" } = data;
    if (!headers || !rows) {
      throw new functions.https.HttpsError("invalid-argument", "headers and rows required");
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    // Step 1: AI mapping
    const apiKey = anthropicApiKey.value();
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const prompt = buildAIPrompt(headers, rows, userRole);
    const mapResp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const mapJson = parseAIResponse(mapResp.content[0].text);
    const mapping = mapJson.mapping;

    // Step 2: Save datasets to Firestore
    const batch = db.batch();
    for (const [name, items] of Object.entries(data.datasets || {})) {
      if (!DATASETS.includes(name)) continue;
      const ref = db.collection("tenants").doc(tenantId).collection("data").doc(name);
      batch.set(ref, {
        ...(Array.isArray(items) ? { items } : items),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return { success: true, mapping, uploadType: mapJson.uploadType };
  });

// -------------------------------------------------------------------
// Rebuild Views — recompute all dashboard views from normalized imports
// -------------------------------------------------------------------
// Reads ALL import rows for a tenant, groups by type, runs transforms,
// and writes pre-computed views. Full rebuild is mathematically required:
// aggregations like momentum (firstHalf vs secondHalf), consistency
// (1 - stddev/mean), and concentration need ALL rows.
//
// Rate limited: max 10 rebuilds per hour per tenant.
// -------------------------------------------------------------------

const CHUNK_SIZE = 500;

/**
 * Build an identity mapping for normalized rows + expand _months/_weeks
 * back into indexed columns that the transform layer expects.
 */
function prepareNormalizedForTransform(normalizedRows) {
  let monthCount = 0;
  let weekCount = 0;
  for (const row of normalizedRows) {
    if (row._months) monthCount = Math.max(monthCount, row._months.length);
    if (row._weeks) weekCount = Math.max(weekCount, row._weeks.length);
  }

  const monthCols = Array.from({ length: monthCount }, (_, i) => `_m${i}`);
  const weekCols = Array.from({ length: weekCount }, (_, i) => `_w${i}`);

  // Expand _months/_weeks arrays into indexed columns on each row
  const expanded = normalizedRows.map((row) => {
    const out = { ...row };
    if (row._months) {
      row._months.forEach((v, i) => { out[`_m${i}`] = v; });
    }
    if (row._weeks) {
      row._weeks.forEach((v, i) => { out[`_w${i}`] = v; });
    }
    return out;
  });

  // Identity mapping: field name → field name (normalized rows already use internal names)
  const mapping = {
    acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku",
    qty: "qty", date: "date", revenue: "revenue",
    stage: "stage", owner: "owner", estValue: "estValue",
    oh: "oh", doh: "doh", lastOrder: "lastOrder", orderCycle: "orderCycle",
  };
  if (monthCols.length) mapping._monthColumns = monthCols;
  if (weekCols.length) mapping._weekColumns = weekCols;

  return { rows: expanded, mapping };
}

exports.rebuildViews = functions
  .runWith({ timeoutSeconds: 540, memory: "2GB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId } = data;
    if (!tenantId) {
      throw new functions.https.HttpsError("invalid-argument", "tenantId required");
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    // ── Rate limiting: max 10 rebuilds/hour ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRebuilds = await db.collection("tenants").doc(tenantId)
      .collection("rebuildHistory")
      .where("startedAt", ">=", oneHourAgo)
      .get();

    if (recentRebuilds.size >= 10) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit: max 10 rebuilds per hour. Try again later."
      );
    }

    // Log rebuild start
    const rebuildRef = db.collection("tenants").doc(tenantId)
      .collection("rebuildHistory").doc();
    await rebuildRef.set({
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "running",
      triggeredBy: context.auth.uid,
    });

    try {
      // ── Load all imports ──
      const importsSnap = await db.collection("tenants").doc(tenantId)
        .collection("imports")
        .orderBy("createdAt", "asc")
        .get();

      if (importsSnap.empty) {
        // No imports → write empty views
        const emptyViews = {};
        for (const name of DATASETS) {
          const ref = db.collection("tenants").doc(tenantId).collection("views").doc(name);
          await ref.set({ items: [], chunked: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        await rebuildRef.update({
          status: "success",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          importCount: 0,
          totalRows: 0,
        });
        return { status: "success", importCount: 0, totalRows: 0, viewsWritten: 0 };
      }

      // ── Load all import rows, grouped by type ──
      const rowsByType = {};
      let totalRows = 0;

      for (const importDoc of importsSnap.docs) {
        const meta = importDoc.data();
        const type = meta.type || "unknown";

        // Load rows for this import
        const rowsSnap = await db.collection("tenants").doc(tenantId)
          .collection("imports").doc(importDoc.id)
          .collection("rows")
          .get();

        const rows = rowsSnap.docs
          .map((d) => ({ idx: d.data().idx, items: d.data().items }))
          .sort((a, b) => a.idx - b.idx)
          .flatMap((c) => c.items);

        if (!rowsByType[type]) rowsByType[type] = [];
        rowsByType[type].push(...rows);
        totalRows += rows.length;
      }

      // ── Transform each type and merge views (last-type-wins) ──
      const mergedViews = {};

      for (const [type, rows] of Object.entries(rowsByType)) {
        if (rows.length === 0) continue;

        // Billback imports use their own transform
        if (type === "billback") {
          try {
            const { transformBillback } = require("./lib/pipeline/transformBillback");
            // Billback rows are already in the right shape (not the standard mapping model)
            const billbackMapping = { wine: "wine", producer: "producer", dist: "dist", amount: "amount", qty: "qty", date: "date", type: "type", invoiceNo: "invoiceNo" };
            const billbackViews = transformBillback(rows, billbackMapping);
            for (const [name, items] of Object.entries(billbackViews)) {
              if (items !== undefined && DATASETS.includes(name)) {
                mergedViews[name] = items;
              }
            }
          } catch (err) {
            console.error(`[rebuildViews] Billback transform failed for tenant ${tenantId}:`, {
              error: err.message,
              rowCount: rows.length,
            });
          }
          continue;
        }

        // Validate: warn on missing required fields
        const missingAcct = rows.filter((r) => !r.acct).length;
        const missingQty = rows.filter((r) => !r.qty && r.qty !== 0).length;
        if (missingAcct > rows.length * 0.5) {
          console.warn(`[rebuildViews] ${tenantId}: >50% rows missing 'acct' for type '${type}'`);
        }
        if (missingQty > rows.length * 0.5) {
          console.warn(`[rebuildViews] ${tenantId}: >50% rows missing 'qty' for type '${type}'`);
        }

        try {
          const { rows: expanded, mapping } = prepareNormalizedForTransform(rows);
          const { type: resolvedType, ...datasets } = transformAll(expanded, mapping, type);

          // Merge: last-type-wins for overlapping dataset names
          for (const [name, items] of Object.entries(datasets)) {
            if (items !== undefined && DATASETS.includes(name)) {
              mergedViews[name] = items;
            }
          }
        } catch (err) {
          console.error(`[rebuildViews] Transform failed for type '${type}' in tenant ${tenantId}:`, {
            error: err.message,
            rowCount: rows.length,
            importCount: importsSnap.size,
          });
          // Continue with other types — don't fail the whole rebuild
        }
      }

      // ── Write views to Firestore ──
      let viewsWritten = 0;
      for (const [name, items] of Object.entries(mergedViews)) {
        const viewRef = db.collection("tenants").doc(tenantId).collection("views").doc(name);
        const isObject = !Array.isArray(items);

        if (isObject || items.length <= CHUNK_SIZE) {
          await viewRef.set({
            ...(isObject ? items : { items }),
            chunked: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Chunked write
          const version = Date.now();
          await viewRef.set({
            chunked: true,
            version,
            count: items.length,
            chunkCount: Math.ceil(items.length / CHUNK_SIZE),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunkIdx = Math.floor(i / CHUNK_SIZE);
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const chunkRef = db.collection("tenants").doc(tenantId)
              .collection("views").doc(name)
              .collection("rows").doc(String(chunkIdx));
            await chunkRef.set({
              idx: chunkIdx,
              version,
              items: chunk,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        viewsWritten++;
      }

      // ── Generate and save summary ──
      const primaryType = Object.keys(rowsByType)[0] || "depletion";
      const summary = generateSummary(primaryType, mergedViews);
      await db.collection("tenants").doc(tenantId).collection("views").doc("_summary").set({
        text: summary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await rebuildRef.update({
        status: "success",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        importCount: importsSnap.size,
        totalRows,
        viewsWritten,
        types: Object.keys(rowsByType),
      });

      console.log(`[rebuildViews] Tenant ${tenantId}: ${importsSnap.size} imports, ${totalRows} rows, ${viewsWritten} views`);
      return { status: "success", importCount: importsSnap.size, totalRows, viewsWritten };

    } catch (err) {
      console.error(`[rebuildViews] Fatal error for tenant ${tenantId}:`, {
        error: err.message,
        stack: err.stack,
      });
      await rebuildRef.update({
        status: "error",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: err.message,
      });
      throw new functions.https.HttpsError("internal", `Rebuild failed: ${err.message}`);
    }
  });

// -------------------------------------------------------------------
// Extract Accounts — auto-extract CRM entities from normalized imports
// -------------------------------------------------------------------
// On each import, extracts unique account names, normalizes them, and
// creates/updates accounts/{id} documents. Uses Claude for fuzzy matching
// against existing accounts.
//
// Confidence thresholds:
//   >0.85 → auto-link to existing account
//   0.5-0.85 → pending review queue
//   <0.5 → create new account
// -------------------------------------------------------------------

/**
 * Sanitize account name for safe use in AI prompts.
 * Prevents prompt injection and normalizes for matching.
 */
function sanitizeAccountName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/[<>{}[\]\\|`~!@#$%^&*()+=;:'"]/g, "")
    .trim()
    .slice(0, 100);
}

/**
 * Normalize account name for exact-match comparison.
 * Lowercase, strip whitespace, remove common suffixes.
 */
function normalizeAccountName(name) {
  return sanitizeAccountName(name)
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|group|enterprises?|holdings?)\b\.?/gi, "")
    .replace(/[.,\-']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

exports.extractAccounts = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, importId } = data;
    if (!tenantId || !importId) {
      throw new functions.https.HttpsError("invalid-argument", "tenantId and importId required");
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    // ── Load import rows ──
    const importRef = db.collection("tenants").doc(tenantId).collection("imports").doc(importId);
    const importSnap = await importRef.get();
    if (!importSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Import not found");
    }

    const rowsSnap = await importRef.collection("rows").get();
    const rows = rowsSnap.docs
      .map((d) => ({ idx: d.data().idx, items: d.data().items }))
      .sort((a, b) => a.idx - b.idx)
      .flatMap((c) => c.items);

    // ── Extract unique account names ──
    const rawNames = new Set();
    for (const row of rows) {
      const name = (row.acct || "").trim();
      if (name) rawNames.add(name);
    }

    if (rawNames.size === 0) {
      console.warn(`[extractAccounts] ${tenantId}/${importId}: No account names found (empty 'acct' column)`);
      return { status: "skipped", reason: "no_accounts", created: 0, linked: 0, pending: 0 };
    }

    // ── Load existing accounts ──
    const accountsSnap = await db.collection("tenants").doc(tenantId).collection("accounts").get();
    const existingAccounts = accountsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Build normalized name → account ID lookup
    const normalizedLookup = {};
    for (const acct of existingAccounts) {
      for (const srcName of (acct.sourceNames || [acct.name])) {
        normalizedLookup[normalizeAccountName(srcName)] = acct.id;
      }
    }

    // ── Phase 1: Exact match ──
    const unmatched = [];
    const linked = [];

    for (const rawName of rawNames) {
      const normalized = normalizeAccountName(rawName);
      if (!normalized) continue;

      if (normalizedLookup[normalized]) {
        // Exact match — link to existing account
        linked.push({ rawName, accountId: normalizedLookup[normalized] });
      } else {
        unmatched.push(rawName);
      }
    }

    // ── Phase 2: AI fuzzy match for unmatched names ──
    let created = 0;
    let pendingCount = 0;

    if (unmatched.length > 0 && existingAccounts.length > 0) {
      const apiKey = anthropicApiKey.value();
      if (apiKey) {
        try {
          const Anthropic = require("@anthropic-ai/sdk");
          const client = new Anthropic({ apiKey });

          // Sanitize names for prompt safety
          const sanitizedUnmatched = unmatched.map(sanitizeAccountName).filter(Boolean);
          const existingNames = existingAccounts
            .map((a) => sanitizeAccountName(a.name))
            .filter(Boolean)
            .slice(0, 200); // Limit to prevent prompt overflow

          if (sanitizedUnmatched.length > 0 && existingNames.length > 0) {
            const prompt = `You are a data deduplication expert for a wine/beverage industry CRM.

Match each NEW account name to the most similar EXISTING account name. Consider:
- Abbreviations (e.g., "St." = "Saint", "Ave" = "Avenue")
- Business suffixes (Inc, LLC, Corp) should be ignored
- Common misspellings and typos
- Partial matches (e.g., "The Wine Bar" ~ "Wine Bar & Grill")

NEW ACCOUNTS:
${sanitizedUnmatched.map((n, i) => `${i + 1}. ${n}`).join("\n")}

EXISTING ACCOUNTS:
${existingNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Return JSON array: [{ "new": "<new name>", "existing": "<existing name or null>", "confidence": 0.0-1.0 }]
If no good match, set "existing" to null and "confidence" to 0.
Return ONLY valid JSON.`;

            let aiMatches = [];
            let retries = 0;
            while (retries < 3) {
              try {
                const response = await client.messages.create({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 2000,
                  messages: [{ role: "user", content: prompt }],
                });

                const text = response.content[0].text.trim();
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  // Validate shape: must be array of { new: string, existing: string|null, confidence: number }
                  if (Array.isArray(parsed)) {
                    aiMatches = parsed.filter((m) =>
                      m && typeof m === "object" &&
                      typeof m.new === "string" &&
                      (m.existing === null || typeof m.existing === "string")
                    );
                  }
                }
                break; // Success
              } catch (err) {
                retries++;
                if (retries >= 3) {
                  console.error(`[extractAccounts] Claude failed after 3 retries for ${tenantId}:`, err.message);
                  // Fall through — all unmatched become new accounts
                } else {
                  // Exponential backoff
                  await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
                }
              }
            }

            // Process AI matches
            const matchedByAI = new Set();
            for (const match of aiMatches) {
              if (!match || typeof match !== "object") continue;

              const confidence = parseFloat(match.confidence);
              const safeConfidence = isNaN(confidence) ? 0 : Math.min(1, Math.max(0, confidence));
              const newName = match.new;
              const existingName = match.existing;

              if (!newName) continue;
              matchedByAI.add(newName);

              if (existingName && safeConfidence > 0.85) {
                // Auto-link: find the existing account by name
                const existingAcct = existingAccounts.find(
                  (a) => normalizeAccountName(a.name) === normalizeAccountName(existingName)
                );
                if (existingAcct) {
                  linked.push({ rawName: newName, accountId: existingAcct.id });
                  // Add source name to existing account
                  await db.collection("tenants").doc(tenantId)
                    .collection("accounts").doc(existingAcct.id)
                    .update({
                      sourceNames: admin.firestore.FieldValue.arrayUnion(newName),
                      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                      importIds: admin.firestore.FieldValue.arrayUnion(importId),
                    });
                  continue;
                }
              }

              if (existingName && safeConfidence >= 0.5) {
                // Pending review
                await db.collection("tenants").doc(tenantId)
                  .collection("pendingMatches").add({
                    newName,
                    suggestedMatch: existingName,
                    confidence: safeConfidence,
                    importId,
                    status: "pending",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                pendingCount++;
                continue;
              }

              // Low confidence — create new account
              await createAccount(tenantId, newName, importId, rows);
              created++;
            }

            // Any unmatched names that AI didn't return results for — create new
            for (const name of sanitizedUnmatched) {
              if (!matchedByAI.has(name)) {
                await createAccount(tenantId, name, importId, rows);
                created++;
              }
            }
          } else {
            // No sanitized names or no existing accounts to match against
            for (const name of unmatched) {
              await createAccount(tenantId, name, importId, rows);
              created++;
            }
          }
        } catch (err) {
          console.error(`[extractAccounts] AI dedup failed for ${tenantId}:`, err.message);
          // Fallback: create all unmatched as new accounts
          for (const name of unmatched) {
            await createAccount(tenantId, name, importId, rows);
            created++;
          }
        }
      } else {
        // No API key — create all unmatched as new accounts
        for (const name of unmatched) {
          await createAccount(tenantId, name, importId, rows);
          created++;
        }
      }
    } else if (unmatched.length > 0) {
      // No existing accounts to compare — create all as new
      for (const name of unmatched) {
        await createAccount(tenantId, name, importId, rows);
        created++;
      }
    }

    // ── Update linked accounts with import reference ──
    for (const { accountId } of linked) {
      await db.collection("tenants").doc(tenantId)
        .collection("accounts").doc(accountId)
        .update({
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          importIds: admin.firestore.FieldValue.arrayUnion(importId),
        }).catch(() => {}); // Ignore if already updated in AI phase
    }

    console.log(`[extractAccounts] ${tenantId}/${importId}: ${created} created, ${linked.length} linked, ${pendingCount} pending`);
    return { status: "success", created, linked: linked.length, pending: pendingCount };
  });

/**
 * Create a new account document from import data.
 */
async function createAccount(tenantId, name, importId, rows) {
  const sanitized = sanitizeAccountName(name);
  if (!sanitized) return;

  // Extract metadata from rows for this account
  const accountRows = rows.filter((r) => (r.acct || "").trim() === name);
  const states = [...new Set(accountRows.map((r) => r.st).filter(Boolean))];
  const distributors = [...new Set(accountRows.map((r) => r.dist).filter(Boolean))];
  const channels = [...new Set(accountRows.map((r) => r.ch).filter(Boolean))];

  const accountRef = db.collection("tenants").doc(tenantId).collection("accounts").doc();
  await accountRef.set({
    name: sanitized,
    normalizedName: normalizeAccountName(name),
    displayName: sanitized,
    sourceNames: [name],
    firstSeen: admin.firestore.FieldValue.serverTimestamp(),
    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      state: states[0] || "",
      distributor: distributors[0] || "",
      channel: channels[0] || "",
      states,
      distributors,
      channels,
    },
    importIds: [importId],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// -------------------------------------------------------------------
// Cloud Sync — Google Drive scheduled file sync (Premium feature)
// -------------------------------------------------------------------
// Allows paid tenants to connect a Google Drive folder and automatically
// pull updated spreadsheets on a schedule (every 6/12/24 hours).
//
// SETUP (one-time):
//   firebase functions:secrets:set GOOGLE_CLIENT_ID
//   firebase functions:secrets:set GOOGLE_CLIENT_SECRET
//
// Google Cloud Console:
//   1. Enable the Google Drive API
//   2. Create OAuth 2.0 credentials (Web application)
//   3. Add authorized redirect URI:
//      https://us-central1-mt-crm-platform.cloudfunctions.net/cloudSyncOAuthCallback
// -------------------------------------------------------------------

const googleClientId = defineSecret("GOOGLE_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_CLIENT_SECRET");

const { getAuthedDriveClient, listFolderFiles, downloadFile, listFolders } = require("./lib/driveClient");
const { parseFileBuffer, transformAll, generateSummary } = require("./lib/pipeline/index");

// OAuth callback — exchanges auth code for tokens, stores in Firestore
exports.cloudSyncOAuthCallback = functions
  .runWith({ secrets: [googleClientId, googleClientSecret] })
  .https.onRequest(async (req, res) => {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      res.redirect(`https://mt-crm-platform.web.app/settings?cloudSync=error&reason=${oauthError}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send("Missing code or state parameter");
      return;
    }

    let tenantId;
    try {
      tenantId = JSON.parse(Buffer.from(state, "base64").toString()).tenantId;
    } catch {
      res.status(400).send("Invalid state parameter");
      return;
    }

    // Verify tenant has active subscription
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const subStatus = tenantSnap.data()?.subscription?.status;
    if (subStatus !== "active" && subStatus !== "trial") {
      res.redirect(`https://mt-crm-platform.web.app/settings?cloudSync=error&reason=subscription_required`);
      return;
    }

    try {
      const { google } = require("googleapis");
      const oauth2 = new google.auth.OAuth2(
        googleClientId.value(),
        googleClientSecret.value(),
        `https://us-central1-mt-crm-platform.cloudfunctions.net/cloudSyncOAuthCallback`
      );

      const { tokens } = await oauth2.getToken(code);

      // Store tokens in server-only secrets subcollection
      await db.collection("tenants").doc(tenantId).collection("secrets").doc("googleDrive").set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date),
        scope: tokens.scope,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark cloud sync as connected in tenant config
      await db.collection("tenants").doc(tenantId).collection("config").doc("main").set({
        cloudSync: {
          enabled: false, // User must still select folder and enable
          provider: "google_drive",
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.redirect(`https://mt-crm-platform.web.app/settings?cloudSync=success`);
    } catch (err) {
      console.error("OAuth token exchange failed:", err);
      res.redirect(`https://mt-crm-platform.web.app/settings?cloudSync=error&reason=token_exchange_failed`);
    }
  });

// Disconnect Google Drive — revokes token and cleans up
exports.cloudSyncDisconnect = functions
  .runWith({ secrets: [googleClientId, googleClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId = "default" } = data;

    await verifyTenantMembership(context.auth.uid, tenantId);

    // Delete stored tokens
    await db.collection("tenants").doc(tenantId).collection("secrets").doc("googleDrive").delete();

    // Clear cloud sync config
    await db.collection("tenants").doc(tenantId).collection("config").doc("main").set({
      cloudSync: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true };
  });

// List folders in Google Drive — for the folder picker UI
exports.cloudSyncListFolders = functions
  .runWith({ secrets: [googleClientId, googleClientSecret], timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId = "default", parentId } = data;

    await verifyTenantMembership(context.auth.uid, tenantId);

    try {
      const drive = await getAuthedDriveClient(
        db, tenantId, googleClientId.value(), googleClientSecret.value()
      );
      const folders = await listFolders(drive, parentId);
      return { folders };
    } catch (err) {
      if (err.message?.startsWith("REAUTH_REQUIRED")) {
        throw new functions.https.HttpsError("failed-precondition", err.message);
      }
      throw new functions.https.HttpsError("internal", `Failed to list folders: ${err.message}`);
    }
  });

// Manual sync trigger — runs sync immediately for one tenant
exports.cloudSyncNow = functions
  .runWith({
    secrets: [anthropicApiKey, googleClientId, googleClientSecret],
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId = "default" } = data;

    await verifyTenantMembership(context.auth.uid, tenantId);

    const configSnap = await db.collection("tenants").doc(tenantId).collection("config").doc("main").get();
    const config = configSnap.data() || {};

    if (!config.cloudSync?.folderId) {
      throw new functions.https.HttpsError("failed-precondition", "No folder configured for sync");
    }

    try {
      const result = await processTenantSync(
        tenantId, config,
        googleClientId.value(), googleClientSecret.value(),
        anthropicApiKey.value(), "manual"
      );
      return result;
    } catch (err) {
      throw new functions.https.HttpsError("internal", `Sync failed: ${err.message}`);
    }
  });

// Scheduled sync — runs every 6 hours, processes all eligible tenants
exports.scheduledCloudSync = functions
  .runWith({
    secrets: [anthropicApiKey, googleClientId, googleClientSecret],
    timeoutSeconds: 540,
    memory: "1GB",
  })
  .pubsub.schedule("every 6 hours")
  .onRun(async () => {
    console.log("[CloudSync] Scheduled sync starting...");

    // Find tenants with active subscriptions
    const tenantsSnap = await db.collection("tenants")
      .where("subscription.status", "==", "active")
      .get();

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      try {
        // Load tenant config
        const configSnap = await db.collection("tenants").doc(tenantId)
          .collection("config").doc("main").get();
        const config = configSnap.data() || {};

        // Skip if cloud sync not enabled or no folder configured
        if (!config.cloudSync?.enabled || !config.cloudSync?.folderId) {
          skipped++;
          continue;
        }

        // Check cadence — skip if not time yet
        const cadenceHours = parseInt(config.cloudSync.cadence) || 24;
        const lastSyncSnap = await db.collection("tenants").doc(tenantId)
          .collection("syncState").doc("driveFiles").get();
        const lastSyncAt = lastSyncSnap.data()?.lastSyncAt?.toMillis?.() || 0;
        const hoursSinceLast = (Date.now() - lastSyncAt) / (1000 * 60 * 60);

        if (hoursSinceLast < cadenceHours) {
          skipped++;
          continue;
        }

        // Check for running sync (simple lock)
        const runningSyncs = await db.collection("tenants").doc(tenantId)
          .collection("syncHistory")
          .where("status", "==", "running")
          .limit(1)
          .get();

        if (!runningSyncs.empty) {
          const runningDoc = runningSyncs.docs[0].data();
          const startedMs = runningDoc.startedAt?.toMillis?.() || 0;
          if (Date.now() - startedMs < 10 * 60 * 1000) {
            skipped++;
            continue;
          }
        }

        await processTenantSync(
          tenantId, config,
          googleClientId.value(), googleClientSecret.value(),
          anthropicApiKey.value(), "schedule"
        );
        processed++;
      } catch (err) {
        console.error(`[CloudSync] Error processing tenant ${tenantId}:`, err.message);
        errors++;
      }
    }

    console.log(`[CloudSync] Done. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  });

/**
 * Process sync for a single tenant — shared by scheduled and manual triggers.
 */
async function processTenantSync(tenantId, config, clientId, clientSecret, apiKey, triggeredBy) {
  const syncHistoryRef = db.collection("tenants").doc(tenantId).collection("syncHistory").doc();
  const userRole = config.userRole || "supplier";

  // Create running sync record
  await syncHistoryRef.set({
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "running",
    triggeredBy,
  });

  try {
    // Get Drive client
    const drive = await getAuthedDriveClient(db, tenantId, clientId, clientSecret);

    // List files in configured folder
    const files = await listFolderFiles(drive, config.cloudSync.folderId);
    if (files.length === 0) {
      await syncHistoryRef.update({
        status: "skipped",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        filesProcessed: 0,
        error: "No spreadsheet files found in folder",
      });
      return { status: "skipped", filesProcessed: 0 };
    }

    // Load previous sync state for change detection
    const syncStateRef = db.collection("tenants").doc(tenantId).collection("syncState").doc("driveFiles");
    const syncStateSnap = await syncStateRef.get();
    const prevFiles = syncStateSnap.data()?.files || {};

    // Filter to changed files only
    const changedFiles = files.filter((f) => {
      const prev = prevFiles[f.id];
      if (!prev) return true;
      return prev.modifiedTime !== f.modifiedTime || prev.md5Checksum !== f.md5Checksum;
    }).slice(0, 5); // Limit to 5 files per sync to stay within timeout

    if (changedFiles.length === 0) {
      await syncHistoryRef.update({
        status: "skipped",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        filesProcessed: 0,
        error: "No files changed since last sync",
      });
      await syncStateRef.set({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { status: "skipped", filesProcessed: 0 };
    }

    // Process each changed file
    const fileNames = [];
    const dataTypes = [];
    let totalRows = 0;

    for (const file of changedFiles) {
      console.log(`[CloudSync] Processing: ${file.name} for tenant ${tenantId}`);

      // Download file
      const { buffer, ext } = await downloadFile(drive, file);

      // Parse
      const { headers, rows } = parseFileBuffer(buffer, ext);
      if (rows.length === 0) continue;

      // AI mapping
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const prompt = buildAIPrompt(headers, rows, userRole);
      const mapResp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const mapJson = parseAIResponse(mapResp.content[0].text);
      const mapping = mapJson.mapping || {};
      if (mapJson.monthColumns?.length) mapping._monthColumns = mapJson.monthColumns;
      if (mapJson.weekColumns?.length) mapping._weekColumns = mapJson.weekColumns;
      const uploadType = mapJson.uploadType || "quickbooks";

      // Transform
      const result = transformAll(rows, mapping, uploadType);
      const { type: resolvedType, ...datasets } = result;

      // Generate summary
      const summary = generateSummary(uploadType, datasets, userRole);

      // Save to Firestore
      const batch = db.batch();
      for (const [name, items] of Object.entries(datasets)) {
        if (!DATASETS.includes(name) || items === undefined) continue;
        const ref = db.collection("tenants").doc(tenantId).collection("data").doc(name);
        batch.set(ref, {
          ...(Array.isArray(items) ? { items } : items),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      const summaryRef = db.collection("tenants").doc(tenantId).collection("data").doc("_summary");
      batch.set(summaryRef, { text: summary, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await batch.commit();

      fileNames.push(file.name);
      dataTypes.push(uploadType);
      totalRows += rows.length;

      // Update file sync state
      const fileState = { ...prevFiles };
      fileState[file.id] = {
        name: file.name,
        modifiedTime: file.modifiedTime,
        md5Checksum: file.md5Checksum || "",
        lastProcessedAt: new Date().toISOString(),
      };
      await syncStateRef.set({
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        files: fileState,
      });
    }

    // Log upload
    await db.collection("tenants").doc(tenantId).collection("uploads").add({
      source: `Cloud Sync (${triggeredBy})`,
      dataType: dataTypes.join(", "),
      rowCount: totalRows,
      fileNames,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update sync history
    await syncHistoryRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      filesProcessed: fileNames.length,
      fileNames,
      rowsIngested: totalRows,
      dataTypes,
    });

    console.log(`[CloudSync] Tenant ${tenantId}: ${fileNames.length} files, ${totalRows} rows`);
    return { status: "success", filesProcessed: fileNames.length, rowsIngested: totalRows };

  } catch (err) {
    await syncHistoryRef.update({
      status: "error",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: err.message,
      filesProcessed: 0,
    });
    throw err;
  }
}

// -------------------------------------------------------------------
// Helper: Find tenant by Stripe customer ID
// -------------------------------------------------------------------
async function findTenantByCustomerId(customerId) {
  if (!customerId) return null;

  const snap = await db.collection("tenants")
    .where("subscription.customerId", "==", customerId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  return null;
}

// -------------------------------------------------------------------
// Billback Functions — re-export from functions/billback.js
// -------------------------------------------------------------------
const billback = require("./billback");
exports.parseBillbackPDF = billback.parseBillbackPDF;
exports.extractWines = billback.extractWines;
