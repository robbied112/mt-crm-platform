/**
 * Tests for mergeSheets — multi-sheet merge strategies.
 */
import { describe, it, expect } from "vitest";
import { mergeSheets } from "../utils/mergeSheets";

// ─── Helpers ───────────────────────────────────────────────────

function makeSheet(name, headers, rows) {
  return {
    name,
    headers,
    rows: rows.map((values) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    }),
  };
}

// ─── dedup_by_key ──────────────────────────────────────────────

describe("mergeSheets — dedup_by_key", () => {
  it("merges products by SKU, later sheet enriches earlier ones", () => {
    const sheet1 = makeSheet("Batch 1", ["Product", "SKU", "Cases"], [
      ["White Wine", "MT-WHT-750", "12"],
      ["Red Wine", "MT-RED-750", "12"],
    ]);
    const sheet2 = makeSheet("Batch 2", ["Product Name", "SKU Code", "Varietal"], [
      ["White Wine", "MT-WHT-750", "Albariño"],
      ["Rosé", "MT-ROS-750", "Barbera"],
    ]);

    const result = mergeSheets([sheet1, sheet2], {
      strategy: "dedup_by_key",
      keyField: "sku",
      sheetMappings: {
        "Batch 1": { sku: "SKU", name: "Product", caseSize: "Cases" },
        "Batch 2": { sku: "SKU Code", name: "Product Name", varietal: "Varietal" },
      },
    });

    expect(result.rows).toHaveLength(3); // White (merged), Red, Rosé
    // White Wine should be enriched with varietal from Batch 2
    const white = result.rows.find((r) => r.sku === "MT-WHT-750");
    expect(white).toBeDefined();
    expect(white.name).toBe("White Wine"); // from Batch 1 (first seen)
    expect(white.varietal).toBe("Albariño"); // enriched from Batch 2
    expect(white.caseSize).toBe("12"); // from Batch 1
    expect(result.sourceSheets).toEqual(["Batch 1", "Batch 2"]);
  });

  it("handles missing key gracefully — rows without key still included", () => {
    const sheet1 = makeSheet("Data", ["Name", "SKU"], [
      ["Product A", "SKU-A"],
      ["Product B", ""], // no key
    ]);

    const result = mergeSheets([sheet1], {
      strategy: "dedup_by_key",
      keyField: "sku",
      sheetMappings: { Data: { sku: "SKU", name: "Name" } },
    });

    // Single sheet — should pass through
    expect(result.rows).toHaveLength(2);
  });
});

// ─── append ────────────────────────────────────────────────────

describe("mergeSheets — append", () => {
  it("concatenates rows from multiple sheets", () => {
    const sheet1 = makeSheet("Jan", ["Account", "Cases"], [
      ["Acme", "10"],
      ["Beta", "20"],
    ]);
    const sheet2 = makeSheet("Feb", ["Account", "Cases"], [
      ["Acme", "15"],
      ["Gamma", "5"],
    ]);

    const result = mergeSheets([sheet1, sheet2], {
      strategy: "append",
      sheetMappings: {
        Jan: { acct: "Account", cases: "Cases" },
        Feb: { acct: "Account", cases: "Cases" },
      },
    });

    expect(result.rows).toHaveLength(4);
    expect(result.sourceSheets).toEqual(["Jan", "Feb"]);
  });

  it("adds _sourceSheet field to each row", () => {
    const sheet1 = makeSheet("Sheet1", ["Val"], [["a"]]);
    const sheet2 = makeSheet("Sheet2", ["Val"], [["b"]]);

    const result = mergeSheets([sheet1, sheet2], {
      strategy: "append",
      sheetMappings: {},
    });

    expect(result.rows[0]._sourceSheet).toBe("Sheet1");
    expect(result.rows[1]._sourceSheet).toBe("Sheet2");
  });
});

// ─── enrich ────────────────────────────────────────────────────

describe("mergeSheets — enrich", () => {
  it("joins supplementary columns by key without adding new rows", () => {
    const baseSheet = makeSheet("Products", ["Product", "SKU", "Price"], [
      ["White", "SKU-1", "$10"],
      ["Red", "SKU-2", "$12"],
    ]);
    const supplementSheet = makeSheet("Images", ["Code", "Image URL"], [
      ["SKU-1", "https://img/white.png"],
      ["SKU-2", "https://img/red.png"],
      ["SKU-3", "https://img/unknown.png"], // no match in base — should be ignored
    ]);

    const result = mergeSheets([baseSheet, supplementSheet], {
      strategy: "enrich",
      keyField: "sku",
      sheetMappings: {
        Products: { sku: "SKU", name: "Product", price: "Price" },
        Images: { sku: "Code", imageUrl: "Image URL" },
      },
    });

    expect(result.rows).toHaveLength(2); // no new rows from supplement
    expect(result.rows[0].imageUrl).toBe("https://img/white.png");
    expect(result.rows[1].imageUrl).toBe("https://img/red.png");
    expect(result.rows[0].name).toBe("White");
  });
});

// ─── Edge cases ────────────────────────────────────────────────

describe("mergeSheets — edge cases", () => {
  it("falls back to append for unknown strategy", () => {
    const sheet1 = makeSheet("A", ["X"], [["1"]]);
    const sheet2 = makeSheet("B", ["X"], [["2"]]);

    const result = mergeSheets([sheet1, sheet2], {
      strategy: "banana",
      sheetMappings: {},
    });

    // Should behave like append
    expect(result.rows).toHaveLength(2);
  });

  it("returns empty result for empty sheetsData", () => {
    const result = mergeSheets([], { strategy: "append" });
    expect(result.rows).toHaveLength(0);
    expect(result.headers).toHaveLength(0);
  });

  it("passes through single sheet unchanged", () => {
    const sheet = makeSheet("Only", ["A", "B"], [["1", "2"]]);
    const result = mergeSheets([sheet], {
      strategy: "dedup_by_key",
      keyField: "a",
      sheetMappings: { Only: { a: "A", b: "B" } },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.sourceSheets).toEqual(["Only"]);
  });
});
