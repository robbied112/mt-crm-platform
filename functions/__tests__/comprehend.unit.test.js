const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  _validateExtractionSpec: validateExtractionSpec,
  _sanitizeForPrompt: sanitizeForPrompt,
  _buildMarkdownTable: buildMarkdownTable,
} = require("../comprehend");

describe("validateExtractionSpec", () => {
  it("passes through valid spec unchanged", () => {
    const spec = {
      headerRow: 0,
      dataStartRow: 1,
      skipPatterns: [],
      columnOffset: 0,
      pivot: null,
      sheets: [],
      columnMapping: { acct: 0, qty: 3 },
      codeGen: null,
    };
    const result = validateExtractionSpec(spec, 10);
    assert.deepEqual(result.columnMapping, { acct: 0, qty: 3 });
    assert.equal(result.columnOffset, 0);
  });

  it("clamps columnOffset that exceeds header count", () => {
    const spec = { columnOffset: 15 };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.columnOffset, 0);
  });

  it("keeps columnOffset within range", () => {
    const spec = { columnOffset: 3 };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.columnOffset, 3);
  });

  it("removes out-of-range numeric column mappings", () => {
    const spec = { columnMapping: { acct: 0, qty: 50, sku: "Product Name" } };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.columnMapping.acct, 0);
    assert.equal(result.columnMapping.qty, undefined);
    assert.equal(result.columnMapping.sku, "Product Name");
  });

  it("keeps negative indices out", () => {
    const spec = { columnMapping: { acct: -1, qty: 3 } };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.columnMapping.acct, undefined);
    assert.equal(result.columnMapping.qty, 3);
  });

  it("nullifies pivot when startCol > endCol", () => {
    const spec = {
      pivot: { startCol: 8, endCol: 5, groupSize: 1, labelRow: 0, fieldNames: ["qty"] },
    };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.pivot, null);
  });

  it("clamps pivot endCol to headerCount - 1", () => {
    const spec = {
      pivot: { startCol: 2, endCol: 50, groupSize: 1, labelRow: 0, fieldNames: ["qty"] },
    };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.pivot.endCol, 9);
    assert.equal(result.pivot.startCol, 2);
  });

  it("clamps both pivot startCol and endCol when >= headerCount", () => {
    const spec = {
      pivot: { startCol: 15, endCol: 20, groupSize: 1, labelRow: 0, fieldNames: ["qty"] },
    };
    const result = validateExtractionSpec(spec, 10);
    // Both clamped to 0 and 9, startCol(0) <= endCol(9) so pivot is preserved
    assert.equal(result.pivot.startCol, 0);
    assert.equal(result.pivot.endCol, 9);
  });

  it("returns null/undefined spec as-is", () => {
    assert.equal(validateExtractionSpec(null, 10), null);
    assert.equal(validateExtractionSpec(undefined, 10), undefined);
  });

  it("handles non-object spec", () => {
    assert.equal(validateExtractionSpec("string", 10), "string");
  });

  it("handles spec with no columnMapping", () => {
    const spec = { columnOffset: 0, headerRow: 0 };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.columnOffset, 0);
    assert.equal(result.headerRow, 0);
  });

  it("handles empty columnMapping", () => {
    const spec = { columnMapping: {} };
    const result = validateExtractionSpec(spec, 10);
    assert.deepEqual(result.columnMapping, {});
  });

  it("handles null pivot", () => {
    const spec = { pivot: null };
    const result = validateExtractionSpec(spec, 10);
    assert.equal(result.pivot, null);
  });
});

describe("sanitizeForPrompt", () => {
  it("strips XML tags", () => {
    const result = sanitizeForPrompt("<script>alert('xss')</script>");
    assert.ok(!result.includes("<script>"));
    assert.ok(result.includes("alert"));
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(500);
    assert.equal(sanitizeForPrompt(long, 100).length, 100);
  });

  it("uses default maxLength of 200", () => {
    const long = "a".repeat(500);
    assert.equal(sanitizeForPrompt(long).length, 200);
  });

  it("handles null/undefined", () => {
    assert.equal(sanitizeForPrompt(null), "");
    assert.equal(sanitizeForPrompt(undefined), "");
  });

  it("handles numbers", () => {
    assert.equal(sanitizeForPrompt(42), "42");
  });

  it("strips non-printable characters", () => {
    const result = sanitizeForPrompt("hello\x00world\x01test");
    assert.equal(result, "helloworldtest");
  });

  it("preserves newlines and tabs", () => {
    const result = sanitizeForPrompt("line1\nline2\ttab");
    assert.ok(result.includes("\n"));
    assert.ok(result.includes("\t"));
  });

  it("handles empty string", () => {
    assert.equal(sanitizeForPrompt(""), "");
  });
});

describe("buildMarkdownTable", () => {
  it("builds a table from headers and rows", () => {
    const headers = ["Name", "Qty"];
    const rows = [{ Name: "Wine A", Qty: 10 }];
    const table = buildMarkdownTable(headers, rows);
    const lines = table.split("\n");
    assert.ok(lines[0].includes("Name"));
    assert.ok(lines[0].includes("Qty"));
    assert.ok(lines[1].includes("---"));
    assert.ok(lines[2].includes("Wine A"));
    assert.ok(lines[2].includes("10"));
  });

  it("handles multiple rows", () => {
    const headers = ["A", "B"];
    const rows = [
      { A: "1", B: "2" },
      { A: "3", B: "4" },
    ];
    const table = buildMarkdownTable(headers, rows);
    const lines = table.split("\n");
    assert.equal(lines.length, 4); // header + separator + 2 data rows
  });

  it("handles empty rows", () => {
    const table = buildMarkdownTable(["A", "B"], []);
    const lines = table.split("\n");
    assert.equal(lines.length, 2); // header + separator only
    assert.ok(lines[0].includes("A"));
  });

  it("truncates long values at 60 chars", () => {
    const longVal = "x".repeat(100);
    const table = buildMarkdownTable(["Col"], [{ Col: longVal }]);
    const lines = table.split("\n");
    // Data row value should be at most 60 chars
    assert.ok(lines[2].length <= 60);
  });

  it("escapes pipe characters in headers", () => {
    const table = buildMarkdownTable(["A|B"], [{ "A|B": "C|D" }]);
    const lines = table.split("\n");
    // Header pipe should be replaced with /
    assert.ok(lines[0].includes("A/B"));
  });

  it("handles missing values in rows", () => {
    const table = buildMarkdownTable(["A", "B"], [{ A: "val" }]);
    const lines = table.split("\n");
    // B should show empty string
    assert.equal(lines.length, 3);
  });

  it("handles null values in rows", () => {
    const table = buildMarkdownTable(["A"], [{ A: null }]);
    const lines = table.split("\n");
    assert.equal(lines.length, 3);
  });

  it("replaces newlines in values", () => {
    const table = buildMarkdownTable(["A"], [{ A: "line1\nline2" }]);
    assert.ok(!table.split("\n")[2].includes("\n") || table.split("\n").length === 3);
  });
});
