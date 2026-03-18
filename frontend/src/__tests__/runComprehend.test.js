/**
 * Smoke tests for runComprehend — shared comprehend orchestration helper.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as XLSX from "xlsx";
import parseFile, { clearWorkbookCache } from "../utils/parseFile.js";
import { runComprehend } from "../utils/runComprehend.js";

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
