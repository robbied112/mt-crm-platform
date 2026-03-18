/**
 * Tests for smart sheet selection — scoreSheet heuristic, penalty/bonus
 * name matching, and the sheetInfo contract.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  scoreSheet,
  PENALTY_NAMES,
  BONUS_NAMES,
  clearWorkbookCache,
} from "../utils/parseFile.js";

beforeEach(() => {
  clearWorkbookCache();
});

// ─── Helpers ───────────────────────────────────────────────────

/** Build a simple sheet with N data rows and M columns. */
function makeSheet(headers, dataRows) {
  return [headers, ...dataRows];
}

function makeDataRows(count, cols) {
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `val_${i}_${j}`)
  );
}

// ─── scoreSheet ────────────────────────────────────────────────

describe("scoreSheet", () => {
  it("returns -100 for empty rawRows", () => {
    const result = scoreSheet("Sheet1", [], 0);
    expect(result.score).toBe(-100);
    expect(result.rowCount).toBe(0);
  });

  it("returns -100 for null rawRows", () => {
    const result = scoreSheet("Sheet1", null, 0);
    expect(result.score).toBe(-100);
  });

  it("scores a sheet with 3+ headers higher than one with <3 headers", () => {
    const good = makeSheet(
      ["Account", "State", "Amount", "Date"],
      makeDataRows(10, 4)
    );
    const bad = makeSheet(
      ["Title", ""],
      [["Some value", ""]]
    );
    const goodScore = scoreSheet("Data", good, 11);
    const badScore = scoreSheet("Cover", bad, 2);
    expect(goodScore.score).toBeGreaterThan(badScore.score);
  });

  it("penalizes sheets with <3 non-empty headers by -200", () => {
    const fewHeaders = makeSheet(["Title", ""], [["x", ""]]);
    const result = scoreSheet("Random", fewHeaders, 2);
    // Base: 0 data rows + (-200 penalty) + density — should be well below 0
    expect(result.score).toBeLessThan(0);
  });

  it("gives bonus for 3+ headers: +10 per header", () => {
    const fiveHeaders = makeSheet(
      ["A", "B", "C", "D", "E"],
      makeDataRows(1, 5)
    );
    const result = scoreSheet("Sheet1", fiveHeaders, 2);
    // Base: 1 row + (5 * 10 = 50 header bonus) + density
    expect(result.headerCount).toBe(5);
    expect(result.score).toBeGreaterThan(40);
  });

  it("caps data row score at 5000", () => {
    const headers = ["A", "B", "C"];
    const rows = makeSheet(headers, makeDataRows(3, 3));
    // Pass huge totalRowCount to simulate a sheet with 10000 rows
    const result = scoreSheet("Data", rows, 10001);
    // Base: min(10000, 5000) = 5000 + header bonus + density
    expect(result.rowCount).toBe(10000);
    expect(result.score).toBeLessThan(5200); // 5000 + headers + density
  });

  it("uses totalRowCount parameter for row count, not sample length", () => {
    const headers = ["A", "B", "C"];
    const sample = makeSheet(headers, makeDataRows(5, 3)); // only 5 sample rows
    const result = scoreSheet("Sheet1", sample, 1001); // but 1001 total rows
    expect(result.rowCount).toBe(1000); // 1001 - 1 header
  });

  it("falls back to sample length when totalRowCount is undefined", () => {
    const headers = ["A", "B", "C"];
    const sample = makeSheet(headers, makeDataRows(5, 3));
    const result = scoreSheet("Sheet1", sample, undefined);
    expect(result.rowCount).toBe(5); // 6 total rows - 1 header
  });

  it("rewards high data density", () => {
    const dense = makeSheet(
      ["A", "B", "C"],
      makeDataRows(10, 3) // all cells filled
    );
    const sparse = makeSheet(
      ["A", "B", "C"],
      Array.from({ length: 10 }, () => ["val", "", ""]) // only 1/3 filled
    );
    const denseScore = scoreSheet("Sheet1", dense, 11);
    const sparseScore = scoreSheet("Sheet1", sparse, 11);
    expect(denseScore.score).toBeGreaterThan(sparseScore.score);
  });

  it("returns correct headerIdx", () => {
    // Header row at index 0 for simple data
    const simple = makeSheet(["Name", "Amount"], [["x", "1"]]);
    const result = scoreSheet("Sheet1", simple, 2);
    expect(result.headerIdx).toBe(0);
  });

  it("returns correct headerCount (non-empty only)", () => {
    const mixed = makeSheet(
      ["Name", "", "Amount", ""],
      [["x", "", "1", ""]]
    );
    const result = scoreSheet("Sheet1", mixed, 2);
    expect(result.headerCount).toBe(2); // Name and Amount
  });
});

