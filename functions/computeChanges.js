/**
 * Deterministic change detection — compares current views against
 * the previous briefing's analysis to find what changed.
 * Pure function, no Firebase imports.
 *
 * Schema reference (from transformData.js):
 *   distScorecard: { name, st, ce, w4, momentum, con, weekly }
 *   accountsTop:   { acct, dist, st, ch, ce, total, rank, ... }
 *   reorderData:   { acct, dist, st, ce, days, cycle, priority, ... }
 *   inventoryData: { st, oh, doh, status }
 *   revenueSummary: { ytdTotal, annualRunRate, topChannel, topSku, ... } (object, not array)
 */

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

function sumField(arr, field) {
  return safeArray(arr).reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function findPrevStat(prevStats, tab) {
  return safeArray(prevStats).find((s) => s.tab === tab);
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function formatNum(n) {
  if (n == null || isNaN(n)) return "0";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

/**
 * Compute deterministic changes from views data.
 * @param {object} currentViews - { distScorecard, accountsTop, reorderData, inventoryData, revenueSummary, ... }
 * @param {object|null} previousAnalysis - { changes, drillDownStats, _rawStats } from prior briefing, or null
 * @returns {{ changes, risks, drillDownStats, _rawStats, isFirstBriefing }}
 */
function computeChanges(currentViews, previousAnalysis) {
  const views = currentViews || {};
  const prev = previousAnalysis || null;
  const isFirstBriefing = !prev;
  const prevRaw = prev?._rawStats || {};

  const distScorecard = safeArray(views.distScorecard);
  const accountsTop = safeArray(views.accountsTop);
  const reorderData = safeArray(views.reorderData);
  const inventoryData = safeArray(views.inventoryData);
  // revenueSummary is an object, not an array
  const revenueSummary = (views.revenueSummary && typeof views.revenueSummary === "object" && !Array.isArray(views.revenueSummary))
    ? views.revenueSummary
    : {};

  const changes = [];
  const risks = [];

  // --- Compute current stats (using real pipeline field names) ---
  const totalCases = sumField(distScorecard, "ce");
  const accountCount = accountsTop.length;
  const inventoryItems = inventoryData.length;
  const avgDOH = inventoryItems > 0
    ? Math.round(sumField(inventoryData, "doh") / inventoryItems)
    : 0;
  // Overdue: days since last order > 1.5x the order cycle (matches pipeline logic)
  const overdueCount = reorderData.filter((r) =>
    (r.days || 0) > (r.cycle || 999) * 1.5
  ).length;
  const totalRevenue = Number(revenueSummary.ytdTotal) || 0;

  // Store raw numeric stats for next briefing's comparison (avoid formatNum round-trip)
  const _rawStats = { totalCases, accountCount, avgDOH, overdueCount, totalRevenue };

  // --- Changes detection (only for non-first briefings) ---
  if (!isFirstBriefing) {
    // Volume change (compare raw numbers, not formatted strings)
    if (prevRaw.totalCases != null) {
      const pct = pctChange(totalCases, prevRaw.totalCases);
      if (pct !== null && Math.abs(pct) > 5) {
        changes.push({
          direction: pct > 0 ? "up" : "down",
          title: `Total depletions ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}%`,
          detail: `${formatNum(totalCases)} cases vs ${formatNum(prevRaw.totalCases)} previously`,
          evidence: { tab: "depletions", filter: {} },
          impact: Math.abs(pct) > 15 ? "high" : "medium",
        });
      }
    }

    // Account count change
    if (prevRaw.accountCount != null) {
      const delta = accountCount - prevRaw.accountCount;
      if (Math.abs(delta) > 0) {
        changes.push({
          direction: delta > 0 ? "up" : "down",
          title: `${Math.abs(delta)} account${Math.abs(delta) !== 1 ? "s" : ""} ${delta > 0 ? "added" : "lost"}`,
          detail: `${accountCount} active accounts (was ${prevRaw.accountCount})`,
          evidence: { tab: "account-insights", filter: {} },
          impact: Math.abs(delta) > 3 ? "high" : "low",
        });
      }
    }

    // Revenue change
    if (totalRevenue > 0 && prevRaw.totalRevenue != null && prevRaw.totalRevenue > 0) {
      const pct = pctChange(totalRevenue, prevRaw.totalRevenue);
      if (pct !== null && Math.abs(pct) > 3) {
        changes.push({
          direction: pct > 0 ? "up" : "down",
          title: `Revenue ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}%`,
          detail: `$${formatNum(totalRevenue)} vs $${formatNum(prevRaw.totalRevenue)} previously`,
          evidence: { tab: "revenue", filter: {} },
          impact: Math.abs(pct) > 10 ? "high" : "medium",
        });
      }
    }
  }

  // --- Risks (always computed, first or subsequent) ---
  if (overdueCount > 0) {
    risks.push({
      type: "pipeline",
      title: `${overdueCount} overdue reorder${overdueCount !== 1 ? "s" : ""}`,
      detail: "Accounts past their expected reorder cycle",
      quantifiedImpact: `${overdueCount} account${overdueCount !== 1 ? "s" : ""} may stop buying`,
    });
  }

  const lowStock = inventoryData.filter((item) => (item.doh || 0) < 14 && (item.doh || 0) > 0);
  if (lowStock.length > 0) {
    risks.push({
      type: "inventory",
      title: `${lowStock.length} SKU${lowStock.length !== 1 ? "s" : ""} with <14 days on hand`,
      detail: lowStock.slice(0, 3).map((s) => s.st || "Unknown").join(", "),
      quantifiedImpact: "Risk of stockout within 2 weeks",
    });
  }

  const overstock = inventoryData.filter((item) => (item.doh || 0) > 90);
  if (overstock.length > 0) {
    risks.push({
      type: "inventory",
      title: `${overstock.length} SKU${overstock.length !== 1 ? "s" : ""} overstocked (>90 DOH)`,
      detail: overstock.slice(0, 3).map((s) => s.st || "Unknown").join(", "),
      quantifiedImpact: "Capital tied up in slow-moving inventory",
    });
  }

  // --- Drill-down stats (always computed from current views) ---
  const drillDownStats = [
    {
      tab: "depletions",
      headline: "Total Cases",
      value: formatNum(totalCases),
      trend: isFirstBriefing ? "" : (changes.find((c) => c.evidence?.tab === "depletions")?.title || "stable"),
    },
    {
      tab: "accounts",
      headline: "Active Accounts",
      value: String(accountCount),
      trend: isFirstBriefing ? "" : (changes.find((c) => c.evidence?.tab === "account-insights")?.title || "stable"),
    },
    {
      tab: "inventory",
      headline: "Avg Days on Hand",
      value: String(avgDOH),
      trend: "",
    },
    {
      tab: "reorder",
      headline: "Overdue Reorders",
      value: String(overdueCount),
      trend: overdueCount > 0 ? "needs attention" : "clear",
    },
  ];

  if (totalRevenue > 0) {
    drillDownStats.push({
      tab: "revenue",
      headline: "Total Revenue",
      value: `$${formatNum(totalRevenue)}`,
      trend: isFirstBriefing ? "" : (changes.find((c) => c.evidence?.tab === "revenue")?.title || "stable"),
    });
  }

  return { changes, risks, drillDownStats, _rawStats, isFirstBriefing };
}

module.exports = { computeChanges };
