/**
 * ImportHealthDashboard — shows import history, data freshness,
 * and health indicators for each data type.
 */
import { useState, useEffect, useCallback } from "react";
import { useData } from "../context/DataContext";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { loadImports } from "../services/firestoreService";
import usePermissions from "../hooks/usePermissions";

const DATA_TYPE_META = {
  depletion: { label: "Depletion", icon: "📊", recommended: "weekly" },
  quickbooks: { label: "Revenue / QB", icon: "💰", recommended: "monthly" },
  revenue: { label: "Revenue", icon: "💰", recommended: "monthly" },
  inventory: { label: "Inventory", icon: "📦", recommended: "monthly" },
  purchases: { label: "Purchase History", icon: "🛒", recommended: "monthly" },
  pipeline: { label: "Pipeline", icon: "🎯", recommended: "quarterly" },
  product_sheet: { label: "Product Catalog", icon: "🍷", recommended: "quarterly" },
  billback: { label: "Billbacks", icon: "📑", recommended: "monthly" },
};

function daysSince(dateVal) {
  if (!dateVal) return null;
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function freshnessStatus(days, recommended) {
  if (days === null) return { label: "No data", color: "#9CA3AF", status: "missing" };
  const thresholds = {
    weekly: { fresh: 10, stale: 21 },
    monthly: { fresh: 35, stale: 60 },
    quarterly: { fresh: 100, stale: 180 },
  };
  const t = thresholds[recommended] || thresholds.monthly;
  if (days <= t.fresh) return { label: "Fresh", color: "#059669", status: "fresh" };
  if (days <= t.stale) return { label: "Getting stale", color: "#d97706", status: "stale" };
  return { label: "Outdated", color: "#dc2626", status: "outdated" };
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  return d.toLocaleDateString();
}

export default function ImportHealthDashboard() {
  const { tenantId, removeImport } = useData();
  const { canDeleteData } = usePermissions();
  const [uploads, setUploads] = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [uploadsSnap, importsList] = await Promise.all([
        getDocs(
          query(
            collection(db, `tenants/${tenantId}/uploads`),
            orderBy("createdAt", "desc"),
            limit(50)
          )
        ),
        loadImports(tenantId),
      ]);
      setUploads(uploadsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setImports(importsList);
    } catch (err) {
      console.error("[ImportHealth] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Match an upload log entry to its import by fileName + type
  function findImportForUpload(upload) {
    return imports.find(
      (imp) => imp.fileName === upload.fileName && imp.type === upload.type
    );
  }

  async function handleDelete(upload) {
    const matchedImport = findImportForUpload(upload);
    if (!matchedImport) return;

    const confirmed = window.confirm(
      `Delete "${upload.fileName}"? This will remove its data and rebuild your dashboards.`
    );
    if (!confirmed) return;

    setDeleting(upload.id);
    try {
      await removeImport(matchedImport.id, upload.id);
      // Refresh local state
      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
      setImports((prev) => prev.filter((i) => i.id !== matchedImport.id));
    } catch (err) {
      console.error("[ImportHealth] Delete failed:", err);
      alert("Failed to delete upload. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  // Group by data type, find latest for each
  const byType = {};
  for (const upload of uploads) {
    const type = upload.type || "unknown";
    if (!byType[type]) byType[type] = [];
    byType[type].push(upload);
  }

  // Build health cards for known types
  const healthCards = Object.entries(DATA_TYPE_META).map(([type, meta]) => {
    const typeUploads = byType[type] || [];
    const latest = typeUploads[0];
    const days = latest ? daysSince(latest.createdAt) : null;
    const freshness = freshnessStatus(days, meta.recommended);
    const totalRows = typeUploads.reduce((sum, u) => sum + (u.rowCount || 0), 0);

    return {
      type,
      ...meta,
      latest,
      days,
      freshness,
      totalRows,
      uploadCount: typeUploads.length,
    };
  });

  // Overall health score
  const populated = healthCards.filter((c) => c.uploadCount > 0);
  const fresh = healthCards.filter((c) => c.freshness.status === "fresh");
  const healthScore =
    healthCards.length > 0
      ? Math.round((fresh.length / Math.max(populated.length, 3)) * 100)
      : 0;

  if (loading) {
    return (
      <div className="import-health">
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading import health...</p>
      </div>
    );
  }

  const visibleUploads = showAll ? uploads : uploads.slice(0, 10);

  return (
    <div className="import-health">
      {/* Overall Score */}
      <div className="import-health__score">
        <div className="import-health__score-ring" data-score={healthScore}>
          <span className="import-health__score-value">{healthScore}%</span>
        </div>
        <div>
          <div className="import-health__score-label">Data Health Score</div>
          <div className="import-health__score-detail">
            {populated.length} of {healthCards.length} data types populated, {fresh.length} fresh
          </div>
        </div>
      </div>

      {/* Health Cards */}
      <div className="import-health__grid">
        {healthCards.map((card) => (
          <div
            key={card.type}
            className={`import-health__card import-health__card--${card.freshness.status}`}
          >
            <div className="import-health__card-header">
              <span className="import-health__card-icon">{card.icon}</span>
              <span className="import-health__card-type">{card.label}</span>
              <span
                className="import-health__card-status"
                style={{ color: card.freshness.color }}
              >
                {card.freshness.label}
              </span>
            </div>
            {card.latest ? (
              <div className="import-health__card-body">
                <div className="import-health__card-stat">
                  <span className="import-health__card-stat-label">Last upload</span>
                  <span className="import-health__card-stat-value">
                    {card.days === 0
                      ? "Today"
                      : card.days === 1
                      ? "Yesterday"
                      : `${card.days} days ago`}
                  </span>
                </div>
                <div className="import-health__card-stat">
                  <span className="import-health__card-stat-label">Total rows</span>
                  <span className="import-health__card-stat-value">
                    {card.totalRows.toLocaleString()}
                  </span>
                </div>
                <div className="import-health__card-stat">
                  <span className="import-health__card-stat-label">Uploads</span>
                  <span className="import-health__card-stat-value">{card.uploadCount}</span>
                </div>
                <div className="import-health__card-file">{card.latest.fileName}</div>
              </div>
            ) : (
              <div className="import-health__card-empty">
                No {card.label.toLowerCase()} data uploaded yet
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Uploads */}
      {uploads.length > 0 && (
        <div className="import-health__recent">
          <h4 className="import-health__recent-title">Recent Uploads</h4>
          <div className="import-health__recent-list">
            {visibleUploads.map((u) => {
              const hasImport = !!findImportForUpload(u);
              const isDeleting = deleting === u.id;
              return (
                <div key={u.id} className="import-health__recent-item">
                  <span className="import-health__recent-name">{u.fileName}</span>
                  <span className="import-health__recent-type">{u.type || "unknown"}</span>
                  <span className="import-health__recent-rows">
                    {(u.rowCount || 0).toLocaleString()} rows
                  </span>
                  <span className="import-health__recent-date">{formatDate(u.createdAt)}</span>
                  {canDeleteData && hasImport && (
                    <button
                      className="import-health__recent-delete"
                      onClick={() => handleDelete(u)}
                      disabled={isDeleting}
                      title="Delete this upload and rebuild dashboards"
                    >
                      {isDeleting ? "..." : "\u00D7"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {uploads.length > 10 && (
            <button
              className="import-health__show-all"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Show less" : `Show all ${uploads.length} uploads`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
