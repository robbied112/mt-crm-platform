/**
 * Shared file parsing — header detection, grouped format handling,
 * and buffer-based parsing for server-side use.
 *
 * All functions are pure (no browser or Firebase dependencies).
 * Browser-specific File API wrapper lives in frontend/src/utils/parseFile.js.
 */

// xlsx is loaded lazily — only needed by parseFileBuffer for .xlsx files.
// This avoids requiring it in environments where only the pure parsing
// functions (findHeaderRow, cleanHeaders, etc.) are used.
let _xlsx;
function getXLSX() {
  if (!_xlsx) _xlsx = require("xlsx");
  return _xlsx;
}

/**
 * Given a 2D array of raw rows, find the real header row.
 * Heuristic: the header row is the first row where:
 *   - At least 3 non-empty cells exist, AND
 *   - More than half the cells are non-empty strings (not numbers)
 * Skips title rows, date ranges, blank rows, etc.
 */
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

/**
 * Clean up header names — deduplicate and replace empties.
 */
function cleanHeaders(headers) {
  const seen = {};
  return headers.map((h, i) => {
    let name = h == null ? "" : String(h).trim();
    if (!name || /^__EMPTY/.test(name) || /^empty\s*\d*$/i.test(name)) {
      name = `Column_${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    }
    if (seen[name]) {
      seen[name]++;
      name = `${name}_${seen[name]}`;
    } else {
      seen[name] = 1;
    }
    return name;
  });
}

/**
 * Detect if the data uses a QB-style grouped layout:
 * - Some rows have only column 0 filled (group header = customer name)
 * - Following rows have column 0 empty but other columns filled (transactions)
 * - "Total for X" rows appear as subtotals
 */
function detectGroupedFormat(rawRows, headerIdx) {
  let groupHeaders = 0;
  let dataWithEmpty0 = 0;
  const sampleEnd = Math.min(rawRows.length, headerIdx + 30);

  for (let i = headerIdx + 1; i < sampleEnd; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;

    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) {
      groupHeaders++;
    } else if (!col0 && otherFilled >= 2) {
      dataWithEmpty0++;
    }
  }

  return groupHeaders >= 2 && dataWithEmpty0 >= 3;
}

/**
 * Process QB-style grouped data:
 * 1. Propagate group name (column 0) down to transaction rows
 * 2. Filter out "Total for X" and pure summary rows
 * 3. Label column 0 as "Customer" if it was empty in the header
 */
function processGroupedRows(rawRows, headerIdx) {
  const headerRow = rawRows[headerIdx].map((c) => (c == null ? "" : String(c)));

  if (!headerRow[0].trim()) {
    headerRow[0] = "Customer";
  }

  const headers = cleanHeaders(headerRow);
  const dataRows = [];
  let currentGroup = "";

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;

    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;

    // Skip footer metadata
    if (col0.toLowerCase().startsWith("accrual basis") || col0.toLowerCase().startsWith("cash basis")) continue;

    // Group header row (customer name only, no other data)
    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) {
      currentGroup = col0;
      continue;
    }

    // "Total for X" row — skip
    if (col0.startsWith("Total for ") || col0 === "TOTAL" || col0 === "Total") continue;

    // Grand total row at the end
    if (row.slice(1).some((c) => String(c).trim() === "TOTAL")) continue;

    // Regular data row — propagate group name
    if (otherFilled >= 1) {
      const obj = {};
      headers.forEach((h, j) => {
        let val = row[j] ?? "";
        if (j === 0 && !String(val).trim() && currentGroup) {
          val = currentGroup;
        }
        obj[h] = val;
      });
      dataRows.push(obj);
    }
  }

  return { headers, rows: dataRows };
}

/**
 * Standard (non-grouped) row processing.
 */
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

/**
 * Parse a file from a Buffer (for server-side / Cloud Functions).
 * @param {Buffer} buffer - File contents
 * @param {string} ext - File extension including dot (e.g. ".csv", ".xlsx")
 * @param {{ sheets?: string[] }} [options] - Optional options object
 *   - sheets: array of sheet names to parse; when provided returns an array of
 *     { sheetName, headers, rows } objects instead of a single { headers, rows }.
 * @returns {{ headers: string[], rows: object[] } | Array<{ sheetName: string, headers: string[], rows: object[] }>}
 */
function parseFileBuffer(buffer, ext, options) {
  if (ext === ".csv" || ext === ".tsv") {
    const text = buffer.toString("utf-8");
    const delimiter = ext === ".tsv" ? "\t" : ",";
    const rawRows = text.split("\n").map((line) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "")));
    const headerIdx = findHeaderRow(rawRows);
    const result = detectGroupedFormat(rawRows, headerIdx)
      ? processGroupedRows(rawRows, headerIdx)
      : processStandardRows(rawRows, headerIdx);
    // Multi-sheet option is a no-op for CSV/TSV — wrap in array if requested
    if (options && options.sheets && options.sheets.length > 0) {
      return [{ sheetName: "Sheet1", ...result }];
    }
    return result;
  }

  const XLSX = getXLSX();
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // Multi-sheet mode: process each named sheet
  if (options && options.sheets && options.sheets.length > 0) {
    return options.sheets.map((sheetName) => {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) {
        return { sheetName, headers: [], rows: [] };
      }
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      const headerIdx = findHeaderRow(rawRows);
      const parsed = detectGroupedFormat(rawRows, headerIdx)
        ? processGroupedRows(rawRows, headerIdx)
        : processStandardRows(rawRows, headerIdx);
      return { sheetName, ...parsed };
    });
  }

  // Default: single-sheet mode (existing behavior)
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  const headerIdx = findHeaderRow(rawRows);
  return detectGroupedFormat(rawRows, headerIdx)
    ? processGroupedRows(rawRows, headerIdx)
    : processStandardRows(rawRows, headerIdx);
}

/**
 * Return the list of sheet names from an XLSX/XLS workbook buffer.
 * For CSV/TSV (which have no concept of sheets), returns ["Sheet1"].
 * @param {Buffer} buffer - File contents
 * @param {string} ext - File extension including dot (e.g. ".csv", ".xlsx")
 * @returns {string[]}
 */
function getSheetNames(buffer, ext) {
  if (!ext || ext === ".csv" || ext === ".tsv") {
    return ["Sheet1"];
  }
  const XLSX = getXLSX();
  const wb = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  return wb.SheetNames;
}

/**
 * Parse raw 2D rows (from any source) into { headers, rows }.
 * Detects header row, grouped format, and cleans data.
 * @param {Array[]} rawRows - 2D array of cell values
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseRawRows(rawRows) {
  const headerIdx = findHeaderRow(rawRows);
  return detectGroupedFormat(rawRows, headerIdx)
    ? processGroupedRows(rawRows, headerIdx)
    : processStandardRows(rawRows, headerIdx);
}

module.exports = {
  findHeaderRow,
  cleanHeaders,
  detectGroupedFormat,
  processGroupedRows,
  processStandardRows,
  parseFileBuffer,
  parseRawRows,
  getSheetNames,
};
