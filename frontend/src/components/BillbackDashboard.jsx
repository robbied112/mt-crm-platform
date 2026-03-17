/**
 * BillbackDashboard — Trade spend analytics by wine, distributor, and type.
 */
import { useState } from "react";

const TYPE_COLORS = {
  "depletion allowance": "#6B1E1E",
  "marketing": "#2563eb",
  "sampling": "#B87333",
  "placement fee": "#dc2626",
  "price reduction": "#d97706",
  "other": "#6b7280",
};

function getTypeColor(type) {
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.other;
}

export default function BillbackDashboard({ spendByWine = [], spendByDistributor = [], billbackSummary = {}, filters }) {
  const [view, setView] = useState("wine");

  if (!spendByWine.length && !spendByDistributor.length) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#128203;</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>
          No billback data yet
        </h3>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          Upload a PDF billback from Settings &gt; Data Import to see your trade spend analytics.
        </p>
      </div>
    );
  }

  const summary = billbackSummary || {};
  const byType = summary.byType || {};
  const totalTypeSpend = Object.values(byType).reduce((s, v) => s + v, 0) || 1;

  return (
    <div>
      {/* KPI Row */}
      <div style={s.kpiGrid}>
        <div style={s.kpiCard}>
          <div style={s.kpiValue}>${(summary.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={s.kpiLabel}>Total Spend</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiValue}>{summary.totalBillbacks || 0}</div>
          <div style={s.kpiLabel}>Total Billbacks</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiValue}>{summary.totalWines || 0}</div>
          <div style={s.kpiLabel}>Wines Tracked</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiValue}>${(summary.avgSpendPerCase || 0).toFixed(2)}</div>
          <div style={s.kpiLabel}>Avg Spend/Case</div>
        </div>
      </div>

      {/* Spend by Type Bar */}
      {Object.keys(byType).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>
            Spend by Type
          </div>
          <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
              <div
                key={type}
                style={{
                  width: `${(amount / totalTypeSpend) * 100}%`,
                  background: getTypeColor(type),
                  minWidth: amount > 0 ? 4 : 0,
                }}
                title={`${type}: $${amount.toLocaleString()}`}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11 }}>
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: getTypeColor(type) }} />
                <span style={{ color: "#6B7280" }}>{type}: </span>
                <span style={{ fontWeight: 600 }}>${amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button
          className={`btn ${view === "wine" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setView("wine")}
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          By Wine
        </button>
        <button
          className={`btn ${view === "distributor" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setView("distributor")}
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          By Distributor
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {view === "wine" ? (
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#FDF8F0" }}>
                <th style={s.th}>Wine</th>
                <th style={s.th}>Producer</th>
                <th style={{ ...s.th, textAlign: "right" }}>Total Spend</th>
                <th style={{ ...s.th, textAlign: "right" }}>Qty</th>
                <th style={{ ...s.th, textAlign: "right" }}>Spend/Case</th>
                <th style={s.th}>Distributors</th>
                <th style={s.th}>Last Date</th>
              </tr>
            </thead>
            <tbody>
              {spendByWine.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{row.wine}</td>
                  <td style={s.td}>{row.producer}</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: "#6B1E1E" }}>
                    ${row.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...s.td, textAlign: "right" }}>{row.totalQty}</td>
                  <td style={{ ...s.td, textAlign: "right" }}>${row.spendPerCase.toFixed(2)}</td>
                  <td style={{ ...s.td, fontSize: 11, color: "#6B7280" }}>{row.distributors.join(", ")}</td>
                  <td style={{ ...s.td, fontSize: 11, color: "#9CA3AF" }}>{row.lastDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#FDF8F0" }}>
                <th style={s.th}>Distributor</th>
                <th style={{ ...s.th, textAlign: "right" }}>Total Spend</th>
                <th style={{ ...s.th, textAlign: "right" }}>Qty</th>
                <th style={{ ...s.th, textAlign: "right" }}>Spend/Case</th>
                <th style={s.th}>Wines</th>
                <th style={s.th}>Last Date</th>
              </tr>
            </thead>
            <tbody>
              {spendByDistributor.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{row.dist}</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: "#6B1E1E" }}>
                    ${row.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...s.td, textAlign: "right" }}>{row.totalQty}</td>
                  <td style={{ ...s.td, textAlign: "right" }}>${row.spendPerCase.toFixed(2)}</td>
                  <td style={{ ...s.td, fontSize: 11, color: "#6B7280" }}>{row.wines.join(", ")}</td>
                  <td style={{ ...s.td, fontSize: 11, color: "#9CA3AF" }}>{row.lastDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Date Range */}
      {summary.dateRange && (summary.dateRange.earliest || summary.dateRange.latest) && (
        <div style={{ marginTop: 16, fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
          Data range: {summary.dateRange.earliest || "?"} to {summary.dateRange.latest || "?"}
        </div>
      )}
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
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
    color: "#6B7280",
    marginTop: 2,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "8px 10px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    color: "#6B7280",
    letterSpacing: "0.3px",
  },
  td: {
    padding: "8px 10px",
  },
};
