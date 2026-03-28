/**
 * Tests for alignMonths.js — temporal month alignment across imports.
 */
import { describe, it, expect } from "vitest";
import {
  parseMonthLabel,
  buildUnifiedAxis,
  monthKey,
  monthLabel,
} from "../utils/alignMonths.js";

describe("parseMonthLabel", () => {
  it("parses 'Nov 2025' format", () => {
    expect(parseMonthLabel("Nov 2025")).toEqual({ year: 2025, month: 10 });
    expect(parseMonthLabel("January 2026")).toEqual({ year: 2026, month: 0 });
  });

  it("parses pivot period bracket format", () => {
    expect(parseMonthLabel("Case Equivs [1M Dec 2025]")).toEqual({ year: 2025, month: 11 });
    expect(parseMonthLabel("Cases [1M Jan 2026]")).toEqual({ year: 2026, month: 0 });
  });

  it("parses 2-digit year format", () => {
    expect(parseMonthLabel("Nov-25")).toEqual({ year: 2025, month: 10 });
    expect(parseMonthLabel("Jan-26")).toEqual({ year: 2026, month: 0 });
  });

  it("parses numeric formats", () => {
    expect(parseMonthLabel("11/2025")).toEqual({ year: 2025, month: 10 });
    expect(parseMonthLabel("2025-11")).toEqual({ year: 2025, month: 10 });
  });

  it("returns null for unparseable labels", () => {
    expect(parseMonthLabel("Period 1")).toBeNull();
    expect(parseMonthLabel("Total")).toBeNull();
    expect(parseMonthLabel("")).toBeNull();
    expect(parseMonthLabel(null)).toBeNull();
  });
});

describe("buildUnifiedAxis", () => {
  it("aligns two files with different time periods", () => {
    const rows = [
      // File 1: Nov 2025, Dec 2025
      { acct: "A", _months: [10, 20], _monthLabels: ["Nov 2025", "Dec 2025"] },
      { acct: "B", _months: [5, 15], _monthLabels: ["Nov 2025", "Dec 2025"] },
      // File 2: Mar 2026, Apr 2026
      { acct: "C", _months: [30, 40], _monthLabels: ["Mar 2026", "Apr 2026"] },
    ];

    const { axis, rows: result } = buildUnifiedAxis(rows);

    // Axis includes only months present in the data (no gap-filling)
    expect(axis[0]).toBe("Nov 2025");
    expect(axis[axis.length - 1]).toBe("Apr 2026");
    expect(axis.length).toBe(4); // Nov, Dec, Mar, Apr (only months with data)

    // File 1 rows should have values at positions 0,1 and zeros elsewhere
    expect(result[0]._months[0]).toBe(10); // Nov
    expect(result[0]._months[1]).toBe(20); // Dec
    expect(result[0]._months[2]).toBe(0);  // Mar (no data)
    expect(result[0]._months[3]).toBe(0);  // Apr (no data)

    // File 2 row should have values at positions 2,3
    expect(result[2]._months[0]).toBe(0);  // Nov (no data)
    expect(result[2]._months[1]).toBe(0);  // Dec (no data)
    expect(result[2]._months[2]).toBe(30); // Mar
    expect(result[2]._months[3]).toBe(40); // Apr
  });

  it("handles overlapping periods correctly", () => {
    const rows = [
      { acct: "A", _months: [10, 20, 30], _monthLabels: ["Nov 2025", "Dec 2025", "Jan 2026"] },
      { acct: "B", _months: [5, 15, 25], _monthLabels: ["Dec 2025", "Jan 2026", "Feb 2026"] },
    ];

    const { axis, rows: result } = buildUnifiedAxis(rows);

    // Should have 4 months: Nov, Dec, Jan, Feb
    expect(axis).toEqual(["Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026"]);

    // Row A: Nov=10, Dec=20, Jan=30, Feb=0
    expect(result[0]._months).toEqual([10, 20, 30, 0]);
    // Row B: Nov=0, Dec=5, Jan=15, Feb=25
    expect(result[1]._months).toEqual([0, 5, 15, 25]);
  });

  it("falls back to positional for unparseable labels (per-import)", () => {
    const rows = [
      // Parseable file
      { acct: "A", _months: [10, 20], _monthLabels: ["Nov 2025", "Dec 2025"] },
      // Unparseable file
      { acct: "B", _months: [30, 40], _monthLabels: ["Period 1", "Period 2"] },
    ];

    const { axis, rows: result } = buildUnifiedAxis(rows);

    // Parseable part of axis
    expect(axis[0]).toBe("Nov 2025");
    expect(axis[1]).toBe("Dec 2025");

    // Unparseable rows get appended with positional labels
    expect(axis.length).toBe(4); // 2 parseable + 2 positional

    // Parseable row at correct positions
    expect(result[0]._months[0]).toBe(10);
    expect(result[0]._months[1]).toBe(20);

    // Unparseable row at offset positions
    expect(result[1]._months[2]).toBe(30);
    expect(result[1]._months[3]).toBe(40);
  });

  it("returns empty axis when no rows have labels", () => {
    const rows = [
      { acct: "A", _months: [10, 20] },
      { acct: "B", _months: [30, 40] },
    ];

    const { axis, rows: result } = buildUnifiedAxis(rows);
    expect(axis).toEqual([]);
    expect(result).toBe(rows); // returned as-is
  });

  it("handles empty input", () => {
    const { axis, rows } = buildUnifiedAxis([]);
    expect(axis).toEqual([]);
    expect(rows).toEqual([]);
  });
});

describe("monthKey / monthLabel", () => {
  it("produces sortable keys", () => {
    expect(monthKey({ year: 2025, month: 10 })).toBeLessThan(monthKey({ year: 2025, month: 11 }));
    expect(monthKey({ year: 2025, month: 11 })).toBeLessThan(monthKey({ year: 2026, month: 0 }));
  });

  it("produces readable labels", () => {
    expect(monthLabel({ year: 2025, month: 10 })).toBe("Nov 2025");
    expect(monthLabel({ year: 2026, month: 0 })).toBe("Jan 2026");
  });
});
