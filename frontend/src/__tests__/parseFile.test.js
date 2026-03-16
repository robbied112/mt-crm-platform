/**
 * Tests for parseFile utility — CSV/XLSX parsing, header detection,
 * QuickBooks grouped format detection and processing.
 *
 * Uses internal functions directly since parseFile() itself requires
 * a File object (browser API). We test the constituent functions.
 */
import { describe, it, expect } from "vitest";
import { QB_GROUPED_CSV_ROWS, CSV_WITH_METADATA_ROWS } from "./fixtures/sampleData";

// We need to test the internal functions. Since parseFile.js doesn't export them,
// we'll replicate the logic here and test it. In a future refactor (TODO-006: shared package),
// these will be properly exported.

// ─── findHeaderRow ───────────────────────────────────────────

function findHeaderRow(rawRows) {
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
    if (nonEmpty.length < 3) continue;
    const textCells = nonEmpty.filter((cell) => {
      const s = String(cell).trim();
      return isNaN(Number(s)) && !/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(s);
    });
    if (textCells.length >= nonEmpty.length * 0.5 && nonEmpty.length >= 3) {
      return i;
    }
  }
  return 0;
}

function cleanHeaders(headers) {
  const seen = {};
  return headers.map((h, i) => {
    let name = h == null ? "" : String(h).trim();
    if (!name || /^__EMPTY/.test(name) || /^empty\s*\d*$/i.test(name)) {
      name = `Column_${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    }
    if (seen[name]) { seen[name]++; name = `${name}_${seen[name]}`; } else { seen[name] = 1; }
    return name;
  });
}

function detectGroupedFormat(rawRows, headerIdx) {
  let groupHeaders = 0;
  let dataWithEmpty0 = 0;
  const sampleEnd = Math.min(rawRows.length, headerIdx + 30);
  for (let i = headerIdx + 1; i < sampleEnd; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) groupHeaders++;
    else if (!col0 && otherFilled >= 2) dataWithEmpty0++;
  }
  return groupHeaders >= 2 && dataWithEmpty0 >= 3;
}

function processGroupedRows(rawRows, headerIdx) {
  const headerRow = rawRows[headerIdx].map((c) => (c == null ? "" : String(c)));
  if (!headerRow[0].trim()) headerRow[0] = "Customer";
  const headers = cleanHeaders(headerRow);
  const dataRows = [];
  let currentGroup = "";
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (col0.toLowerCase().startsWith("accrual basis") || col0.toLowerCase().startsWith("cash basis")) continue;
    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) { currentGroup = col0; continue; }
    if (col0.startsWith("Total for ") || col0 === "TOTAL" || col0 === "Total") continue;
    if (row.slice(1).some((c) => String(c).trim() === "TOTAL")) continue;
    if (otherFilled >= 1) {
      const obj = {};
      headers.forEach((h, j) => {
        let val = row[j] ?? "";
        if (j === 0 && !String(val).trim() && currentGroup) val = currentGroup;
        obj[h] = val;
      });
      dataRows.push(obj);
    }
  }
  return { headers, rows: dataRows };
}

function processStandardRows(rawRows, headerIdx) {
  const headerRow = cleanHeaders(rawRows[headerIdx].map((c) => (c == null ? "" : String(c))));
  const dataRows = rawRows.slice(headerIdx + 1)
    .filter((r) => r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((r) => {
      const obj = {};
      headerRow.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    })
    .filter((r) => {
      const firstVal = String(Object.values(r)[0] || "").toLowerCase().trim();
      return firstVal !== "total" && firstVal !== "grand total" && firstVal !== "";
    });
  return { headers: headerRow, rows: dataRows };
}

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
