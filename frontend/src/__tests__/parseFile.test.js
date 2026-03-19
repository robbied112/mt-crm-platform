/**
 * Tests for parseFile utility — CSV/XLSX parsing, header detection,
 * QuickBooks grouped format detection and processing.
 *
 * Now imports core functions directly from the shared pipeline package
 * (previously replicated inline — see TODO-006, now TODO-020).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as XLSX from "xlsx";
import { QB_GROUPED_CSV_ROWS, CSV_WITH_METADATA_ROWS } from "./fixtures/sampleData";
import parseFile, {
  findHeaderRow,
  cleanHeaders,
  detectGroupedFormat,
  processGroupedRows,
  processStandardRows,
  peekAllSheets,
  clearWorkbookCache,
} from "../utils/parseFile.js";

// ─── Tests ───────────────────────────────────────────────────

describe("findHeaderRow", () => {
  it("finds the header row in QuickBooks grouped data", () => {
    const idx = findHeaderRow(QB_GROUPED_CSV_ROWS);
    // Row 5 has: ["", "Type", "Date", "Num", "Product/Service", "Quantity", "Amount"]
    expect(idx).toBe(5);
  });

  it("finds header row when metadata rows precede it", () => {
    const idx = findHeaderRow(CSV_WITH_METADATA_ROWS);
    // Row 4 has: ["Account", "State", "Qty", "Amount"]
    expect(idx).toBe(4);
  });

  it("returns 0 for simple data with no metadata", () => {
    const simpleData = [
      ["Name", "State", "Amount"],
      ["Test Co", "NY", "100"],
    ];
    expect(findHeaderRow(simpleData)).toBe(0);
  });

  it("returns 0 for empty data", () => {
    expect(findHeaderRow([])).toBe(0);
  });

  it("skips pivot period label rows and finds the real header below", () => {
    const rawRows = [
      ["VIP 4M Rolling Period Report", "", "", "", "", "", ""],
      ["", "", "", "1 Month 12/1/2025 thru 12/31/2025", "", "1 Month 1/1/2026 thru 1/31/2026", ""],
      ["Account", "State", "Product", "Quantity", "Revenue", "Quantity", "Revenue"],
      ["Acme Wine Bar", "NY", "Pinot Noir", "10", "500", "12", "600"],
    ];
    // Row 0: title (only 1 non-empty cell → skipped)
    // Row 1: period labels → should be skipped by the new guard
    // Row 2: actual headers → should be selected
    expect(findHeaderRow(rawRows)).toBe(2);
  });

  it("does not skip rows with only one period label cell", () => {
    const rawRows = [
      ["1 Month 12/1/2025 thru 12/31/2025", "Account", "State", "Qty"],
      ["Dec 2025", "Acme", "NY", "10"],
    ];
    // Only 1 cell matches the period pattern — row should NOT be skipped
    expect(findHeaderRow(rawRows)).toBe(0);
  });
});

describe("cleanHeaders", () => {
  it("preserves normal header names", () => {
    expect(cleanHeaders(["Name", "State", "Amount"])).toEqual(["Name", "State", "Amount"]);
  });

  it("replaces empty headers with Column_X names", () => {
    const result = cleanHeaders(["Name", "", "Amount"]);
    expect(result[1]).toBe("Column_B");
  });

  it("deduplicates identical header names", () => {
    const result = cleanHeaders(["Amount", "Amount", "Amount"]);
    expect(result).toEqual(["Amount", "Amount_2", "Amount_3"]);
  });

  it("replaces __EMPTY headers from XLSX parsing", () => {
    const result = cleanHeaders(["Name", "__EMPTY", "__EMPTY_1"]);
    expect(result[1]).toBe("Column_B");
    expect(result[2]).toBe("Column_C");
  });
});

describe("detectGroupedFormat", () => {
  it("detects QuickBooks grouped format", () => {
    const headerIdx = 5;
    expect(detectGroupedFormat(QB_GROUPED_CSV_ROWS, headerIdx)).toBe(true);
  });

  it("returns false for standard flat data", () => {
    const flatData = [
      ["Name", "State", "Amount"],
      ["Co A", "NY", "100"],
      ["Co B", "CA", "200"],
      ["Co C", "TX", "300"],
    ];
    expect(detectGroupedFormat(flatData, 0)).toBe(false);
  });
});

describe("processGroupedRows", () => {
  it("propagates customer names from group headers to data rows", () => {
    const headerIdx = 5;
    const { rows } = processGroupedRows(QB_GROUPED_CSV_ROWS, headerIdx);

    // Should have transaction rows, not group headers or totals
    expect(rows.length).toBeGreaterThan(0);

    // Every row should have a Customer value (propagated from group header)
    rows.forEach((row) => {
      expect(row.Customer).toBeTruthy();
    });

    // Check specific customer propagation
    const coastalRows = rows.filter((r) => r.Customer === "Coastal Wine Bar");
    expect(coastalRows.length).toBe(3);

    const harborRows = rows.filter((r) => r.Customer === "Harbor Restaurant Group");
    expect(harborRows.length).toBe(4);
  });

  it("filters out Total rows", () => {
    const headerIdx = 5;
    const { rows } = processGroupedRows(QB_GROUPED_CSV_ROWS, headerIdx);

    rows.forEach((row) => {
      const customer = String(row.Customer || "");
      expect(customer).not.toMatch(/^Total/);
      expect(customer).not.toBe("TOTAL");
    });
  });

  it("labels column 0 as Customer when empty in header", () => {
    const headerIdx = 5;
    const { headers } = processGroupedRows(QB_GROUPED_CSV_ROWS, headerIdx);
    expect(headers[0]).toBe("Customer");
  });
});

describe("processStandardRows", () => {
  it("parses standard CSV with metadata rows skipped", () => {
    const headerIdx = 4; // after metadata rows
    const { headers, rows } = processStandardRows(CSV_WITH_METADATA_ROWS, headerIdx);

    expect(headers).toEqual(["Account", "State", "Qty", "Amount"]);
    expect(rows.length).toBe(2);
    expect(rows[0].Account).toBe("The Wine Cellar");
    expect(rows[1].Account).toBe("Bella Italia");
  });

  it("filters out total rows", () => {
    const data = [
      ["Account", "State", "Amount"],
      ["Co A", "NY", "100"],
      ["Total", "", "100"],
    ];
    const { rows } = processStandardRows(data, 0);
    expect(rows.length).toBe(1);
    expect(rows[0].Account).toBe("Co A");
  });

  it("detects pivot periods and disambiguates duplicate headers with period labels", () => {
    const rawRows = [
      ["VIP 4M Rolling Period Report", "", "", "", "", "", ""],
      ["", "", "", "1 Month 12/1/2025 thru 12/31/2025", "", "1 Month 1/1/2026 thru 1/31/2026", ""],
      ["Account", "State", "Product", "Quantity", "Revenue", "Quantity", "Revenue"],
      ["Acme Wine Bar", "NY", "Pinot Noir", "10", "500", "12", "600"],
    ];
    const headerIdx = findHeaderRow(rawRows);
    expect(headerIdx).toBe(2);

    const { headers, rows, _pivotMeta } = processStandardRows(rawRows, headerIdx);

    // Duplicate "Quantity" and "Revenue" headers should be disambiguated with period labels
    expect(headers).toContain("Account");
    expect(headers).toContain("State");
    expect(headers).toContain("Quantity");
    // Second occurrence gets period label suffix
    expect(headers.some((h) => h.includes("[1M Jan 2026]"))).toBe(true);

    // Pivot metadata should be present
    expect(_pivotMeta).toBeDefined();
    expect(_pivotMeta.periods.length).toBe(2);

    // Data should parse correctly
    expect(rows.length).toBe(1);
    expect(rows[0].Account).toBe("Acme Wine Bar");
  });
});

// ─── peekAllSheets ──────────────────────────────────────────────

/**
 * Helper: build a multi-sheet XLSX workbook in memory and return a File object.
 * Also installs a minimal FileReader shim for the Node test environment.
 */
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

