const {
  functions,
  admin,
  db,
  anthropicApiKey,
  googleClientId,
  googleClientSecret,
  verifyTenantMembership,
  buildAIPrompt,
  parseAIResponse,
} = require("./helpers");

const { getAuthedDriveClient, listFolderFiles, downloadFile, listFolders } = require("./lib/driveClient");
const {
  parseFileBuffer,
  normalizeRows,
  writeChunked,
  createAdminFirestoreAdapter,
} = require("./lib/pipeline/index");
const { rebuildViewsForTenant } = require("./rebuild");

const firestoreAdapter = createAdminFirestoreAdapter({ admin, db });

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

// OAuth callback — exchanges auth code for tokens, stores in Firestore
const cloudSyncOAuthCallback = functions
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
const cloudSyncDisconnect = functions
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
const cloudSyncListFolders = functions
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
const cloudSyncSyncNow = functions
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
const scheduledCloudSync = functions
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
    const importIds = [];
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
      const normalizedRows = normalizeRows(rows, mapping);
      const importRef = db.collection("tenants").doc(tenantId).collection("imports").doc();

      await writeChunked(db, ["tenants", tenantId, "imports", importRef.id], normalizedRows, {
        adapter: firestoreAdapter,
        forceChunked: true,
        version: 1,
        cleanupStaleChunks: false,
        updatedAtField: null,
        meta: {
          fileName: file.name,
          type: uploadType,
          mapping,
          uploadedBy: triggeredBy,
          rowCount: normalizedRows.length,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: {
            type: "google_drive",
            fileId: file.id,
            fileName: file.name,
            modifiedTime: file.modifiedTime,
            md5Checksum: file.md5Checksum || "",
          },
        },
      });

      fileNames.push(file.name);
      dataTypes.push(uploadType);
      importIds.push(importRef.id);
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

    if (importIds.length > 0) {
      await rebuildViewsForTenant({
        tenantId,
        triggeredBy: `cloud_sync:${triggeredBy}`,
      });
    }

    // Log upload
    await db.collection("tenants").doc(tenantId).collection("uploads").add({
      source: `Cloud Sync (${triggeredBy})`,
      dataType: dataTypes.join(", "),
      rowCount: totalRows,
      fileNames,
      importIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update sync history
    await syncHistoryRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      filesProcessed: fileNames.length,
      fileNames,
      importIds,
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

module.exports = {
  cloudSyncOAuthCallback,
  cloudSyncDisconnect,
  cloudSyncListFolders,
  cloudSyncSyncNow,
  scheduledCloudSync,
};
