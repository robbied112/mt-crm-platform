/**
 * Smoke tests for runComprehend — shared comprehend orchestration helper.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as XLSX from "xlsx";
import parseFile, { clearWorkbookCache } from "../utils/parseFile.js";
import { runComprehend, detectMergeableSheets } from "../utils/runComprehend.js";

// ─── Helpers ────────────────────────────────────────────────────

function buildXlsxFile(sheets, fileName = "test.xlsx") {
  const wb = XLSX.utils.book_new();
  for (const { name, headers, dataRows } of sheets) {
    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: Date.now(),
  });
}

/** Minimal FileReader shim for Node test environment. */
function installFileReaderShim() {
  if (typeof globalThis.FileReader !== "undefined") return;
  globalThis.FileReader = class {
    readAsArrayBuffer(file) {
      file.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onload) this.onload({ target: { result: buf } });
      });
    }
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("runComprehend", () => {
  beforeEach(() => {
    clearWorkbookCache();
    installFileReaderShim();
  });

  afterEach(() => {
    clearWorkbookCache();
  });

  it("sends allSheets to comprehend for multi-sheet files", async () => {
    const file = buildXlsxFile([
      {
        name: "Batch 1",
        headers: ["Product", "SKU", "Cases"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "12"],
          ["Red Wine", "MT-RED-750", "12"],
        ],
      },
      {
        name: "Batch 2",
        headers: ["Product Name", "SKU Code", "Varietal"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "Albariño"],
          ["Rosé", "MT-ROS-750", "Barbera"],
        ],
      },
    ]);

    // Parse first to populate cache
    const parsed = await parseFile(file);

    // Mock comprehend callable — capture what it receives
    let capturedArgs = null;
    const mockComprehend = vi.fn(async (args) => {
      capturedArgs = args;
      return {
        data: {
          reportType: "product_sheet",
          mapping: { sku: "SKU", name: "Product" },
          columnSemantics: {},
        },
      };
    });

    await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    expect(mockComprehend).toHaveBeenCalledOnce();

    // Verify allSheets was sent
    expect(capturedArgs.allSheets).toBeDefined();
    expect(capturedArgs.allSheets).toHaveLength(2);
    expect(capturedArgs.allSheets[0].name).toBe("Batch 1");
    expect(capturedArgs.allSheets[0].headers).toContain("Product");
    expect(capturedArgs.allSheets[0].sampleRows.length).toBeGreaterThan(0);
    expect(capturedArgs.allSheets[1].name).toBe("Batch 2");
  });

  it("does not send allSheets for single-sheet files", async () => {
    const file = buildXlsxFile([
      {
        name: "Only Sheet",
        headers: ["Name", "Value"],
        dataRows: [["A", "1"]],
      },
    ]);

    const parsed = await parseFile(file);

    let capturedArgs = null;
    const mockComprehend = vi.fn(async (args) => {
      capturedArgs = args;
      return { data: { mapping: {}, columnSemantics: {} } };
    });

    await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    // Single sheet → allSheets should be null/undefined
    expect(capturedArgs.allSheets).toBeFalsy();
  });

  it("handles sheetsToMerge response — merges and returns merged data", async () => {
    const file = buildXlsxFile([
      {
        name: "Products",
        headers: ["Name", "SKU", "Price"],
        dataRows: [
          ["White Wine", "SKU-1", "10"],
          ["Red Wine", "SKU-2", "12"],
        ],
      },
      {
        name: "Images",
        headers: ["Code", "Image URL"],
        dataRows: [
          ["SKU-1", "https://img/white.png"],
          ["SKU-2", "https://img/red.png"],
        ],
      },
    ]);

    const parsed = await parseFile(file);

    const mockComprehend = vi.fn(async () => ({
      data: {
        reportType: "product_sheet",
        mapping: { sku: "SKU", name: "Name" },
        columnSemantics: {},
        sheetsToMerge: ["Products", "Images"],
        mergeStrategy: "enrich",
        mergeKeyField: "sku",
        sheetMappings: {
          Products: { sku: "SKU", name: "Name", price: "Price" },
          Images: { sku: "Code", imageUrl: "Image URL" },
        },
      },
    }));

    const result = await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    // Should have merged data
    expect(result.mergedData).toBeDefined();
    expect(result.mergedData.rows.length).toBe(2);
    // Enriched rows should have imageUrl from Images sheet
    const white = result.mergedData.rows.find((r) => r.sku === "SKU-1");
    expect(white).toBeDefined();
    expect(white.imageUrl).toBe("https://img/white.png");
  });

  it("heuristic merges sheets sharing a key column before AI call", async () => {
    const file = buildXlsxFile([
      {
        name: "Batch 1",
        headers: ["Product", "SKU", "Cases"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "12"],
          ["Red Wine", "MT-RED-750", "12"],
        ],
      },
      {
        name: "Batch 2",
        headers: ["Product", "SKU", "Varietal"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "Albariño"],
          ["Sparkling Rosé", "MT-SRS-750", "Barbera"],
        ],
      },
    ]);

    const parsed = await parseFile(file);

    let capturedArgs = null;
    const mockComprehend = vi.fn(async (args) => {
      capturedArgs = args;
      return {
        data: {
          reportType: "product_catalog",
          mapping: { sku: "SKU", name: "Product" },
          columnSemantics: {},
        },
      };
    });

    const result = await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    // Should have merged before AI call
    expect(result.mergedData).toBeDefined();
    expect(result.mergedData.rows.length).toBe(3); // 2 + 1 new from Batch 2

    // AI should receive merged headers (superset of both sheets)
    expect(capturedArgs.headers).toContain("Product");
    expect(capturedArgs.headers).toContain("SKU");
    expect(capturedArgs.headers).toContain("Cases");
    expect(capturedArgs.headers).toContain("Varietal");

    // Merged rows should have enriched data
    const white = result.parsed.rows.find((r) => r.SKU === "MT-WHT-750");
    expect(white).toBeDefined();
    expect(white.Product).toBe("White Wine");
    expect(white.Varietal).toBe("Albariño"); // enriched from Batch 2
  });

  it("heuristic skips sheets that don't share key columns", async () => {
    const file = buildXlsxFile([
      {
        name: "Products",
        headers: ["Product", "SKU", "Cases"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "12"],
        ],
      },
      {
        name: "Codes",
        headers: ["Zephyr Code", "Description", "Batch"],
        dataRows: [
          ["YOLO-MT-WHT", "White Wine Original", "1"],
        ],
      },
    ]);

    const parsed = await parseFile(file);

    let capturedArgs = null;
    const mockComprehend = vi.fn(async (args) => {
      capturedArgs = args;
      return {
        data: {
          reportType: "product_catalog",
          mapping: { sku: "SKU" },
          columnSemantics: {},
        },
      };
    });

    const result = await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    // No merge — sheets don't share columns
    expect(result.mergedData).toBeNull();
  });

  it("falls back gracefully when comprehend fails", async () => {
    const file = buildXlsxFile([
      {
        name: "Data",
        headers: ["Name", "Value"],
        dataRows: [["A", "1"]],
      },
    ]);

    const parsed = await parseFile(file);

    const mockComprehend = vi.fn(async () => {
      throw new Error("API timeout");
    });

    const result = await runComprehend({
      file,
      parsed,
      comprehendCallable: mockComprehend,
      tenantId: "test-tenant",
    });

    // Should return without mapping, with error in analysis
    expect(result.mapping).toBeNull();
    expect(result.analysis.error).toBe(true);
    // Original parsed data should be preserved
    expect(result.parsed).toBe(parsed);
  });
});

