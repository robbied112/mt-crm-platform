/**
 * CloudSyncSettings — Google Drive scheduled sync configuration.
 * Premium feature: gated behind active subscription.
 */

import { useState, useEffect, useCallback } from "react";
import { useData } from "../context/DataContext";
import { loadSyncHistory } from "../services/firestoreService";
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const OAUTH_REDIRECT_URI = "https://us-central1-mt-crm-platform.cloudfunctions.net/cloudSyncOAuthCallback";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function StatusBadge({ status }) {
  const colors = {
    success: { bg: "rgba(31, 134, 90, 0.08)", color: "#1F865A", border: "#1F865A" },
    error: { bg: "rgba(197, 48, 48, 0.08)", color: "#C53030", border: "rgba(197, 48, 48, 0.2)" },
    running: { bg: "rgba(192, 123, 1, 0.08)", color: "#C07B01", border: "rgba(192, 123, 1, 0.2)" },
    skipped: { bg: "#FDF8F0", color: "#6B6B6B", border: "#E5E0DA" },
  };
  const c = colors[status] || colors.skipped;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}

export default function CloudSyncSettings() {
  const { tenantConfig, updateTenantConfig, tenantId } = useData();
  const subscription = tenantConfig?.subscription;
  const cloudSync = tenantConfig?.cloudSync;
  const isPremium = subscription?.status === "active" || subscription?.status === "trial";

  const [folders, setFolders] = useState([]);
  const [folderPath, setFolderPath] = useState([{ id: null, name: "My Drive" }]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [cadence, setCadence] = useState(cloudSync?.cadence || "24h");
  const [enabled, setEnabled] = useState(cloudSync?.enabled || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Check for OAuth callback result in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("cloudSync");
    if (result === "success") {
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      setError(`Connection failed: ${params.get("reason") || "unknown error"}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Load sync history
  useEffect(() => {
    if (cloudSync?.connectedAt) {
      loadSyncHistory(tenantId, 10).then(setSyncHistory).catch(() => {});
    }
  }, [tenantId, cloudSync?.connectedAt]);

  const isConnected = !!cloudSync?.connectedAt;
  const isConfigured = isConnected && !!cloudSync?.folderId;

  // Start Google OAuth flow
  const connectDrive = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env");
      return;
    }

    const state = btoa(JSON.stringify({ tenantId }));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: OAUTH_REDIRECT_URI,
      response_type: "code",
      scope: DRIVE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, [tenantId]);

  // Disconnect Drive
  const disconnectDrive = useCallback(async () => {
    try {
      const fn = httpsCallable(functions, "cloudSyncDisconnect");
      await fn({ tenantId });
      await updateTenantConfig({ cloudSync: null });
      setSyncHistory([]);
      setFolders([]);
    } catch (err) {
      setError(`Disconnect failed: ${err.message}`);
    }
  }, [tenantId, updateTenantConfig]);

  // Load folders for picker
  const browseFolders = useCallback(async (parentId) => {
    setLoadingFolders(true);
    try {
      const fn = httpsCallable(functions, "cloudSyncListFolders");
      const result = await fn({ tenantId, parentId });
      setFolders(result.data.folders || []);
    } catch (err) {
      setError(`Failed to load folders: ${err.message}`);
    } finally {
      setLoadingFolders(false);
    }
  }, [tenantId]);

  // Open folder in picker
  const openFolder = useCallback((folder) => {
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    browseFolders(folder.id);
  }, [browseFolders]);

  // Navigate back in folder picker
  const navigateToPath = useCallback((index) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    browseFolders(newPath[newPath.length - 1].id);
  }, [folderPath, browseFolders]);

  // Select folder for sync
  const selectFolder = useCallback(async (folder) => {
    setSaving(true);
    try {
      await updateTenantConfig({
        cloudSync: {
          ...cloudSync,
          folderId: folder.id,
          folderName: folder.name,
        },
      });
      setFolders([]);
    } catch (err) {
      setError(`Failed to save folder: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [cloudSync, updateTenantConfig]);

  // Save cadence and enabled state
  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      await updateTenantConfig({
        cloudSync: { ...cloudSync, cadence, enabled },
      });
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [cloudSync, cadence, enabled, updateTenantConfig]);

  // Manual sync
  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "cloudSyncSyncNow");
      await fn({ tenantId });
      // Refresh history
      const history = await loadSyncHistory(tenantId, 10);
      setSyncHistory(history);
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [tenantId]);

  // ─── Premium Gate ────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)",
        border: "1px solid #BAE6FD",
        borderRadius: 12, padding: 24, textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#9729;</div>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0C4A6E", margin: "0 0 8px" }}>
          Cloud Sync — Premium Feature
        </h4>
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>
          Connect Google Drive to automatically sync your data files on a schedule.
          Upgrade to a paid plan to unlock this feature.
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: "10px 24px" }}
          onClick={() => {
            document.getElementById("settings-billing")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Upgrade Plan
        </button>
      </div>
    );
  }

  // ─── Not Connected ───────────────────────────────────────────
  if (!isConnected) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16 }}>
          Connect your Google Drive to automatically pull spreadsheet files from a shared folder.
          Your team updates the files — CruFolio processes them on your schedule.
        </p>
        {error && (
          <div style={{ background: "rgba(197, 48, 48, 0.08)", border: "1px solid rgba(197, 48, 48, 0.2)", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13, color: "#C53030" }}>
            {error}
            <span style={{ float: "right", cursor: "pointer" }} onClick={() => setError(null)}>&times;</span>
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px" }}
          onClick={connectDrive}
        >
          <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
            <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L3.45 44.7c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l6.1 11.3 7.65 12.5z" fill="#EA4335"/>
            <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
            <path d="M59.8 49.2H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.5c1.6 0 3.15-.45 4.5-1.2L59.8 49.2z" fill="#2684FC"/>
            <path d="M73.4 26.5l-12.7-22C59.35 3.1 58.2 2 56.85 1.2L43.65 25l16.15 24.2h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
          </svg>
          Connect Google Drive
        </button>
      </div>
    );
  }

  // ─── Connected — Configure & Monitor ─────────────────────────
  return (
    <div>
      {error && (
        <div style={{ background: "rgba(197, 48, 48, 0.08)", border: "1px solid rgba(197, 48, 48, 0.2)", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13, color: "#C53030" }}>
          {error}
          <span style={{ float: "right", cursor: "pointer" }} onClick={() => setError(null)}>&times;</span>
        </div>
      )}

      {/* Connection status */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(31, 134, 90, 0.08)", border: "1px solid #1F865A", borderRadius: 8,
        padding: 12, marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1F865A", display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1F865A" }}>Google Drive Connected</span>
          {cloudSync?.folderName && (
            <span style={{ fontSize: 12, color: "#6B6B6B" }}>
              — syncing from <strong>{cloudSync.folderName}</strong>
            </span>
          )}
        </div>
        <button
          onClick={disconnectDrive}
          style={{
            padding: "4px 12px", fontSize: 11, fontWeight: 600,
            background: "transparent", border: "1px solid #C53030", color: "#C53030",
            borderRadius: 6, cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Folder picker */}
      {!isConfigured && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2E2E2E", marginBottom: 8 }}>
            Select a folder to sync from:
          </label>
          {folders.length === 0 && !loadingFolders && (
            <button
              className="btn btn-secondary"
              onClick={() => browseFolders(null)}
              style={{ padding: "8px 16px" }}
            >
              Browse Folders
            </button>
          )}
          {loadingFolders && <p style={{ fontSize: 13, color: "#6B6B6B" }}>Loading folders...</p>}
          {folders.length > 0 && (
            <div style={{ border: "1px solid #E5E0DA", borderRadius: 8, overflow: "hidden" }}>
              {/* Breadcrumb */}
              <div style={{ background: "#FDF8F0", padding: "8px 12px", fontSize: 12, color: "#6B6B6B", borderBottom: "1px solid #E5E0DA" }}>
                {folderPath.map((p, i) => (
                  <span key={i}>
                    {i > 0 && " / "}
                    <span
                      style={{ cursor: i < folderPath.length - 1 ? "pointer" : "default", color: i < folderPath.length - 1 ? "#8B6A4C" : "#2E2E2E", fontWeight: i === folderPath.length - 1 ? 600 : 400 }}
                      onClick={() => i < folderPath.length - 1 && navigateToPath(i)}
                    >
                      {p.name}
                    </span>
                  </span>
                ))}
              </div>
              {/* Folder list */}
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {folders.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderBottom: "1px solid #F5EDE3",
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{ cursor: "pointer", color: "#2E2E2E" }}
                      onClick={() => openFolder(f)}
                    >
                      &#128193; {f.name}
                    </span>
                    <button
                      onClick={() => selectFolder(f)}
                      disabled={saving}
                      style={{
                        padding: "4px 12px", fontSize: 11, fontWeight: 600,
                        background: "#1F865A", color: "#fff", border: "none",
                        borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      Select
                    </button>
                  </div>
                ))}
                {folders.length === 0 && (
                  <p style={{ padding: 12, fontSize: 13, color: "#6B6B6B", textAlign: "center" }}>No subfolders</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule settings */}
      {isConfigured && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6B6B", marginBottom: 4 }}>
              Sync Frequency
            </label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB",
                borderRadius: 8, fontSize: 14, background: "#fff",
              }}
            >
              <option value="6h">Every 6 hours</option>
              <option value="12h">Every 12 hours</option>
              <option value="24h">Every 24 hours</option>
            </select>
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: enabled ? "rgba(31, 134, 90, 0.08)" : "#FDF8F0",
            border: `1px solid ${enabled ? "#1F865A" : "#E5E0DA"}`,
            borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Auto-sync enabled
          </label>
          <button
            className="btn btn-primary"
            onClick={saveSettings}
            disabled={saving}
            style={{ padding: "8px 16px", whiteSpace: "nowrap" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={syncNow}
            disabled={syncing}
            style={{
              padding: "8px 16px", whiteSpace: "nowrap",
              background: syncing ? "#D1D5DB" : "#8B6A4C",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: syncing ? "default" : "pointer",
            }}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      )}

      {/* Change folder */}
      {isConfigured && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => {
              setFolders([]);
              setFolderPath([{ id: null, name: "My Drive" }]);
              browseFolders(null);
              updateTenantConfig({
                cloudSync: { ...cloudSync, folderId: null, folderName: null },
              });
            }}
            style={{
              padding: "4px 12px", fontSize: 11, color: "#6B6B6B",
              background: "transparent", border: "1px solid #D1D5DB",
              borderRadius: 6, cursor: "pointer",
            }}
          >
            Change Folder
          </button>
        </div>
      )}

      {/* Sync history */}
      {syncHistory.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#2E2E2E", marginBottom: 8 }}>
            Recent Syncs
          </h4>
          <div style={{ border: "1px solid #E5E0DA", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6B6B6B" }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6B6B6B" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6B6B6B" }}>Files</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6B6B6B" }}>Rows</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6B6B6B" }}>Trigger</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((h, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #F5EDE3" }}>
                    <td style={{ padding: "8px 12px", color: "#2E2E2E" }}>
                      {h.startedAt ? new Date(h.startedAt).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <StatusBadge status={h.status} />
                    </td>
                    <td style={{ padding: "8px 12px", color: "#2E2E2E" }}>
                      {h.filesProcessed || 0}
                      {h.fileNames?.length > 0 && (
                        <span style={{ color: "#6B6B6B", marginLeft: 4 }} title={h.fileNames.join(", ")}>
                          ({h.fileNames[0]}{h.fileNames.length > 1 ? ` +${h.fileNames.length - 1}` : ""})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#2E2E2E" }}>{h.rowsIngested || 0}</td>
                    <td style={{ padding: "8px 12px", color: "#6B6B6B" }}>{h.triggeredBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {syncHistory.some((h) => h.error) && (
            <div style={{ marginTop: 8 }}>
              {syncHistory.filter((h) => h.error).slice(0, 1).map((h, i) => (
                <p key={i} style={{ fontSize: 11, color: "#C53030" }}>
                  Last error: {h.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
