import { describe, it, expect } from "vitest";

const { transformArAp, buildAgingSummary } = require("../../../packages/pipeline/src/transformArAp");

const MAPPING = {
  acct: "acct",
  dist: "dist",
  balance: "balance",
  revenue: "revenue",
};

function makeARRow({ name = "Customer A", current = 1000, b1_30 = 500, b31_60 = 200, b61_90 = 100, b90plus = 50, total = null } = {}) {
  return {
    acct: name,
    "Current": current,
    "1 - 30": b1_30,
    "31 - 60": b31_60,
    "61 - 90": b61_90,
    "> 90": b90plus,
    balance: total || (current + b1_30 + b31_60 + b61_90 + b90plus),
  };
}

function makeAPRow({ name = "Vendor A", ...rest } = {}) {
  const row = makeARRow({ name, ...rest });
  // Replace acct with vendor key
  delete row.acct;
  row.Vendor = name;
  return row;
}

describe("transformArAp", () => {
  it("returns empty summaries for empty input", () => {
    const result = transformArAp([], MAPPING);
    expect(result.arAgingSummary).toEqual({});
    expect(result.apAgingSummary).toEqual({});
  });

  it("returns empty summaries for null input", () => {
    const result = transformArAp(null, MAPPING);
    expect(result.arAgingSummary).toEqual({});
    expect(result.apAgingSummary).toEqual({});
  });

  it("processes AR data correctly", () => {
    const rows = [
      makeARRow({ name: "Acme Liquor", current: 5000, b1_30: 2000, b31_60: 1000, b61_90: 500, b90plus: 300 }),
      makeARRow({ name: "Best Wines", current: 3000, b1_30: 1000, b31_60: 0, b61_90: 0, b90plus: 0 }),
    ];
    const result = transformArAp(rows, MAPPING);
    const ar = result.arAgingSummary;

    expect(ar.totalOutstanding).toBe(12800);
    expect(ar.buckets.current).toBe(8000);
    expect(ar.buckets["31-60"]).toBe(1000);
    expect(ar.overdueTotal).toBe(1800); // 31-60 + 61-90 + 90+
    expect(ar.entityCount).toBe(2);
    expect(ar.topEntities.length).toBe(2);
    expect(ar.topEntities[0].name).toBe("Acme Liquor"); // higher total
  });

  it("handles single account", () => {
    const rows = [makeARRow({ name: "Solo" })];
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.entityCount).toBe(1);
    expect(result.arAgingSummary.topEntities[0].name).toBe("Solo");
  });

  it("handles all-current (no overdue)", () => {
    const rows = [
      makeARRow({ name: "Good Payer", current: 5000, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 }),
    ];
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.overdueTotal).toBe(0);
    expect(result.arAgingSummary.overduePercent).toBe(0);
  });

  it("handles negative values (overpayments)", () => {
    const rows = [
      makeARRow({ name: "Overpaid", current: -500, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 }),
    ];
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.buckets.current).toBe(-500);
  });

  it("handles missing bucket columns gracefully", () => {
    const rows = [{ acct: "Test", balance: 5000, revenue: 5000 }];
    const result = transformArAp(rows, MAPPING);
    // Should not crash, just zero buckets
    expect(result.arAgingSummary.totalOutstanding).toBe(5000);
  });

  it("limits topEntities to 10", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeARRow({ name: `Customer ${i}`, current: (15 - i) * 100 })
    );
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.topEntities.length).toBe(10);
  });

  it("computes overdue percentage correctly", () => {
    const rows = [
      makeARRow({ current: 0, b1_30: 0, b31_60: 500, b61_90: 300, b90plus: 200 }),
    ];
    const result = transformArAp(rows, MAPPING);
    // All is overdue
    expect(result.arAgingSummary.overduePercent).toBe(100);
  });

  it("skips total rows", () => {
    const rows = [
      makeARRow({ name: "Real Customer", current: 1000 }),
      makeARRow({ name: "Total", current: 1000 }),
    ];
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.entityCount).toBe(1);
  });

  it("handles QB Online format (CURRENT, 1-30, etc.)", () => {
    const rows = [{
      acct: "Customer Online",
      "CURRENT": 2000,
      "1-30": 500,
      "31-60": 200,
      "61-90": 100,
      "OVER 90": 50,
    }];
    const result = transformArAp(rows, MAPPING);
    expect(result.arAgingSummary.totalOutstanding).toBe(2850);
  });
});

describe("buildAgingSummary", () => {
  it("returns empty summary for empty rows", () => {
    const result = buildAgingSummary([], MAPPING, "ar");
    expect(result.totalOutstanding).toBe(0);
    expect(result.entityCount).toBe(0);
  });
});