// ─── detectMergeableSheets unit tests ────────────────────────────

describe("detectMergeableSheets", () => {
  it("returns null for null/empty/single-sheet input", () => {
    expect(detectMergeableSheets(null)).toBeNull();
    expect(detectMergeableSheets([])).toBeNull();
    expect(detectMergeableSheets([
      { name: "Sheet1", headers: ["SKU", "Name"], sampleRows: [{ SKU: "A", Name: "B" }] },
    ])).toBeNull();
  });

  it("detects sheets sharing a SKU column", () => {
    const allSheets = [
      {
        name: "Batch 1",
        headers: ["Product", "SKU", "Cases"],
        sampleRows: [
          { Product: "White", SKU: "MT-WHT-750", Cases: "12" },
          { Product: "Red", SKU: "MT-RED-750", Cases: "12" },
        ],
      },
      {
        name: "Batch 2",
        headers: ["Product", "SKU", "Varietal"],
        sampleRows: [
          { Product: "White", SKU: "MT-WHT-750", Varietal: "Albariño" },
          { Product: "Rosé", SKU: "MT-ROS-750", Varietal: "Barbera" },
        ],
      },
    ];

    const result = detectMergeableSheets(allSheets);
    expect(result).not.toBeNull();
    expect(result.sheetsToMerge).toContain("Batch 1");
    expect(result.sheetsToMerge).toContain("Batch 2");
    expect(result.strategy).toBe("dedup_by_key");
    // Should pick SKU (key pattern match) over Product
    expect(result.keyField).toBe("SKU");
  });

  it("detects Product Details.xlsx pattern — 3 of 4 sheets share SKU", () => {
    const allSheets = [
      {
        name: "Batch 3",
        headers: ["Product", "Full Product Description", "SKU", "UPC/GTIN BOTTLE"],
        sampleRows: [
          { Product: "Sparkling White", "Full Product Description": "Missing Thorn...", SKU: "MT-NASWT-750", "UPC/GTIN BOTTLE": "123" },
          { Product: "Sparkling Rosé", "Full Product Description": "Missing Thorn...", SKU: "MT-NASRS-750", "UPC/GTIN BOTTLE": "456" },
        ],
      },
      {
        name: "Zephyr Codes",
        headers: ["Zephyr SKU Code", "Product Description", "Batch", "Label"],
        sampleRows: [
          { "Zephyr SKU Code": "YOLO-MT", "Product Description": "White", Batch: "1", Label: "Original" },
        ],
      },
      {
        name: "Batch 1+2",
        headers: ["Product", "Full Product Description", "SKU", "UPC/GTIN"],
        sampleRows: [
          { Product: "Still White", "Full Product Description": "Missing Thorn...", SKU: "MT-NAWHT-750", "UPC/GTIN": "789" },
          { Product: "Still Rosé", "Full Product Description": "Missing Thorn...", SKU: "MT-NAROS-750", "UPC/GTIN": "012" },
        ],
      },
      {
        name: "Batch 1+2 (2)",
        headers: ["Product", "Full Product Description", "Base Varietal", "SKU", "Image Link"],
        sampleRows: [
          { Product: "Still White", "Full Product Description": "Missing Thorn...", "Base Varietal": "Albariño", SKU: "MT-NAWHT-750", "Image Link": "https://img/w.png" },
          { Product: "Still Rosé", "Full Product Description": "Missing Thorn...", "Base Varietal": "Barbera", SKU: "MT-NAROS-750", "Image Link": "https://img/r.png" },
        ],
      },
    ];

    const result = detectMergeableSheets(allSheets);
    expect(result).not.toBeNull();
    // Should merge the 3 sheets that share "SKU", NOT "Zephyr Codes"
    expect(result.sheetsToMerge).toContain("Batch 3");
    expect(result.sheetsToMerge).toContain("Batch 1+2");
    expect(result.sheetsToMerge).toContain("Batch 1+2 (2)");
    expect(result.sheetsToMerge).not.toContain("Zephyr Codes");
    expect(result.keyField).toBe("SKU");
  });

  it("returns null when no shared columns exist", () => {
    const allSheets = [
      {
        name: "Sheet1",
        headers: ["Name", "Value"],
        sampleRows: [{ Name: "A", Value: "1" }],
      },
      {
        name: "Sheet2",
        headers: ["Code", "Description"],
        sampleRows: [{ Code: "X", Description: "Y" }],
      },
    ];

    expect(detectMergeableSheets(allSheets)).toBeNull();
  });

  it("returns null when shared column is not key-like and has low uniqueness", () => {
    const allSheets = [
      {
        name: "Sheet1",
        headers: ["Status", "Name"],
        sampleRows: [
          { Status: "Active", Name: "A" },
          { Status: "Active", Name: "B" },
          { Status: "Active", Name: "C" },
          { Status: "Inactive", Name: "D" },
        ],
      },
      {
        name: "Sheet2",
        headers: ["Status", "Code"],
        sampleRows: [
          { Status: "Active", Code: "X" },
          { Status: "Active", Code: "Y" },
          { Status: "Active", Code: "Z" },
        ],
      },
    ];

    // "Status" is shared but not a key pattern, and values are not unique
    expect(detectMergeableSheets(allSheets)).toBeNull();
  });

  it("handles case-insensitive column matching", () => {
    const allSheets = [
      {
        name: "Sheet1",
        headers: ["sku", "Name"],
        sampleRows: [
          { sku: "SKU-1", Name: "Product 1" },
          { sku: "SKU-2", Name: "Product 2" },
        ],
      },
      {
        name: "Sheet2",
        headers: ["SKU", "Varietal"],
        sampleRows: [
          { SKU: "SKU-1", Varietal: "Cabernet" },
          { SKU: "SKU-3", Varietal: "Merlot" },
        ],
      },
    ];

    const result = detectMergeableSheets(allSheets);
    expect(result).not.toBeNull();
    expect(result.sheetsToMerge).toHaveLength(2);
  });
});
