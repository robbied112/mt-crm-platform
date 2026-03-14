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
const { parseFileBuffer, transformAll, generateSummary } = require("./lib/pipeline");

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

    // Verify tenant membership
    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
    }

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

    // Verify tenant membership
    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
    }

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

    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Not a member of this tenant");
    }

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

      const roleContext = userRole === "distributor"
        ? "You are mapping data for a distributor CRM. 'dist' = Supplier/Vendor, 'acct' = Store/Location."
        : "You are mapping data for a supplier CRM. 'dist' = Distributor, 'acct' = Account.";

      const sampleTable = [
        headers.join(" | "),
        headers.map(() => "---").join(" | "),
        ...rows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
      ].join("\n");

      const mapResp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `${roleContext} Map columns to CRM fields.\n\nFIELDS:\n${INTERNAL_FIELDS.map((f) => `${f.field}: ${f.label}`).join("\n")}\n\nDATA:\n${sampleTable}\n\nReturn JSON: { "mapping": {...}, "monthColumns": [], "weekColumns": [], "uploadType": "..." }\nOnly JSON.`,
        }],
      });

      const mapJson = JSON.parse(mapResp.content[0].text.match(/\{[\s\S]*\}/)[0]);
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
