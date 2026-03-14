/**
 * Google Drive client — OAuth2 token management and file operations.
 * Used by the scheduled Cloud Sync function.
 */

const { google } = require("googleapis");

/**
 * Create an OAuth2 client from stored tokens, refreshing if expired.
 * Saves refreshed tokens back to Firestore.
 */
async function getAuthedDriveClient(db, tenantId, clientId, clientSecret) {
  const secretsRef = db.collection("tenants").doc(tenantId).collection("secrets").doc("googleDrive");
  const snap = await secretsRef.get();

  if (!snap.exists) {
    throw new Error("Google Drive not connected — no stored tokens");
  }

  const { accessToken, refreshToken, tokenExpiry } = snap.data();

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: tokenExpiry?.toMillis?.() || 0,
  });

  // Refresh if expired or about to expire (5 min buffer)
  const now = Date.now();
  const expiry = tokenExpiry?.toMillis?.() || 0;
  if (now >= expiry - 5 * 60 * 1000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);

      await secretsRef.update({
        accessToken: credentials.access_token,
        tokenExpiry: new Date(credentials.expiry_date),
      });
    } catch (err) {
      if (err.message?.includes("invalid_grant")) {
        throw new Error("REAUTH_REQUIRED: Google Drive access has been revoked. Please reconnect.");
      }
      throw err;
    }
  }

  return google.drive({ version: "v3", auth: oauth2 });
}

/**
 * List spreadsheet files in a Drive folder.
 * Returns array of { id, name, modifiedTime, md5Checksum, mimeType }.
 */
async function listFolderFiles(drive, folderId) {
  const mimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/vnd.google-apps.spreadsheet",
  ];

  const q = `'${folderId}' in parents and trashed = false and (${mimeTypes.map((m) => `mimeType = '${m}'`).join(" or ")})`;

  const res = await drive.files.list({
    q,
    fields: "files(id, name, modifiedTime, md5Checksum, mimeType)",
    orderBy: "modifiedTime desc",
    pageSize: 20,
  });

  return res.data.files || [];
}

/**
 * Download a file from Drive as a Buffer.
 * Handles both uploaded files and native Google Sheets (exports as xlsx).
 */
async function downloadFile(drive, file) {
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    // Export Google Sheet as xlsx
    const res = await drive.files.export(
      { fileId: file.id, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { responseType: "arraybuffer" }
    );
    return { buffer: Buffer.from(res.data), ext: ".xlsx" };
  }

  // Download uploaded file directly
  const res = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "arraybuffer" }
  );

  const ext = file.name.match(/\.(xlsx|xls|csv|tsv)$/i)?.[0]?.toLowerCase() || ".xlsx";
  return { buffer: Buffer.from(res.data), ext };
}

/**
 * List folders in Drive for the folder picker UI.
 * If parentId is provided, lists subfolders; otherwise lists root-level folders.
 */
async function listFolders(drive, parentId) {
  const parent = parentId || "'root'";
  const q = `${parentId ? `'${parentId}'` : "'root'"} in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 50,
  });

  return res.data.files || [];
}

module.exports = {
  getAuthedDriveClient,
  listFolderFiles,
  downloadFile,
  listFolders,
};
