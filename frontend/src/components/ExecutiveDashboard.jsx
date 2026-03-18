/**
 * Executive Dashboard Tab
 *
 * Cross-dataset rollup — always visible, gracefully hides sections with no data.
 * Sections: KPIs, Inventory Sellout Tracker, Weekly Depletion Trend,
 * Top Distributors, AR/AP Aging, Inventory Snapshot.
 */

import { useMemo } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import { t } from "../utils/terminology";

const AGING_COLORS = {
  current: "#1F865A",
  "1-30": "#8B6A4C",
  "31-60": "#C07B01",
  "61-90": "#B87333",
  "90+": "#C53030",
};

function fmt(v) {
  if (v == null || isNaN(v)) return "$0";
  return "$" + Math.round(v).toLocaleString();
}

function fmtNum(v) {
  if (v == null || isNaN(v)) return "0";
  return Math.round(v).toLocaleString();
}

function AgingTable({ title, data }) {
  if (!data || !data.totalOutstanding) return null;

  return (
    <div className="exec-dash__aging">
      <h3 className="exec-dash__section-title">{title}</h3>
      <div className="exec-dash__aging-buckets">
        {Object.entries(data.buckets).map(([bucket, amount]) => (
          <div
            key={bucket}
            className="exec-dash__aging-bucket"
            style={{ borderLeftColor: AGING_COLORS[bucket] }}
          >
            <span className="exec-dash__aging-label">{bucket}</span>
            <span className="exec-dash__aging-value">{fmt(amount)}</span>
          </div>
        ))}
      </div>
      <div className="exec-dash__aging-summary">
        <span>Total: <strong>{fmt(data.totalOutstanding)}</strong></span>
        <span>Overdue (31+ days): <strong>{fmt(data.overdueTotal)}</strong> ({data.overduePercent}%)</span>
      </div>
      {data.topEntities?.length > 0 && (
        <table className="exec-dash__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Total</th>
              <th>Current</th>
              <th>31-60</th>
              <th>61-90</th>
              <th>90+</th>
            </tr>
          </thead>
          <tbody>
            {data.topEntities.slice(0, 5).map((e) => (
              <tr key={e.name}>
                <td>{e.name}</td>
                <td className="exec-dash__cell-number">{fmt(e.total)}</td>
                <td className="exec-dash__cell-number">{fmt(e.current)}</td>
                <td className="exec-dash__cell-number">{fmt(e["31-60"])}</td>
                <td className="exec-dash__cell-number">{fmt(e["61-90"])}</td>
                <td className="exec-dash__cell-number" style={{ color: e["90+"] > 0 ? "#C53030" : undefined }}>
                  {fmt(e["90+"])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ExecutiveDashboard({
  distScorecard = [],
  inventoryData = [],
  placementSummary = [],
  revenueSummary = {},
  arAgingSummary = {},
  apAgingSummary = {},
}) {
  const hasDepletions = distScorecard.length > 0;
  const hasInventory = inventoryData.length > 0;
  const hasPlacements = placementSummary.length > 0;
  const hasRevenue = revenueSummary.ytdTotal > 0;
  const hasAR = arAgingSummary?.totalOutstanding > 0;
  const hasAP = apAgingSummary?.totalOutstanding > 0;

  // --- KPIs ---
  const total13W = distScorecard.reduce((s, d) => s + (d.ce || 0), 0);
  const totalOH = inventoryData.reduce((s, d) => s + (d.oh || 0), 0);
  const avgDOH = inventoryData.length > 0
    ? Math.round(inventoryData.reduce((s, d) => s + (d.doh || 0), 0) / inventoryData.length)
    : 0;
  const netPlacements = placementSummary.reduce((s, d) => s + (d.net || 0), 0);

  // --- Weekly Depletion Trend (13W line) ---
  const weeklyTrendConfig = useMemo(() => {
    if (!hasDepletions) return null;
    // Aggregate weekly across all distributors
    const weekCount = 13;
    const weeklyTotals = Array(weekCount).fill(0);
    for (const d of distScorecard) {
      const weekly = d.weekly || [];
      for (let i = 0; i < weekCount; i++) {
        weeklyTotals[i] += weekly[i] || 0;
      }
    }
    return {
      type: "line",
      data: {
        labels: Array.from({ length: weekCount }, (_, i) => `W${i + 1}`),
        datasets: [{
          label: "Total CE",
          data: weeklyTotals,
          borderColor: "#6B1E1E",
          backgroundColor: "rgba(107, 30, 30, 0.1)",
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    };
  }, [distScorecard, hasDepletions]);

  // --- Top Distributors by 13W CE ---
  const topDistConfig = useMemo(() => {
    if (!hasDepletions) return null;
    const sorted = [...distScorecard].sort((a, b) => (b.ce || 0) - (a.ce || 0)).slice(0, 8);
    return {
      type: "bar",
      data: {
        labels: sorted.map((d) => (d.name || "").substring(0, 20)),
        datasets: [{
          label: "13W CE",
          data: sorted.map((d) => d.ce || 0),
          backgroundColor: "#6B1E1E",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
      },
    };
  }, [distScorecard, hasDepletions]);

  // --- Inventory Sellout Tracker ---
  const selloutTracker = useMemo(() => {
    if (!hasInventory || totalOH === 0) return null;
    // Simple sellout: if we have depletion data, compute sell rate
    const weeklyRate = hasDepletions
      ? distScorecard.reduce((s, d) => s + ((d.w4 || 0) / 4), 0) // avg per week
      : 0;
    const weeksRemaining = weeklyRate > 0 ? Math.round(totalOH / weeklyRate) : null;
    const pctSold = avgDOH > 0 ? Math.max(0, Math.min(100, Math.round((1 - avgDOH / 180) * 100))) : 0;
    const pace = avgDOH > 90 ? "ahead" : avgDOH > 45 ? "on-pace" : "behind";

    return { pctSold, weeksRemaining, pace };
  }, [hasInventory, totalOH, avgDOH, hasDepletions, distScorecard]);

  const hasAnything = hasDepletions || hasInventory || hasRevenue || hasAR || hasAP;

  if (!hasAnything) {
    return (
      <div className="exec-dash__empty">
        <h2>Executive Dashboard</h2>
        <p>Upload data to see your business at a glance. Depletions, inventory, revenue, and AR/AP data will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="exec-dash">
      {/* KPI Row */}
      <div className="kpi-row">
        {hasDepletions && <KpiCard label={`13W ${t("volume")}`} value={fmtNum(total13W)} />}
        {hasInventory && <KpiCard label="Distributor Inventory" value={fmtNum(totalOH)} subtext={`${avgDOH} avg DOH`} />}
        {hasPlacements && <KpiCard label="Net Placements (30d)" value={fmtNum(netPlacements)} />}
        {hasRevenue && <KpiCard label="YTD Revenue" value={fmt(revenueSummary.ytdTotal)} />}
        {hasAR && <KpiCard label="AR Outstanding" value={fmt(arAgingSummary.totalOutstanding)} />}
      </div>

      {/* Sellout Tracker */}
      {selloutTracker && (
        <div className="exec-dash__section">
          <h3 className="exec-dash__section-title">Inventory Sellout Tracker</h3>
          <div className="exec-dash__sellout">
            <div className="exec-dash__sellout-bar">
              <div
                className={`exec-dash__sellout-fill exec-dash__sellout-fill--${selloutTracker.pace}`}
                style={{ width: `${selloutTracker.pctSold}%` }}
              />
            </div>
            <div className="exec-dash__sellout-info">
              <span>{selloutTracker.pctSold}% sold through</span>
              {selloutTracker.weeksRemaining && (
                <span>{selloutTracker.weeksRemaining} weeks supply remaining</span>
              )}
              <span className={`exec-dash__pace exec-dash__pace--${selloutTracker.pace}`}>
                {selloutTracker.pace === "ahead" ? "Ahead of pace" : selloutTracker.pace === "on-pace" ? "On pace" : "Behind pace"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="charts-row">
        {weeklyTrendConfig && (
          <ChartPanel title={`Weekly ${t("volume")} Trend (13W)`} chartConfig={weeklyTrendConfig} />
        )}
        {topDistConfig && (
          <ChartPanel title={`Top ${t("distributor")}s by 13W CE`} chartConfig={topDistConfig} />
        )}
      </div>

      {/* AR/AP Aging */}
      {(hasAR || hasAP) && (
        <div className="exec-dash__section">
          <div className="exec-dash__aging-row">
            {hasAR && <AgingTable title="Accounts Receivable Aging" data={arAgingSummary} />}
            {hasAP && <AgingTable title="Accounts Payable Aging" data={apAgingSummary} />}
          </div>
        </div>
      )}

      {/* Inventory Snapshot */}
      {hasInventory && (
        <div className="exec-dash__section">
          <h3 className="exec-dash__section-title">Inventory Snapshot</h3>
          <div className="exec-dash__inv-kpis">
            <div className="exec-dash__inv-stat">
              <span className="exec-dash__inv-label">Total OH</span>
              <span className="exec-dash__inv-value">{fmtNum(totalOH)}</span>
            </div>
            <div className="exec-dash__inv-stat">
              <span className="exec-dash__inv-label">Avg DOH</span>
              <span className="exec-dash__inv-value">{avgDOH}</span>
            </div>
            <div className="exec-dash__inv-stat">
              <span className="exec-dash__inv-label">Reorder Items</span>
              <span className="exec-dash__inv-value">
                {inventoryData.filter((i) => i.status === "Reorder Opportunity").length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
