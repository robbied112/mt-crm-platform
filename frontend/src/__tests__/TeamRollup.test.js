import { describe, it, expect, vi } from "vitest";
import { computeRepMetrics, computeTerritoryMetrics } from "../components/TeamRollup";

// Mock matchesUserTerritory
vi.mock("../utils/territory", () => ({
  matchesUserTerritory: (state, user) => {
    if (user.territory === "all") return true;
    const territories = user.territories || {};
    const states = territories[user.territory] || [];
    return states.some((s) => s.toLowerCase() === (state || "").toLowerCase());
  },
}));

describe("computeRepMetrics", () => {
  const baseMember = { id: "u1", displayName: "Alice", email: "alice@test.com", territory: "all" };

  it("returns empty array for empty members", () => {
    expect(computeRepMetrics([], [], [], [], [], {})).toEqual([]);
  });

  it("computes basic metrics for a rep with territory all", () => {
    const members = [baseMember];
    const scorecard = [
      { acct: "A", ce: 130, w4: 10, st: "CA" },
      { acct: "B", ce: 260, w4: 20, st: "OR" },
    ];
    const result = computeRepMetrics(members, scorecard, [], [], [], {});
    expect(result[0].totalCases).toBe(390);
    expect(result[0].accountCount).toBe(2);
  });

  it("filters by territory", () => {
    const members = [{ ...baseMember, territory: "West" }];
    const territories = { West: ["CA", "OR"] };
    const scorecard = [
      { acct: "A", ce: 100, st: "CA" },
      { acct: "B", ce: 200, st: "TX" },
    ];
    const result = computeRepMetrics(members, scorecard, [], [], [], territories);
    expect(result[0].totalCases).toBe(100);
    expect(result[0].accountCount).toBe(1);
  });

  it("counts overdue reorders in territory", () => {
    const members = [baseMember];
    const reorder = [
      { days: 40, cycle: 30, st: "CA" },
      { days: 10, cycle: 30, st: "CA" },
    ];
    const result = computeRepMetrics(members, [], reorder, [], [], {});
    expect(result[0].overdueReorders).toBe(1);
  });

  it("counts recent activities for a member", () => {
    const members = [baseMember];
    const today = new Date().toISOString().slice(0, 10);
    const activities = [
      { loggedBy: "u1", date: today },
      { loggedBy: "u1", date: "2020-01-01" },
      { loggedBy: "u2", date: today },
    ];
    const result = computeRepMetrics(members, [], [], activities, [], {});
    expect(result[0].recentActivities).toBe(1);
  });

  it("counts open tasks for a member", () => {
    const members = [baseMember];
    const tasks = [
      { createdBy: "u1", status: "open" },
      { createdBy: "u1", status: "completed" },
      { createdBy: "u1", status: "cancelled" },
    ];
    const result = computeRepMetrics(members, [], [], [], tasks, {});
    expect(result[0].openTasks).toBe(1);
  });
});

describe("computeTerritoryMetrics", () => {
  it("returns empty array for no territories", () => {
    expect(computeTerritoryMetrics(null, [])).toEqual([]);
    expect(computeTerritoryMetrics({}, [])).toEqual([]);
  });

  it("aggregates by territory", () => {
    const territories = { West: ["CA", "OR"], East: ["NY"] };
    const scorecard = [
      { acct: "A", ce: 100, w4: 10, st: "CA" },
      { acct: "B", ce: 200, w4: 20, st: "OR" },
      { acct: "C", ce: 50, w4: 5, st: "NY" },
    ];
    const result = computeTerritoryMetrics(territories, scorecard);
    expect(result[0].name).toBe("West");
    expect(result[0].totalCases).toBe(300);
    expect(result[0].accountCount).toBe(2);
    expect(result[1].name).toBe("East");
    expect(result[1].totalCases).toBe(50);
  });

  it("sorts by totalCases descending", () => {
    const territories = { A: ["CA"], B: ["NY"] };
    const scorecard = [
      { acct: "X", ce: 10, st: "CA" },
      { acct: "Y", ce: 100, st: "NY" },
    ];
    const result = computeTerritoryMetrics(territories, scorecard);
    expect(result[0].name).toBe("B");
    expect(result[1].name).toBe("A");
  });

  it("handles case-insensitive state matching", () => {
    const territories = { West: ["ca"] };
    const scorecard = [{ acct: "A", ce: 100, st: "CA" }];
    const result = computeTerritoryMetrics(territories, scorecard);
    expect(result[0].totalCases).toBe(100);
  });
});
