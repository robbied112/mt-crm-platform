/**
 * TeamRollup — Manager Intelligence Dashboard.
 *
 * Shows team-level metrics, per-rep territory performance, team activity feed,
 * and territory comparison. Rendered for admin/manager roles in place of
 * the rep-focused MyTerritory view.
 *
 * TODO-401: Manager Intelligence Dashboard
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCrm } from "../context/CrmContext";
import { useTeam } from "../context/TeamContext";
import { matchesUserTerritory } from "../utils/territory";
import KpiCard from "./KpiCard";

/**
 * Compute per-rep metrics from view data.
 */
function computeRepMetrics(members, distScorecard, reorderData, activities, tasks, territories) {
  return members.map((member) => {
    const userObj = {
      territory: member.territory || "all",
    };

    // Filter scorecard rows by rep's territory (pass territories as 3rd arg)
    const repRows = distScorecard.filter((d) => matchesUserTerritory(d.st, userObj, territories));
    const totalCases = repRows.reduce((s, d) => s + (d.ce || 0), 0);
    const accountCount = repRows.length;

    // Volume trend (w4 vs 13-week average)
    const totalW4 = repRows.reduce((s, d) => s + (d.w4 || 0), 0);
    const avgWeekly = totalCases / 13;
    const volumeTrend = avgWeekly > 0 ? ((totalW4 - avgWeekly) / avgWeekly) * 100 : 0;

    // Overdue reorders in territory
    const overdueReorders = reorderData.filter(
      (r) => r.days > r.cycle && r.cycle > 0 && matchesUserTerritory(r.st, userObj, territories)
    ).length;

    // Activity count (last 7 days) — TeamContext uses .uid not .id
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const memberId = member.uid || member.id;
    const recentActivities = activities.filter(
      (a) => a.loggedBy === memberId && a.date >= weekAgoStr
    ).length;

    // Open tasks
    const openTasks = tasks.filter(
      (t) => t.createdBy === memberId && t.status !== "completed" && t.status !== "cancelled"
    ).length;

    // Last activity date
    const lastActivity = activities
      .filter((a) => a.loggedBy === memberId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];

    return {
      ...member,
      totalCases: Math.round(totalCases),
      accountCount,
      volumeTrend,
      overdueReorders,
      recentActivities,
      openTasks,
      lastActivityDate: lastActivity?.date || null,
      lastActivityType: lastActivity?.type || null,
    };
  });
}

/**
 * Compute territory-level aggregate metrics.
 */
function computeTerritoryMetrics(territories, distScorecard) {
  if (!territories || Object.keys(territories).length === 0) return [];

  return Object.entries(territories).map(([name, states]) => {
    const rows = distScorecard.filter((d) =>
      states.some((st) => (d.st || "").toLowerCase() === st.toLowerCase())
    );
    const totalCases = rows.reduce((s, d) => s + (d.ce || 0), 0);
    const accountCount = rows.length;
    const totalW4 = rows.reduce((s, d) => s + (d.w4 || 0), 0);
    const avgWeekly = totalCases / 13;
    const trend = avgWeekly > 0 ? ((totalW4 - avgWeekly) / avgWeekly) * 100 : 0;

    return {
      name,
      states,
      totalCases: Math.round(totalCases),
      accountCount,
      trend,
    };
  }).sort((a, b) => b.totalCases - a.totalCases);
}

export { computeRepMetrics, computeTerritoryMetrics };

const TREND_COLORS = {
  up: "#1F865A",
  down: "#C53030",
  flat: "#6B6B6B",
};

