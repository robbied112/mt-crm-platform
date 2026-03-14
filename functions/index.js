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

exports.aiMapper = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    // Require authentication
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

    const roleContext = userRole === "distributor"
      ? "You are a data mapping expert for a beverage/CPG distributor CRM. The user is a distributor tracking suppliers/vendors and their own stores/locations."
      : "You are a data mapping expert for a beverage/CPG supplier CRM. The user is a supplier tracking distributors and retail accounts.";

    const table = [
      headers.join(" | "),
      headers.map(() => "---").join(" | "),
      ...sampleRows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
    ].join("\n");

    const prompt = `${roleContext} Map each column to an internal field.

INTERNAL FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n")}

SOURCE DATA:
${table}

Return JSON: { "mapping": { "<field>": "<column>" }, "monthColumns": [], "weekColumns": [], "uploadType": "quickbooks"|"depletion"|"sales"|"purchases"|"inventory"|"pipeline"|"unknown", "confidence": { "<field>": 0.0-1.0 } }

Return ONLY valid JSON.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new functions.https.HttpsError("internal", "AI returned no valid JSON");
    }

    return JSON.parse(jsonMatch[0]);
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

    // Verify tenant membership
    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
    }

    // Step 1: AI mapping (reuse aiMapper logic inline)
    const apiKey = anthropicApiKey.value();
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const sampleTable = [
      headers.join(" | "),
      headers.map(() => "---").join(" | "),
      ...rows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
    ].join("\n");

    const mapResp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: `${userRole === "distributor" ? "You are mapping data for a distributor CRM. 'dist' = Supplier/Vendor, 'acct' = Store/Location." : "You are mapping data for a supplier CRM. 'dist' = Distributor, 'acct' = Account."} Map columns to CRM fields.\n\nFIELDS:\n${INTERNAL_FIELDS.map((f) => `${f.field}: ${f.label}`).join("\n")}\n\nDATA:\n${sampleTable}\n\nReturn JSON: { "mapping": {...}, "uploadType": "..." }\nOnly JSON.` }],
    });

    const mapText = mapResp.content[0].text;
    const mapJson = JSON.parse(mapText.match(/\{[\s\S]*\}/)[0]);
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
