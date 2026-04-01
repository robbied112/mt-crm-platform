import { describe, it, expect } from "vitest";
import { computeDiff } from "../components/ImportDiffSummary";

describe("computeDiff", () => {
  it("detects new accounts", () => {
    const prev = { distScorecard: [{ acct: "Bevmo" }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "Bevmo" }, { acct: "Total Wine" }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.type === "positive" && c.text.includes("1 new account"))).toBe(true);
  });

  it("detects lost accounts", () => {
    const prev = { distScorecard: [{ acct: "Bevmo" }, { acct: "Total Wine" }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "Bevmo" }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.type === "warning" && c.text.includes("1 account"))).toBe(true);
  });

  it("detects volume increase", () => {
    const prev = { distScorecard: [{ acct: "A", ce: 100 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "A", ce: 120 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.type === "positive" && c.text.includes("up"))).toBe(true);
  });

  it("detects volume decrease", () => {
    const prev = { distScorecard: [{ acct: "A", ce: 100 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "A", ce: 80 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.type === "negative" && c.text.includes("down"))).toBe(true);
  });

  it("detects new overdue reorders", () => {
    const prev = { distScorecard: [], reorderData: [{ days: 10, cycle: 30 }], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [], reorderData: [{ days: 10, cycle: 30 }, { days: 40, cycle: 30 }], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.type === "warning" && c.text.includes("overdue"))).toBe(true);
  });

  it("detects inventory alerts", () => {
    const prev = { distScorecard: [], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [], reorderData: [], inventoryData: [{ doh: 10 }, { doh: 5 }], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.text.includes("days on hand"))).toBe(true);
  });

  it("returns empty array when no changes", () => {
    const data = { distScorecard: [{ acct: "A", ce: 100 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(data, data);
    expect(changes).toEqual([]);
  });

  it("handles empty previous data", () => {
    const prev = { distScorecard: [], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "A", ce: 50 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.text.includes("1 new account"))).toBe(true);
  });

  it("detects revenue changes", () => {
    const prev = { distScorecard: [], reorderData: [], inventoryData: [], revenueByChannel: [{ total: 10000 }] };
    const curr = { distScorecard: [], reorderData: [], inventoryData: [], revenueByChannel: [{ total: 12000 }] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.text.includes("Revenue"))).toBe(true);
  });

  it("ignores tiny volume changes under 1%", () => {
    const prev = { distScorecard: [{ acct: "A", ce: 100 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const curr = { distScorecard: [{ acct: "A", ce: 100.5 }], reorderData: [], inventoryData: [], revenueByChannel: [] };
    const changes = computeDiff(prev, curr);
    expect(changes.some((c) => c.text.includes("Volume"))).toBe(false);
  });
});