function TrendBadge({ value }) {
  const direction = value > 2 ? "up" : value < -2 ? "down" : "flat";
  const arrow = direction === "up" ? "\u25B2" : direction === "down" ? "\u25BC" : "\u2014";
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 600,
      color: TREND_COLORS[direction],
      padding: "2px 8px",
      borderRadius: 10,
      background: direction === "up" ? "rgba(31, 134, 90, 0.08)" : direction === "down" ? "rgba(197, 48, 48, 0.08)" : "#F5EDE3",
    }}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function TeamRollup() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { distScorecard, reorderData, availability, tenantConfig } = useData();
  const { activities, tasks } = useCrm();
  const { members } = useTeam();

  // Get territories from tenant config (saved via TeamSetupWizard)
  const territories = tenantConfig?.territories || {};

  const repMetrics = useMemo(
    () => computeRepMetrics(members || [], distScorecard || [], reorderData || [], activities || [], tasks || [], territories),
    [members, distScorecard, reorderData, activities, tasks, territories],
  );

  const territoryMetrics = useMemo(
    () => computeTerritoryMetrics(territories, distScorecard || []),
    [territories, distScorecard],
  );

  // Team-level aggregates
  const teamTotalCases = repMetrics.reduce((s, r) => s + r.totalCases, 0);
  const teamAccountCount = (distScorecard || []).length;
  const teamOverdue = (reorderData || []).filter((r) => r.days > r.cycle && r.cycle > 0).length;
  const activeReps = repMetrics.filter((r) => r.recentActivities > 0).length;

  // Recent team activity (last 10)
  const recentTeamActivity = useMemo(() => {
    return (activities || [])
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 10)
      .map((a) => {
        const member = members?.find((m) => (m.uid || m.id) === a.loggedBy);
        return { ...a, memberName: member?.displayName || a.loggedByName || "Unknown" };
      });
  }, [activities, members]);

  // Intelligence callouts
  const callouts = useMemo(() => {
    const items = [];
    for (const rep of repMetrics) {
      if (rep.volumeTrend < -10 && rep.recentActivities === 0) {
        items.push({
          type: "warning",
          text: `${rep.displayName || rep.email}'s territory is down ${Math.abs(rep.volumeTrend).toFixed(0)}% — no activity in 7 days`,
        });
      }
      if (rep.overdueReorders > 3) {
        items.push({
          type: "alert",
          text: `${rep.displayName || rep.email} has ${rep.overdueReorders} overdue reorders`,
        });
      }
    }
    if (territoryMetrics.length > 1) {
      const best = territoryMetrics[0];
      const worst = territoryMetrics[territoryMetrics.length - 1];
      if (best.trend > 5 && worst.trend < -5) {
        items.push({
          type: "insight",
          text: `${best.name} leads at +${best.trend.toFixed(0)}% — ${worst.name} needs attention at ${worst.trend.toFixed(0)}%`,
        });
      }
    }
    return items.slice(0, 3);
  }, [repMetrics, territoryMetrics]);

  if (!availability.hasAnyData) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B6B6B" }}>
        <p style={{ fontSize: 16 }}>Upload data to see team performance.</p>
      </div>
    );
  }

  return (
    <div className="team-rollup">
      {/* Team KPIs */}
      <div className="kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard label="Team Volume" value={teamTotalCases.toLocaleString()} suffix="cases" />
        <KpiCard label="Active Accounts" value={teamAccountCount} />
        <KpiCard label="Overdue Reorders" value={teamOverdue} />
        <KpiCard label="Active Reps (7d)" value={`${activeReps}/${repMetrics.length}`} />
      </div>

      {/* Intelligence Callouts */}
      {callouts.length > 0 && (
        <div className="team-rollup__callouts" style={{ marginBottom: 24 }}>
          {callouts.map((c, i) => (
            <div
              key={i}
              className="team-rollup__callout"
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 8,
                borderLeft: `3px solid ${c.type === "warning" ? "#C07B01" : c.type === "alert" ? "#C53030" : "#6B1E1E"}`,
                background: c.type === "warning" ? "rgba(192, 123, 1, 0.06)" : c.type === "alert" ? "rgba(197, 48, 48, 0.06)" : "rgba(107, 30, 30, 0.04)",
                color: "var(--text)",
              }}
            >
              {c.text}
            </div>
          ))}
        </div>
      )}

      {/* Per-Rep Performance */}
      <div className="table-container" style={{ marginBottom: 24 }}>
        <h3 className="table-title" style={{ marginBottom: 12 }}>Rep Performance</h3>
        {repMetrics.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No team members yet. Invite your team in Settings.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Rep</th>
                <th>Territory</th>
                <th style={{ textAlign: "right" }}>Volume</th>
                <th style={{ textAlign: "right" }}>Trend</th>
                <th style={{ textAlign: "right" }}>Accounts</th>
                <th style={{ textAlign: "right" }}>Overdue</th>
                <th style={{ textAlign: "right" }}>Activity (7d)</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {repMetrics.map((rep) => (
                <tr key={rep.id}>
                  <td style={{ fontWeight: 600 }}>{rep.displayName || rep.email?.split("@")[0]}</td>
                  <td>{rep.territory === "all" ? "All" : rep.territory || "—"}</td>
                  <td style={{ textAlign: "right" }}>{rep.totalCases.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}><TrendBadge value={rep.volumeTrend} /></td>
                  <td style={{ textAlign: "right" }}>{rep.accountCount}</td>
                  <td style={{ textAlign: "right" }}>
                    {rep.overdueReorders > 0 ? (
                      <span style={{ color: "#C53030", fontWeight: 600 }}>{rep.overdueReorders}</span>
                    ) : (
                      <span style={{ color: "#1F865A" }}>0</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {rep.recentActivities > 0 ? rep.recentActivities : (
                      <span style={{ color: "#C07B01" }}>0</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {rep.lastActivityDate || "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Territory Comparison */}
      {territoryMetrics.length > 1 && (
        <div className="table-container" style={{ marginBottom: 24 }}>
          <h3 className="table-title" style={{ marginBottom: 12 }}>Territory Comparison</h3>
          <div className="team-rollup__territories">
            {territoryMetrics.map((t) => {
              const maxCases = Math.max(...territoryMetrics.map((tm) => tm.totalCases), 1);
              const barWidth = (t.totalCases / maxCases) * 100;
              return (
                <div key={t.name} className="team-rollup__territory-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                    <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{t.accountCount} accts</span>
                      <TrendBadge value={t.trend} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{t.totalCases.toLocaleString()}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#E5E0DA", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        borderRadius: 3,
                        background: t.trend > 2 ? "#1F865A" : t.trend < -2 ? "#C53030" : "#8B6A4C",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Activity Feed */}
      {recentTeamActivity.length > 0 && (
        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Team Activity</h3>
            <button
              className="btn btn-small btn-secondary"
              onClick={() => navigate("/activities")}
            >
              View All
            </button>
          </div>
          {recentTeamActivity.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 100, color: "var(--text)" }}>
                {a.memberName}
              </span>
              <span
                className={`badge ${a.outcome === "positive" ? "badge-green" : a.outcome === "negative" ? "badge-orange" : "badge-blue"}`}
                style={{ fontSize: 11 }}
              >
                {(a.type || "note").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span style={{ flex: 1, color: "var(--text-dim)" }}>
                {a.accountName ? `${a.accountName} — ` : ""}{a.subject || a.notes || ""}
              </span>
              <span style={{ color: "var(--text-dim)", fontSize: 12, whiteSpace: "nowrap" }}>
                {a.date}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
