import { describe, it, expect } from "vitest";
import { findAccountInData, computeVolumeTrend, computeReorderStatus } from "../components/AccountMetricsCard";

describe("findAccountInData", () => {
  it("returns null for empty inputs", () => {
    expect(findAccountInData([], "Test")).toBe(null);
    expect(findAccountInData([{ acct: "A" }], "")).toBe(null);
    expect(findAccountInData(null, "A")).toBe(null);
  });

  it("finds exact match", () => {
    const rows = [{ acct: "Bevmo" }, { acct: "Total Wine" }];
    expect(findAccountInData(rows, "Bevmo")).toBe(rows[0]);
    expect(findAccountInData(rows, "Total Wine")).toBe(rows[1]);
  });

  it("matches case-insensitively", () => {
    const rows = [{ acct: "Bevmo" }];
    expect(findAccountInData(rows, "bevmo")).toBe(rows[0]);
    expect(findAccountInData(rows, "BEVMO")).toBe(rows[0]);
  });

  it("falls back to prefix match", () => {
    const rows = [{ acct: "Bevmo - Store #123" }];
    expect(findAccountInData(rows, "Bevmo")).toBe(rows[0]);
  });

  it("falls back to reverse prefix match", () => {
    const rows = [{ acct: "Bevmo" }];
    expect(findAccountInData(rows, "Bevmo - Portland")).toBe(rows[0]);
  });

  it("returns null when no match found", () => {
    const rows = [{ acct: "Bevmo" }];
    expect(findAccountInData(rows, "Total Wine")).toBeUndefined();
  });

  it("uses name field if acct is missing", () => {
    const rows = [{ name: "Bevmo" }];
    expect(findAccountInData(rows, "Bevmo")).toBe(rows[0]);
  });
});

describe("computeVolumeTrend", () => {
  it("returns null for null row", () => {
    expect(computeVolumeTrend(null)).toBeNull();
  });

  it("computes trend from month columns", () => {
    const result = computeVolumeTrend({ m0: 120, m1: 100 });
    expect(result.pctChange).toBe(20);
    expect(result.direction).toBe("up");
  });

  it("detects downward trend", () => {
    const result = computeVolumeTrend({ m0: 80, m1: 100 });
    expect(result.pctChange).toBe(-20);
    expect(result.direction).toBe("down");
  });

  it("detects flat trend", () => {
    const result = computeVolumeTrend({ m0: 100, m1: 100 });
    expect(result.pctChange).toBe(0);
    expect(result.direction).toBe("flat");
  });

  it("falls back to w4/ce when month columns missing", () => {
    const result = computeVolumeTrend({ w4: 10, ce: 130 });
    expect(result).not.toBeNull();
    expect(result.current).toBe(10);
    expect(result.previous).toBe(10); // 130/13 = 10
    expect(result.direction).toBe("flat");
  });

  it("returns null when no data available", () => {
    expect(computeVolumeTrend({})).toBeNull();
    expect(computeVolumeTrend({ m0: 100 })).toBeNull(); // m1 missing
  });

  it("handles m1 = 0 (avoids division by zero)", () => {
    const result = computeVolumeTrend({ m0: 100, m1: 0 });
    // m1 = 0, so m1 > 0 is false, falls through to w4 fallback
    expect(result).toBeNull(); // no w4 either
  });

  it("uses _m0/_m1 prefix columns when available", () => {
    const result = computeVolumeTrend({ _m0: 150, _m1: 100 });
    expect(result.pctChange).toBe(50);
  });
});

describe("computeReorderStatus", () => {
  it("returns null for empty/null input", () => {
    expect(computeReorderStatus([])).toBeNull();
    expect(computeReorderStatus(null)).toBeNull();
  });

  it("detects overdue reorders", () => {
    const rows = [
      { days: 40, cycle: 30 },
      { days: 10, cycle: 30 },
    ];
    const result = computeReorderStatus(rows);
    expect(result.status).toBe("overdue");
    expect(result.overdueCount).toBe(1);
    expect(result.worstOverdue).toBe(10); // 40 - 30
    expect(result.totalTracked).toBe(2);
  });

  it("returns on-track when no overdue items", () => {
    const rows = [
      { days: 10, cycle: 30 },
      { days: 20, cycle: 30 },
    ];
    const result = computeReorderStatus(rows);
    expect(result.status).toBe("on-track");
    expect(result.overdueCount).toBe(0);
  });

  it("ignores rows with cycle <= 0", () => {
    const rows = [{ days: 100, cycle: 0 }];
    const result = computeReorderStatus(rows);
    expect(result.status).toBe("on-track");
  });
});
