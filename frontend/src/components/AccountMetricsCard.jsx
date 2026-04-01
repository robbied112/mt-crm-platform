/**
 * AccountMetricsCard — data-derived metrics shown at the top of AccountDetailPage.
 *
 * Bridges the dashboard data (views/) with the CRM account detail view.
 * Shows: volume trend, last order, reorder status, and distributor health.
 *
 * TODO-400: Account-Level Dashboard Metrics on CRM Pages
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";

/**
 * Fuzzy-match an account name against view data.
 * Tries exact match first, then normalized lowercase, then prefix.
 */
function findAccountInData(rows, accountName) {
  if (!accountName || !rows?.length) return null;
  const lower = accountName.toLowerCase().trim();

  // Exact match on acct or name
  let match = rows.find(
    (r) => (r.acct || r.name || "").toLowerCase().trim() === lower
  );
  if (match) return match;

  // Prefix match (handles "Bevmo" matching "Bevmo - Store #123")
  match = rows.find(
    (r) => (r.acct || r.name || "").toLowerCase().trim().startsWith(lower)
  );
  if (match) return match;

  // Reverse prefix (account name starts with row name)
  match = rows.find((r) => {
    const rowName = (r.acct || r.name || "").toLowerCase().trim();
    return rowName && lower.startsWith(rowName);
  });
  return match;
}

/**
 * Compute month-over-month trend from scorecard data.
 */
function computeVolumeTrend(row) {
  if (!row) return null;

  // Try month columns (m0 = most recent, m1 = prior, etc.)
  const m0 = row._m0 ?? row.m0 ?? null;
  const m1 = row._m1 ?? row.m1 ?? null;

  if (m0 != null && m1 != null && m1 > 0) {
    const pctChange = ((m0 - m1) / m1) * 100;
    return {
      current: m0,
      previous: m1,
      pctChange,
      direction: pctChange > 0 ? "up" : pctChange < 0 ? "down" : "flat",
    };
  }

  // Fallback: w4 (4-week) vs overall average
  if (row.w4 != null && row.ce != null && row.ce > 0) {
    const avgWeekly = row.ce / 13;
    const pctChange = avgWeekly > 0 ? ((row.w4 - avgWeekly) / avgWeekly) * 100 : 0;
    return {
      current: row.w4,
      previous: avgWeekly,
      pctChange,
      direction: pctChange > 5 ? "up" : pctChange < -5 ? "down" : "flat",
    };
  }

  return null;
}

/**
 * Compute reorder status for an account.
 */
function computeReorderStatus(reorderRows) {
  if (!reorderRows?.length) return null;

  const overdue = reorderRows.filter((r) => r.days > r.cycle && r.cycle > 0);
  const onTrack = reorderRows.filter((r) => r.days <= r.cycle || r.cycle <= 0);

  if (overdue.length > 0) {
    const worstOverdue = Math.max(...overdue.map((r) => r.days - r.cycle));
    return {
      status: "overdue",
      overdueCount: overdue.length,
      totalTracked: reorderRows.length,
      worstOverdue,
    };
  }

  return {
    status: "on-track",
    overdueCount: 0,
    totalTracked: reorderRows.length,
  };
}

const METRIC_STYLES = {
  up: { color: "#1F865A", bg: "rgba(31, 134, 90, 0.08)", arrow: "\u25B2" },
  down: { color: "#C53030", bg: "rgba(197, 48, 48, 0.08)", arrow: "\u25BC" },
  flat: { color: "#6B6B6B", bg: "rgba(107, 107, 107, 0.06)", arrow: "\u2014" },
};

export { findAccountInData, computeVolumeTrend, computeReorderStatus };

