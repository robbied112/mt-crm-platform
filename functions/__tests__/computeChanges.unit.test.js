const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { computeChanges } = require("../computeChanges");

describe("computeChanges", () => {
  // Uses real pipeline field names: ce (not totalQty), days/cycle (not daysOverdue)
  const baseViews = {
    distScorecard: [
      { name: "RNDC", st: "CA", ce: 500 },
      { name: "SGWS", st: "TX", ce: 300 },
    ],
    accountsTop: [
      { acct: "Total Wine", dist: "RNDC", st: "CA", ce: 200, total: 200, rank: 1 },
      { acct: "Spec's", dist: "SGWS", st: "TX", ce: 150, total: 150, rank: 2 },
    ],
    reorderData: [],
    inventoryData: [
      { st: "CA", oh: 100, doh: 30, status: "Healthy" },
      { st: "TX", oh: 80, doh: 45, status: "Healthy" },
    ],
    revenueSummary: { ytdTotal: 50000, annualRunRate: 100000 },
  };

  it("first briefing: isFirstBriefing true, no changes", () => {
    const result = computeChanges(baseViews, null);
    assert.equal(result.isFirstBriefing, true);
    assert.equal(result.changes.length, 0);
    assert.ok(result.drillDownStats.length > 0);
  });

  it("first briefing: detects risks from current data", () => {
    const views = {
      ...baseViews,
      reorderData: [{ acct: "Acme", days: 45, cycle: 20 }],
      inventoryData: [{ st: "CA", oh: 5, doh: 7, status: "Reorder Now" }],
    };
    const result = computeChanges(views, null);
    assert.ok(result.risks.some((r) => r.type === "pipeline"));
    assert.ok(result.risks.some((r) => r.type === "inventory"));
  });

  it("detects volume change >5% using _rawStats", () => {
    const prev = {
      _rawStats: { totalCases: 700, accountCount: 2, totalRevenue: 50000 },
      drillDownStats: [],
    };
    const result = computeChanges(baseViews, prev);
    assert.equal(result.isFirstBriefing, false);
    const volChange = result.changes.find((c) => c.evidence?.tab === "depletions");
    assert.ok(volChange, "should detect volume change");
    assert.equal(volChange.direction, "up");
  });

  it("detects account count delta", () => {
    const views = {
      ...baseViews,
      accountsTop: [...baseViews.accountsTop, { acct: "New Account", ce: 50, total: 50, rank: 3 }],
    };
    const prev = {
      _rawStats: { totalCases: 800, accountCount: 2, totalRevenue: 50000 },
      drillDownStats: [],
    };
    const result = computeChanges(views, prev);
    const acctChange = result.changes.find((c) => c.evidence?.tab === "account-insights");
    assert.ok(acctChange, "should detect new account");
    assert.equal(acctChange.direction, "up");
  });

  it("handles empty/undefined views gracefully", () => {
    const result = computeChanges({}, null);
    assert.equal(result.isFirstBriefing, true);
    assert.equal(result.changes.length, 0);
    assert.ok(result.drillDownStats.length > 0);
  });

  it("handles undefined views parameter", () => {
    const result = computeChanges(undefined, null);
    assert.equal(result.isFirstBriefing, true);
  });

  it("computes drillDownStats using ce field", () => {
    const result = computeChanges(baseViews, null);
    const deplStat = result.drillDownStats.find((s) => s.tab === "depletions");
    assert.ok(deplStat);
    assert.equal(deplStat.value, "800");

    const acctStat = result.drillDownStats.find((s) => s.tab === "accounts");
    assert.ok(acctStat);
    assert.equal(acctStat.value, "2");
  });

  it("detects overstock risk (>90 DOH)", () => {
    const views = {
      ...baseViews,
      inventoryData: [{ st: "CA", oh: 500, doh: 120, status: "Reduce" }],
    };
    const result = computeChanges(views, null);
    const overstockRisk = result.risks.find((r) => r.title.includes("overstocked"));
    assert.ok(overstockRisk);
  });

  it("detects revenue change from ytdTotal", () => {
    const prev = {
      _rawStats: { totalCases: 800, accountCount: 2, totalRevenue: 40000 },
      drillDownStats: [],
    };
    const result = computeChanges(baseViews, prev);
    const revChange = result.changes.find((c) => c.evidence?.tab === "revenue");
    assert.ok(revChange, "should detect revenue change");
    assert.equal(revChange.direction, "up");
  });

  it("no changes when values are stable", () => {
    const prev = {
      _rawStats: { totalCases: 800, accountCount: 2, totalRevenue: 50000 },
      drillDownStats: [],
    };
    const result = computeChanges(baseViews, prev);
    assert.equal(result.changes.length, 0);
  });

  it("stores _rawStats for next comparison", () => {
    const result = computeChanges(baseViews, null);
    assert.equal(result._rawStats.totalCases, 800);
    assert.equal(result._rawStats.accountCount, 2);
    assert.equal(result._rawStats.totalRevenue, 50000);
  });

  it("detects overdue reorders using days > cycle * 1.5", () => {
    const views = {
      ...baseViews,
      reorderData: [
        { acct: "On Time", days: 20, cycle: 30 },
        { acct: "Overdue", days: 50, cycle: 30 },
        { acct: "Way Overdue", days: 100, cycle: 30 },
      ],
    };
    const result = computeChanges(views, null);
    const reorderStat = result.drillDownStats.find((s) => s.tab === "reorder");
    assert.equal(reorderStat.value, "2");
  });
});
