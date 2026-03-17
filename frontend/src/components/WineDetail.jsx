/**
 * WineDetail — detail page for a single wine entity with spend history.
 */
import { useParams, useNavigate } from "react-router-dom";

export default function WineDetail({ wines = [], spendByWine = [] }) {
  const { wineId } = useParams();
  const navigate = useNavigate();

  const wine = wines.find((w) => w.id === wineId);
  const spendData = spendByWine.find((s) => s.wine === wine?.name || s.wine === wine?.displayName);

  if (!wine) {
    return (
      <div style={s.emptyState}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2E2E2E", margin: "0 0 8px" }}>
          Wine not found
        </h3>
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16 }}>
          This wine may have been removed or the link is invalid.
        </p>
        <button className="btn btn-secondary" onClick={() => navigate("/wines")}>
          &#8592; Back to Wines
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        className="btn btn-secondary"
        onClick={() => navigate("/wines")}
        style={{ marginBottom: 16, fontSize: 12 }}
      >
        &#8592; Back to Wines
      </button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {wine.displayName || wine.name}
          </h2>
          {wine.vintage && (
            <span style={s.vintageBadge}>{wine.vintage}</span>
          )}
        </div>
        {wine.producer && (
          <p style={{ margin: 0, fontSize: 13, color: "#6B6B6B" }}>
            Producer: {wine.producer}
          </p>
        )}
      </div>

      {/* KPIs */}
      {spendData ? (
        <div style={s.kpiGrid}>
          <div style={s.kpiCard}>
            <div style={s.kpiValue}>
              ${spendData.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={s.kpiLabel}>Total Spend</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiValue}>{spendData.totalQty}</div>
            <div style={s.kpiLabel}>Cases</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiValue}>${spendData.spendPerCase.toFixed(2)}</div>
            <div style={s.kpiLabel}>Spend/Case</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiValue}>{spendData.billbackCount}</div>
            <div style={s.kpiLabel}>Billback Count</div>
          </div>
        </div>
      ) : (
        <div style={{ background: "#FDF8F0", borderRadius: 8, padding: 16, border: "1px solid #E5E0DA", marginBottom: 20, fontSize: 13, color: "#6B6B6B" }}>
          No spend data available for this wine yet.
        </div>
      )}

      {/* Distributors */}
      {spendData?.distributors?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>
            Distributors
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {spendData.distributors.map((dist) => (
              <span key={dist} style={s.distBadge}>{dist}</span>
            ))}
          </div>
        </div>
      )}

      {/* Billback Types */}
      {spendData?.types?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>
            Billback Types
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {spendData.types.map((type) => (
              <span key={type} style={s.typeBadge}>{type}</span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 24 }}>
        {wine.metadata?.distributors?.length > 0 && (
          <div>Source distributors: {wine.metadata.distributors.join(", ")}</div>
        )}
        {spendData?.lastDate && <div>Last billback: {spendData.lastDate}</div>}
      </div>
    </div>
  );
}

const s = {
  emptyState: {
    textAlign: "center",
    padding: 48,
    background: "#FDF8F0",
    borderRadius: 12,
    border: "1px solid #E5E0DA",
  },
  vintageBadge: {
    background: "#FDF8F0",
    color: "#6B1E1E",
    padding: "2px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    background: "#FDF8F0",
    borderRadius: 8,
    padding: "12px 14px",
    textAlign: "center",
    border: "1px solid #E5E0DA",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#6B1E1E",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#6B6B6B",
    marginTop: 2,
  },
  distBadge: {
    background: "#eff6ff",
    color: "#1e40af",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  typeBadge: {
    background: "#f5f3ff",
    color: "#7c3aed",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
};