// ─── Sheet Name Penalties ──────────────────────────────────────

describe("PENALTY_NAMES", () => {
  const penaltyNames = [
    "Summary", "SUMMARY", "Cover", "Instructions", "Instruction",
    "Notes", "Note", "Template", "TOC", "Table of Contents",
    "README", "Info", "About", "Help", "Index", "Overview",
    "Metadata", "Legend", "Definitions", "Definition",
  ];

  it.each(penaltyNames)("penalizes sheet named '%s'", (name) => {
    expect(PENALTY_NAMES.test(name)).toBe(true);
  });

  it("does not penalize normal data sheet names", () => {
    expect(PENALTY_NAMES.test("Sales Data")).toBe(false);
    expect(PENALTY_NAMES.test("Sheet1")).toBe(false);
    expect(PENALTY_NAMES.test("Depletions")).toBe(false);
  });

  it("applies -500 penalty to scoreSheet", () => {
    const rows = makeSheet(["A", "B", "C"], makeDataRows(10, 3));
    const normal = scoreSheet("DataSheet", rows, 11);
    const penalized = scoreSheet("Summary", rows, 11);
    expect(normal.score - penalized.score).toBe(500);
  });
});

// ─── Sheet Name Bonuses ────────────────────────────────────────

describe("BONUS_NAMES", () => {
  const bonusNames = [
    "Data", "Detail", "Details", "Report", "Sales",
    "Depletion", "Depletions", "Inventory", "Placement", "Placements",
    "Velocity", "Revenue", "Invoice", "Invoices",
    "Transactions", "Orders", "Accounts", "Aging", "AR", "AP",
    "QuickBooks", "QB", "Export", "Raw", "Sheet1",
  ];

  it.each(bonusNames)("gives bonus to sheet named '%s'", (name) => {
    expect(BONUS_NAMES.test(name)).toBe(true);
  });

  it("does not give bonus to unrecognized names", () => {
    expect(BONUS_NAMES.test("Foo")).toBe(false);
    expect(BONUS_NAMES.test("MySheet")).toBe(false);
    expect(BONUS_NAMES.test("Summary")).toBe(false);
  });

  it("applies +50 bonus to scoreSheet", () => {
    const rows = makeSheet(["A", "B", "C"], makeDataRows(10, 3));
    const normal = scoreSheet("RandomName", rows, 11);
    const bonused = scoreSheet("Sales", rows, 11);
    expect(bonused.score - normal.score).toBe(50);
  });
});

// ─── Multi-sheet Selection ─────────────────────────────────────

describe("multi-sheet selection heuristic", () => {
  it("picks the sheet with the most data rows over a sparse summary", () => {
    const summary = makeSheet(
      ["Report Title", "Date"],
      [["Monthly Sales", "2026-03"]]
    );
    const data = makeSheet(
      ["Account", "Product", "Cases", "Revenue"],
      makeDataRows(100, 4)
    );

    const summaryScore = scoreSheet("Summary", summary, 2);
    const dataScore = scoreSheet("Data", data, 101);
    expect(dataScore.score).toBeGreaterThan(summaryScore.score);
  });

  it("picks data sheet even when cover sheet is first (simulates real workbook)", () => {
    const sheets = [
      { name: "Cover", rows: makeSheet(["Report"], [["Title"]]), total: 2 },
      { name: "Sales Detail", rows: makeSheet(["Account", "State", "SKU", "Cases"], makeDataRows(500, 4)), total: 501 },
      { name: "Notes", rows: makeSheet(["Note"], [["FYI"]]), total: 2 },
    ];

    const scores = sheets.map((s) => ({
      name: s.name,
      ...scoreSheet(s.name, s.rows, s.total),
    }));
    scores.sort((a, b) => b.score - a.score);

    expect(scores[0].name).toBe("Sales Detail");
  });

  it("breaks ties using header count + name bonus", () => {
    const sheet1 = makeSheet(
      ["A", "B", "C"],
      makeDataRows(50, 3)
    );
    const sheet2 = makeSheet(
      ["Account", "Product", "Cases", "Revenue", "Date"],
      makeDataRows(50, 5)
    );

    const score1 = scoreSheet("Misc", sheet1, 51);
    const score2 = scoreSheet("Sales", sheet2, 51);
    // sheet2 has more headers (+20 more header bonus) + name bonus (+50)
    expect(score2.score).toBeGreaterThan(score1.score);
  });
});
