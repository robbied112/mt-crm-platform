/**
 * Tests for extractData — structure-aware data extractor.
 *
 * Covers: extractData, applySkipPatterns, flattenPivot, applyColumnMapping.
 */
import { describe, it, expect } from "vitest";
import {
  extractData,
  applySkipPatterns,
  flattenPivot,
  applyColumnMapping,
} from "../../../packages/pipeline/src/extractData.js";

// ─── applySkipPatterns ────────────────────────────────────────

describe("applySkipPatterns", () => {
  const rows = [
    ["Acme", "100", "Wine A"],
    ["Total", "500", ""],
    ["Beta", "200", "Wine B"],
    ["Grand Total", "700", ""],
    ["Gamma", "150", "Wine C"],
  ];

  it("removes rows matching a pattern in the specified column", () => {
    const result = applySkipPatterns(rows, [{ column: 0, pattern: "^Total$" }]);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r[0])).toEqual(["Acme", "Beta", "Grand Total", "Gamma"]);
  });

  it("removes rows matching multiple patterns", () => {
    const result = applySkipPatterns(rows, [
      { column: 0, pattern: "Total" },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r[0])).toEqual(["Acme", "Beta", "Gamma"]);
  });

  it("returns all rows when patterns array is empty", () => {
    const result = applySkipPatterns(rows, []);
    expect(result).toHaveLength(5);
  });

  it("returns all rows when patterns is null", () => {
    const result = applySkipPatterns(rows, null);
    expect(result).toHaveLength(5);
  });

  it("handles malformed regex gracefully (skips the pattern)", () => {
    const result = applySkipPatterns(rows, [{ column: 0, pattern: "[invalid" }]);
    expect(result).toHaveLength(5);
  });

  it("handles null rows in the input array", () => {
    const withNulls = [null, ["Acme", "100"], null, ["Beta", "200"]];
    const result = applySkipPatterns(withNulls, [{ column: 0, pattern: "Acme" }]);
    // null rows have cellVal="" which doesn't match "Acme"
    expect(result).toHaveLength(3);
  });
});

// ─── applyColumnMapping ───────────────────────────────────────

describe("applyColumnMapping", () => {
  const headers = ["Account Name", "State", "Cases Sold", "Revenue"];
  const rows = [
    { "Account Name": "Acme Wines", State: "CA", "Cases Sold": 100, Revenue: 5000 },
    { "Account Name": "Beta Spirits", State: "NY", "Cases Sold": 50, Revenue: 2500 },
  ];

  it("maps internal field names via string header references", () => {
    const mapping = { account: "Account Name", qty: "Cases Sold" };
    const result = applyColumnMapping(rows, headers, mapping);
    expect(result[0].account).toBe("Acme Wines");
    expect(result[0].qty).toBe(100);
    // Original keys are preserved
    expect(result[0]["Account Name"]).toBe("Acme Wines");
  });

  it("maps internal field names via numeric column indices", () => {
    const mapping = { account: 0, revenue: 3 };
    const result = applyColumnMapping(rows, headers, mapping);
    expect(result[0].account).toBe("Acme Wines");
    expect(result[0].revenue).toBe(5000);
  });

  it("handles mixed numeric and string mappings", () => {
    const mapping = { account: 0, state: "State" };
    const result = applyColumnMapping(rows, headers, mapping);
    expect(result[0].account).toBe("Acme Wines");
    expect(result[0].state).toBe("CA");
  });

  it("returns rows unchanged when mapping is empty", () => {
    const result = applyColumnMapping(rows, headers, {});
    expect(result).toEqual(rows);
  });

  it("returns rows unchanged when mapping is null", () => {
    const result = applyColumnMapping(rows, headers, null);
    expect(result).toEqual(rows);
  });

  it("ignores numeric indices out of range", () => {
    const mapping = { account: 0, ghost: 99 };
    const result = applyColumnMapping(rows, headers, mapping);
    expect(result[0].account).toBe("Acme Wines");
    expect(result[0].ghost).toBeUndefined();
  });

  it("ignores string references that don't exist in rows", () => {
    const mapping = { account: "Nonexistent Column" };
    const result = applyColumnMapping(rows, headers, mapping);
    expect(result[0].account).toBeUndefined();
  });
});

// ─── flattenPivot ─────────────────────────────────────────────

