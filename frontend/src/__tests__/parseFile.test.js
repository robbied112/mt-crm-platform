/**
 * Tests for parseFile utility — CSV/XLSX parsing, header detection,
 * QuickBooks grouped format detection and processing.
 *
 * Now imports core functions directly from the shared pipeline package
 * (previously replicated inline — see TODO-006, now TODO-020).
 */
import { describe, it, expect } from "vitest";
import { QB_GROUPED_CSV_ROWS, CSV_WITH_METADATA_ROWS } from "./fixtures/sampleData";
import {
  findHeaderRow,
  cleanHeaders,
  detectGroupedFormat,
  processGroupedRows,
  processStandardRows,
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
});
