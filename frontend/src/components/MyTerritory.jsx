/**
 * MyTerritory component
 * Extracted from index.html renderMyTerritory() (lines 3326-3573).
 * The default "home" tab showing a territory overview with KPIs,
 * goal progress, attention items, accounts list, pipeline, and activity.
 */

import { useMemo } from "react";
import KpiCard from "./KpiCard";
import GoalProgress from "./GoalProgress";
import AttentionNeeded from "./AttentionNeeded";
import PipelineSummary from "./PipelineSummary";
import RecentActivity from "./RecentActivity";
import MyAccountsList from "./MyAccountsList";
import { matchesUserTerritory } from "../utils/territory";
import { getFilteredData } from "../utils/filterData";
import { t } from "../utils/terminology";
import TENANT_CONFIG from "../config/tenant";

export default function MyTerritory({
  user,
  filters,
  distScorecard = [],
  reorderData = [],
  accountsTop = [],
  pipelineAccounts = [],
  pipelineMeta = {},
  qbDistOrders = {},
  newWins = [],
  recentActivity = [],
  myAccounts = [],
  onAccountClick,
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Apply filters to scorecard, restricted by territory
  const filteredDists = useMemo(
    () => getFilteredData(distScorecard, filters, user),
    [distScorecard, filters, user]
  );

  // --- Compute KPIs ---
  const totalCE = filteredDists.reduce((s, d) => s + (d.ce || 0), 0);
  const activeAccts = filteredDists.length;

  // Active pipeline deals (not Closed Won/Lost/Identified, in territory)
  const activePipelineDeals = useMemo(
    () =>
      pipelineAccounts.filter((p) => {
        if (
          !p.acct ||
          p.stage === "Closed Won" ||
          p.stage === "Closed Lost" ||
          p.stage === "Identified"
        )
          return false;
        const meta =
          pipelineMeta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
        const st = meta.state || p.state || "";
        return matchesUserTerritory(st, user);
      }),
    [pipelineAccounts, pipelineMeta, user]
  );

  // Overdue reorders in territory
  const overdueReorders = useMemo(
    () =>
      reorderData.filter(
        (r) =>
          r.days > r.cycle &&
          r.cycle > 0 &&
          matchesUserTerritory(r.st, user)
      ).length,
    [reorderData, user]
  );

  // --- Build attention items ---
  const attentionItems = useMemo(() => {
    const items = [];

    // Overdue reorders
    reorderData
      .filter(
        (r) =>
          r.days > r.cycle &&
          r.cycle > 0 &&
          matchesUserTerritory(r.st, user)
      )
      .slice(0, 5)
      .forEach((r) => {
        items.push({
          type: "Overdue Reorder",
          account: r.acct,
          detail: `${r.days - r.cycle} days overdue`,
          color: "#DC2626",
        });
      });

    // Stalling pipeline deals
    pipelineAccounts
      .filter((p) => {
        if (
          !p.acct ||
          p.stage === "Identified" ||
          p.stage === "Closed Won" ||
          p.stage === "Closed Lost"
        )
          return false;
        const meta =
          pipelineMeta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
        const st = meta.state || p.state || "";
        return matchesUserTerritory(st, user);
      })
      .forEach((p) => {
        const meta =
          pipelineMeta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
        const stageDate = meta.stageDate
          ? new Date(meta.stageDate)
          : new Date("2026-02-20");
        const daysSinceStage = Math.floor(
          (today - stageDate) / 86400000
        );
        if (daysSinceStage > 21) {
          items.push({
            type: "Stalling Deal",
            account: p.acct,
            detail: `${daysSinceStage} days in ${p.stage}`,
            color: "#F59E0B",
          });
        }
      });

    // Declining accounts
    accountsTop
      .filter((a) => {
        const avg13w = (a.ce || 0) / 13;
        return (
          (a.w4 || 0) < avg13w * 0.5 &&
          (a.ce || 0) > 1 &&
          matchesUserTerritory(a.st, user)
        );
      })
      .slice(0, 3)
      .forEach((a) => {
        items.push({
          type: "Declining",
          account: a.acct,
          detail: `${t("shortPeriod")} velocity dropping (${(a.w4 || 0).toFixed(1)} ${t("volume")} vs ${((a.ce || 0) / 13).toFixed(1)} avg)`,
          color: "#9333EA",
        });
      });

    return items;
  }, [reorderData, pipelineAccounts, pipelineMeta, accountsTop, user, today]);

  // --- Goal progress data ---
  const goals = TENANT_CONFIG.goals || {};
  const uniqueStates = new Set(
    filteredDists.map((d) => d.st).filter(Boolean)
  ).size;
  const totalAccounts = accountsTop.filter((a) =>
    matchesUserTerritory(a.st, user)
  ).length;
  const totalRevenue = Object.values(qbDistOrders).reduce(
    (s, d) => s + (d.total || 0),
    0
  );
  const newWinsCount = newWins.filter((w) =>
    matchesUserTerritory(w.st, user)
  ).length;

  // --- Pipeline deals with resolved stage from meta ---
  const resolvedDeals = useMemo(
    () =>
      activePipelineDeals.map((p) => {
        const meta =
          pipelineMeta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
        return { ...p, stage: meta.stage || p.stage };
      }),
    [activePipelineDeals, pipelineMeta]
  );

  // --- Early-exit renders (after all hooks) ---
  if (!distScorecard || distScorecard.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128202;</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          No Data Yet
        </div>
        <div style={{ fontSize: 14 }}>
          Upload your {t("distributor").toLowerCase()} data or explore with sample data to get started.
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          Sign In Required
        </div>
        <div style={{ fontSize: 14 }}>
          Please sign in to view your territory dashboard.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Welcome Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)",
          color: "#fff",
          padding: "24px 24px",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            margin: "0 0 4px 0",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Welcome back, {user.name}
        </h2>
        <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>{todayStr}</p>
      </div>

      {/* Quick Stats */}
      <div className="kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard
          label={`Total ${t("longPeriod")} ${t("volume")}`}
          value={totalCE.toFixed(0)}
        />
        <KpiCard label={`Active ${t("account")}s`} value={activeAccts} />
        <div className="kpi-card">
          <div className="kpi-label">Pipeline Deals</div>
          <div className="kpi-value" style={{ color: "#7C3AED" }}>
            {activePipelineDeals.length}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Overdue Reorders</div>
          <div className="kpi-value" style={{ color: "#DC2626" }}>
            {overdueReorders}
          </div>
        </div>
      </div>

      {/* Goal Progress */}
      <GoalProgress
        goals={goals}
        totalCE={totalCE}
        totalAccounts={totalAccounts}
        totalRevenue={totalRevenue}
        uniqueStates={uniqueStates}
        activeDists={filteredDists.length}
        newWinsCount={newWinsCount}
      />

      {/* Attention Needed */}
      <AttentionNeeded items={attentionItems} />

      {/* My Accounts */}
      <MyAccountsList
        accounts={myAccounts}
        onAccountClick={onAccountClick}
      />

      {/* Pipeline Summary */}
      <PipelineSummary deals={resolvedDeals} />

      {/* Recent Activity */}
      <RecentActivity activities={recentActivity} />
    </div>
  );
}
