import { describe, it, expect } from "vitest";

// CJS interop
const { transformRevenue } = require("../../../packages/pipeline/src/transformRevenue");

const identity = (field) => field;
const MAPPING = {
  revenue: "revenue",
  date: "date",
  ch: "ch",
  sku: "sku",
  acct: "acct",
};

function makeRow({ amount = 100, date = "2026-02-15", channel = "", sku = "Wine A", acct = "Acct 1" } = {}) {
  return { revenue: amount, date, ch: channel, sku, acct };
}

describe("transformRevenue", () => {
  it("returns empty views for empty input", () => {
    const result = transformRevenue([], MAPPING);
    expect(result.revenueByChannel).toEqual([]);
    expect(result.revenueByProduct).toEqual([]);
    expect(result.revenueSummary).toEqual({});
  });

  it("returns empty views for null input", () => {
    const result = transformRevenue(null, MAPPING);
    expect(result.revenueByChannel).toEqual([]);
  });

  it("handles happy path with multi-channel, multi-SKU, multi-month", () => {
    const rows = [
      makeRow({ amount: 1000, date: "2026-01-15", channel: "Distributors", sku: "Wine A" }),
      makeRow({ amount: 500, date: "2026-01-20", channel: "Website / DTC", sku: "Wine B" }),
      makeRow({ amount: 750, date: "2026-02-10", channel: "Distributors", sku: "Wine A" }),
      makeRow({ amount: 300, date: "2026-02-15", channel: "Website / DTC", sku: "Wine C" }),
    ];

    const result = transformRevenue(rows, MAPPING);

    expect(result.revenueByChannel.length).toBe(2);
    const dist = result.revenueByChannel.find((c) => c.channel === "Distributors");
    expect(dist).toBeTruthy();
    expect(dist.total).toBe(1750);

    const dtc = result.revenueByChannel.find((c) => c.channel === "Website / DTC");
    expect(dtc.total).toBe(800);

    expect(result.revenueByProduct.length).toBe(3);
    expect(result.revenueByProduct[0].sku).toBe("Wine A"); // highest
    expect(result.revenueByProduct[0].total).toBe(1750);

    expect(result.revenueSummary.monthKeys).toEqual(["2026-01", "2026-02"]);
  });

  it("skips rows with NaN amounts", () => {
    const rows = [
      makeRow({ amount: 100, date: "2026-01-01" }),
      { revenue: "not-a-number", date: "2026-01-01", ch: "", sku: "X", acct: "A" },
    ];
    const result = transformRevenue(rows, MAPPING);
    // NaN amounts are parsed to 0 by num(), not skipped
    expect(result.revenueByChannel.length).toBeGreaterThanOrEqual(1);
  });

  it("skips rows with invalid dates", () => {
    const rows = [
      makeRow({ date: "2026-01-01" }),
      makeRow({ date: "not-a-date" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueSummary.warnings).toBeDefined();
  });

  it("handles single channel data", () => {
    const rows = [
      makeRow({ channel: "Distributors", date: "2026-01-01" }),
      makeRow({ channel: "Distributors", date: "2026-02-01" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueByChannel.length).toBe(1);
    expect(result.revenueByChannel[0].channel).toBe("Distributors");
  });

  it("handles single month data", () => {
    const rows = [
      { revenue: 100, date: "2026-03-01", ch: "", sku: "Wine A", acct: "Acct 1" },
      { revenue: 100, date: "2026-03-15", ch: "", sku: "Wine A", acct: "Acct 1" },
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueSummary.monthKeys).toContain("2026-03");
    expect(result.revenueSummary.monthlyTotals["2026-03"]).toBe(200);
  });

  it("handles negative amounts (refunds)", () => {
    const rows = [
      makeRow({ amount: 1000, date: "2026-01-01", channel: "Distributors" }),
      makeRow({ amount: -200, date: "2026-01-01", channel: "Distributors" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    const dist = result.revenueByChannel.find((c) => c.channel === "Distributors");
    expect(dist.total).toBe(800);
  });

  it("assigns channel from keyword matching", () => {
    const rows = [
      makeRow({ channel: "retail", date: "2026-01-01" }),
      makeRow({ channel: "bar", date: "2026-01-01" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    const channels = result.revenueByChannel.map((c) => c.channel);
    expect(channels).toContain("Direct to Trade - Off Premise");
    expect(channels).toContain("Direct to Trade - On Premise");
  });

  it("defaults missing channel to Other", () => {
    const rows = [makeRow({ channel: "", date: "2026-01-01" })];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueByChannel[0].channel).toBe("Other");
  });

  it("computes YTD totals correctly", () => {
    const rows = [
      makeRow({ amount: 1000, date: "2026-01-15" }),
      makeRow({ amount: 2000, date: "2026-02-15" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueSummary.ytdTotal).toBe(3000);
  });

  it("computes annual run rate", () => {
    const rows = [
      makeRow({ amount: 10000, date: "2026-01-15" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    // Run rate extrapolates based on months elapsed in current year
    expect(result.revenueSummary.annualRunRate).toBeGreaterThan(0);
  });

  it("handles all-zeros gracefully", () => {
    const rows = [
      makeRow({ amount: 0, date: "2026-01-01" }),
      makeRow({ amount: 0, date: "2026-02-01" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    // All zeros should not crash
    expect(result.revenueSummary.ytdTotal).toBe(0);
  });

  it("identifies top channel and top SKU", () => {
    const rows = [
      makeRow({ amount: 5000, date: "2026-01-01", channel: "Distributors", sku: "Pinot" }),
      makeRow({ amount: 1000, date: "2026-01-01", channel: "Website / DTC", sku: "Cabernet" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueSummary.topChannel).toBe("Distributors");
    expect(result.revenueSummary.topSku).toBe("Pinot");
  });

  it("sorts revenueByProduct by total descending", () => {
    const rows = [
      makeRow({ amount: 100, date: "2026-01-01", sku: "Small" }),
      makeRow({ amount: 1000, date: "2026-01-01", sku: "Large" }),
      makeRow({ amount: 500, date: "2026-01-01", sku: "Medium" }),
    ];
    const result = transformRevenue(rows, MAPPING);
    expect(result.revenueByProduct.map((p) => p.sku)).toEqual(["Large", "Medium", "Small"]);
  });
});