export default function AccountMetricsCard({ accountName }) {
  const navigate = useNavigate();
  const {
    distScorecard,
    reorderData,
    distHealth,
    availability,
  } = useData();

  const metrics = useMemo(() => {
    if (!accountName) return null;

    const scorecardRow = findAccountInData(distScorecard, accountName);
    const healthRow = findAccountInData(distHealth, accountName);
    const lower = accountName.toLowerCase().trim();
    const reorderRows = (reorderData || []).filter(
      (r) =>
        (r.acct || r.account || "").toLowerCase().trim() === lower ||
        (r.acct || r.account || "").toLowerCase().trim().startsWith(lower)
    );

    const volumeTrend = computeVolumeTrend(scorecardRow);
    const reorderStatus = computeReorderStatus(reorderRows);

    // Last order date
    let lastOrder = null;
    if (scorecardRow?.lastOrder) {
      lastOrder = scorecardRow.lastOrder;
    } else if (reorderRows.length > 0) {
      lastOrder = reorderRows[0]?.lastOrder || null;
    }

    // Days since last order
    let daysSinceOrder = null;
    if (lastOrder) {
      const orderDate = new Date(lastOrder);
      if (!isNaN(orderDate)) {
        daysSinceOrder = Math.floor((Date.now() - orderDate) / 86400000);
      }
    }

    // Health score (from distHealth if available)
    let healthScore = null;
    if (healthRow) {
      healthScore = healthRow.score || healthRow.healthScore || null;
    }

    const hasAnyMetric = volumeTrend || reorderStatus || lastOrder || healthScore;
    if (!hasAnyMetric) return null;

    return { volumeTrend, reorderStatus, lastOrder, daysSinceOrder, healthScore, totalCases: scorecardRow?.ce };
  }, [accountName, distScorecard, reorderData, distHealth]);

  // Don't render if no dashboard data at all
  if (!availability.hasAnyData || !metrics) return null;

  const { volumeTrend, reorderStatus, lastOrder, daysSinceOrder, healthScore, totalCases } = metrics;

  return (
    <div className="account-metrics">
      {/* Volume Trend */}
      {volumeTrend && (
        <button
          className="account-metrics__card"
          onClick={() => navigate("/depletions")}
          title="View Depletions"
        >
          <div className="account-metrics__label">Volume Trend</div>
          <div className="account-metrics__value">
            <span
              className="account-metrics__trend"
              style={{
                color: METRIC_STYLES[volumeTrend.direction].color,
                background: METRIC_STYLES[volumeTrend.direction].bg,
              }}
            >
              {METRIC_STYLES[volumeTrend.direction].arrow}{" "}
              {Math.abs(volumeTrend.pctChange).toFixed(1)}%
            </span>
          </div>
          {totalCases != null && (
            <div className="account-metrics__detail">
              {Math.round(totalCases).toLocaleString()} total cases
            </div>
          )}
        </button>
      )}

      {/* Last Order */}
      {lastOrder && (
        <button
          className="account-metrics__card"
          onClick={() => navigate("/reorder")}
          title="View Reorder Forecast"
        >
          <div className="account-metrics__label">Last Order</div>
          <div className="account-metrics__value">
            {daysSinceOrder != null ? (
              <span style={{ color: daysSinceOrder > 30 ? "#C07B01" : "var(--text)" }}>
                {daysSinceOrder} days ago
              </span>
            ) : (
              <span>{lastOrder}</span>
            )}
          </div>
        </button>
      )}

      {/* Reorder Status */}
      {reorderStatus && (
        <button
          className="account-metrics__card"
          onClick={() => navigate("/reorder")}
          title="View Reorder Forecast"
        >
          <div className="account-metrics__label">Reorder Status</div>
          <div className="account-metrics__value">
            {reorderStatus.status === "overdue" ? (
              <span style={{ color: "#C53030" }}>
                {reorderStatus.overdueCount} overdue
              </span>
            ) : (
              <span style={{ color: "#1F865A" }}>On Track</span>
            )}
          </div>
          <div className="account-metrics__detail">
            {reorderStatus.totalTracked} SKU{reorderStatus.totalTracked !== 1 ? "s" : ""} tracked
          </div>
        </button>
      )}

      {/* Health Score */}
      {healthScore != null && (
        <button
          className="account-metrics__card"
          onClick={() => navigate("/distributors")}
          title="View Distributor Health"
        >
          <div className="account-metrics__label">Health Score</div>
          <div className="account-metrics__value">
            <span
              style={{
                color:
                  healthScore >= 70 ? "#1F865A" : healthScore >= 40 ? "#C07B01" : "#C53030",
              }}
            >
              {Math.round(healthScore)}/100
            </span>
          </div>
        </button>
      )}
    </div>
  );
}