describe("flattenPivot", () => {
  // Simulates a 3-week velocity report:
  // Row 0 = labels: ["", "", "Week 1", "", "Week 2", "", "Week 3", ""]
  // Row 1 = headers: ["SKU", "Dist", "Qty", "Rev", "Qty", "Rev", "Qty", "Rev"]
  // Row 2+ = data
  const rawRows = [
    ["", "", "Week 1", "", "Week 2", "", "Week 3", ""],
    ["SKU", "Dist", "Qty", "Rev", "Qty", "Rev", "Qty", "Rev"],
    ["Wine A", "SGWS", 10, 500, 15, 750, 20, 1000],
    ["Wine B", "RNDC", 5, 250, 8, 400, 12, 600],
  ];

  const spec = {
    headerRow: 1,
    dataStartRow: 2,
    pivot: {
      startCol: 2,
      endCol: 7,
      groupSize: 2,
      labelRow: 0,
      fieldNames: ["qty", "revenue"],
    },
  };

  it("flattens pivot columns into multiple rows per entity", () => {
    const result = flattenPivot(rawRows, spec);
    // 2 data rows * 3 week groups = 6 flattened rows
    expect(result).toHaveLength(6);
  });

  it("attaches _pivotLabel from the label row", () => {
    const result = flattenPivot(rawRows, spec);
    expect(result[0]._pivotLabel).toBe("Week 1");
    expect(result[1]._pivotLabel).toBe("Week 2");
    expect(result[2]._pivotLabel).toBe("Week 3");
  });

  it("maps field names to correct values within each group", () => {
    const result = flattenPivot(rawRows, spec);
    // First row, first group (Week 1): qty=10, revenue=500
    expect(result[0].qty).toBe(10);
    expect(result[0].revenue).toBe(500);
    // First row, second group (Week 2): qty=15, revenue=750
    expect(result[1].qty).toBe(15);
    expect(result[1].revenue).toBe(750);
  });

  it("copies non-pivot columns to each flattened row", () => {
    const result = flattenPivot(rawRows, spec);
    // Column 0 (SKU) and 1 (Dist) are non-pivot
    expect(result[0][0]).toBe("Wine A");
    expect(result[0][1]).toBe("SGWS");
    expect(result[3][0]).toBe("Wine B");
    expect(result[3][1]).toBe("RNDC");
  });

  it("returns sliced rows when pivot is null", () => {
    const result = flattenPivot(rawRows, { ...spec, pivot: null });
    expect(result).toHaveLength(2); // Just the data rows
  });
});

// ─── extractData ──────────────────────────────────────────────

describe("extractData", () => {
  // Simple flat file: row 0 = headers, row 1+ = data
  const flatRows = [
    ["Account", "State", "Cases", "Revenue"],
    ["Acme", "CA", 100, 5000],
    ["Beta", "NY", 50, 2500],
    ["", "", "", ""],  // empty row
    ["Gamma", "TX", 75, 3750],
  ];

  it("extracts data with a basic flat spec", () => {
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: {},
      codeGen: null,
    };
    const result = extractData(flatRows, spec);
    expect(result).not.toBeNull();
    expect(result.headers).toEqual(["Account", "State", "Cases", "Revenue"]);
    // 4 data rows minus 1 empty = 3
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].Account).toBe("Acme");
    expect(result.rows[0].Revenue).toBe(5000);
  });

  it("returns null when codeGen is present", () => {
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: {},
      codeGen: "some code",
    };
    const result = extractData(flatRows, spec);
    expect(result).toBeNull();
  });

  it("applies skip patterns to filter rows", () => {
    const rowsWithTotals = [
      ["Account", "Cases"],
      ["Acme", 100],
      ["Subtotal", 100],
      ["Beta", 50],
      ["Grand Total", 150],
    ];
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [{ column: 0, pattern: "Total|Subtotal" }],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: {},
      codeGen: null,
    };
    const result = extractData(rowsWithTotals, spec);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.Account)).toEqual(["Acme", "Beta"]);
  });

  it("applies column mapping to rename fields", () => {
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: { account: "Account", qty: "Cases", revenue: "Revenue" },
      codeGen: null,
    };
    const result = extractData(flatRows, spec);
    expect(result.rows[0].account).toBe("Acme");
    expect(result.rows[0].qty).toBe(100);
    expect(result.rows[0].revenue).toBe(5000);
  });

  it("handles headerRow > 0 (metadata rows before headers)", () => {
    const rowsWithMeta = [
      ["Report Title: Sales Summary"],
      ["Generated: 2026-03-17"],
      [""],
      ["Account", "Cases"],
      ["Acme", 100],
      ["Beta", 50],
    ];
    const spec = {
      headerRow: 3,
      dataStartRow: 4,
      skipPatterns: [],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: {},
      codeGen: null,
    };
    const result = extractData(rowsWithMeta, spec);
    expect(result.headers).toEqual(["Account", "Cases"]);
    expect(result.rows).toHaveLength(2);
  });

  it("applies columnOffset to shift columns, not rows", () => {
    // File with 2 leading blank columns
    const rowsWithOffset = [
      ["", "", "Account", "Cases", "Revenue"],
      ["", "", "Acme", 100, 5000],
      ["", "", "Beta", 50, 2500],
    ];
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [],
      columnOffset: 2,
      pivot: null,
      sheets: [],
      columnMapping: {},
      codeGen: null,
    };
    const result = extractData(rowsWithOffset, spec);
    expect(result.headers).toEqual(["Account", "Cases", "Revenue"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Account).toBe("Acme");
    expect(result.rows[0].Revenue).toBe(5000);
  });

  it("handles pivot spec with column mapping", () => {
    const pivotRows = [
      ["", "", "Jan", "", "Feb", ""],
      ["SKU", "Dist", "Qty", "Rev", "Qty", "Rev"],
      ["Wine A", "SGWS", 10, 500, 15, 750],
    ];
    const spec = {
      headerRow: 1,
      dataStartRow: 2,
      skipPatterns: [],
      columnOffset: 0,
      pivot: {
        startCol: 2,
        endCol: 5,
        groupSize: 2,
        labelRow: 0,
        fieldNames: ["qty", "revenue"],
      },
      sheets: [],
      columnMapping: { sku: "SKU" },
      codeGen: null,
    };
    const result = extractData(pivotRows, spec);
    expect(result).not.toBeNull();
    // 1 data row * 2 month groups = 2 flattened rows
    expect(result.rows).toHaveLength(2);
    // Pivot values are mapped via fieldNames
    expect(result.rows[0].qty).toBe(10);
    expect(result.rows[0].revenue).toBe(500);
    expect(result.rows[1].qty).toBe(15);
    expect(result.rows[1].revenue).toBe(750);
  });
});