/** Minimal FileReader shim — reads File as ArrayBuffer synchronously via onload. */
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

describe("peekAllSheets", () => {
  beforeEach(() => {
    clearWorkbookCache();
    installFileReaderShim();
  });

  afterEach(() => {
    clearWorkbookCache();
  });

  it("returns headers + sample rows for all sheets", async () => {
    const file = buildXlsxFile([
      {
        name: "Products",
        headers: ["Name", "SKU", "Price"],
        dataRows: [
          ["White Wine", "MT-WHT-750", "10"],
          ["Red Wine", "MT-RED-750", "12"],
        ],
      },
      {
        name: "Images",
        headers: ["SKU", "Image URL"],
        dataRows: [
          ["MT-WHT-750", "https://img/white.png"],
          ["MT-RED-750", "https://img/red.png"],
        ],
      },
    ]);

    // Must call parseFile first to populate the cache
    await parseFile(file);

    const result = peekAllSheets(file);
    expect(result).toHaveLength(2);

    const products = result.find((s) => s.name === "Products");
    expect(products).toBeDefined();
    expect(products.headers).toEqual(["Name", "SKU", "Price"]);
    expect(products.sampleRows).toHaveLength(2);
    expect(products.sampleRows[0].Name).toBe("White Wine");

    const images = result.find((s) => s.name === "Images");
    expect(images).toBeDefined();
    expect(images.headers).toEqual(["SKU", "Image URL"]);
    expect(images.sampleRows).toHaveLength(2);
  });

  it("skips sheets that have no usable data", async () => {
    const file = buildXlsxFile([
      {
        name: "Data",
        headers: ["Name", "SKU", "Price"],
        dataRows: [["Wine A", "SKU-1", "10"]],
      },
      {
        name: "Empty",
        headers: ["X"],  // only 1 header — below the minimum of 2
        dataRows: [],
      },
      {
        name: "More Data",
        headers: ["Account", "State", "Amount"],
        dataRows: [["Acme", "NY", "100"]],
      },
    ]);

    await parseFile(file);

    const result = peekAllSheets(file);
    // "Empty" sheet has only 1 header so it should be skipped
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toEqual(["Data", "More Data"]);
  });

  it("applies dynamic sample budget — 50/N rows per sheet", async () => {
    // 5 sheets → 50/5 = 10 rows per sheet (above min of 3)
    const sheets = [];
    for (let i = 0; i < 5; i++) {
      const dataRows = Array.from({ length: 20 }, (_, j) => [`Row ${j}`, `Val ${j}`]);
      sheets.push({
        name: `Sheet${i + 1}`,
        headers: ["Col A", "Col B"],
        dataRows,
      });
    }

    const file = buildXlsxFile(sheets);
    await parseFile(file);

    const result = peekAllSheets(file);
    expect(result).toHaveLength(5);

    // Each sheet should have at most 10 sample rows (50/5)
    for (const sheet of result) {
      expect(sheet.sampleRows.length).toBeLessThanOrEqual(10);
      expect(sheet.sampleRows.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array for single-sheet files", async () => {
    const file = buildXlsxFile([
      {
        name: "Only Sheet",
        headers: ["Name", "Value"],
        dataRows: [["A", "1"]],
      },
    ]);

    await parseFile(file);

    const result = peekAllSheets(file);
    expect(result).toEqual([]);
  });

  it("throws when workbook is not cached", () => {
    const file = new File([""], "uncached.xlsx", { lastModified: Date.now() });
    expect(() => peekAllSheets(file)).toThrow("workbook not cached");
  });
});
