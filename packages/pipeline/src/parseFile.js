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
 * Skips title rows, date ranges, blank rows, and pivot period label rows.
 */
const _periodLabelPattern = /^\d+\s+months?\s+\d{1,2}\/\d{1,2}\/\d{4}\s+thru\s+\d{1,2}\/\d{1,2}\/\d{4}$/i;

function findHeaderRow(rawRows) {
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!row) continue;

    const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
    if (nonEmpty.length < 3) continue;

    // Skip rows that are pivot period labels (e.g. "1 Month 12/1/2025 thru 12/31/2025")
    const periodCells = nonEmpty.filter((cell) => _periodLabelPattern.test(String(cell).trim()));
    if (periodCells.length >= 2) continue;

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
 * When periodLabels is provided (array of strings, one per column index),
 * duplicate headers get the period label appended instead of a numeric suffix.
 */
function cleanHeaders(headers, periodLabels) {
  const seen = {};
  return headers.map((h, i) => {
    let name = h == null ? "" : String(h).trim();
    if (!name || /^__EMPTY/.test(name) || /^empty\s*\d*$/i.test(name)) {
      name = `Column_${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    }
    if (seen[name]) {
      seen[name]++;
      // If we have a period label for this column, use it for disambiguation
      const periodLabel = periodLabels && periodLabels[i] ? periodLabels[i] : null;
      if (periodLabel) {
        name = `${name} [${periodLabel}]`;
      } else {
        name = `${name}_${seen[name]}`;
      }
    } else {
      seen[name] = 1;
    }
    return name;
  });
}

/**
 * Filter out subtotal and total rows from a dataset.
 * Conservative — only removes obviously aggregated rows.
 *
 * @param {object[]} rows - Array of row objects
 * @param {string[]} headers - Array of header names
 * @returns {object[]} Filtered rows
 */
function filterSubtotalRows(rows, headers) {
  if (!rows || rows.length === 0) return rows;

  const firstHeader = headers && headers[0];

  return rows.filter((row) => {
    const firstVal = firstHeader != null ? String(row[firstHeader] || "").trim() : "";

    // "BRAND TOTAL", "SUPPLIER TOTAL", "TOTAL", "GRAND TOTAL", etc.
    if (/\bTOTAL\b/i.test(firstVal)) return false;

    // "Total for X" pattern (QB-style grouped reports)
    if (/^Total for /i.test(firstVal)) return false;

    // Row with only 1–2 non-empty cells is likely a summary row
    const nonEmptyCount = headers.filter((h) => {
      const v = String(row[h] || "").trim();
      return v !== "";
    }).length;
    if (nonEmptyCount <= 2 && nonEmptyCount > 0) {
      // Only filter if the first cell is also empty (pure trailing summary)
      if (!firstVal) return false;
    }

    return true;
  });
}

/**
 * Detect multi-period pivot column structure (e.g. VIP 4M Rolling Period reports).
 *
 * Looks at rows above headerIdx for period label patterns such as:
 *   "1 Month 12/1/2025 thru 12/31/2025"
 *   "2 Month 11/1/2025 thru 12/31/2025"
 *
 * @param {Array[]} rawRows - Full 2D array of raw rows
 * @param {number} headerIdx - Index of the detected header row
 * @returns {{ periods: Array<{ label: string, shortLabel: string, startCol: number, endCol: number }>, metricsPerPeriod: string[] } | null}
 */
function detectPivotPeriods(rawRows, headerIdx) {
  if (headerIdx < 1) return null;

  // Scan rows above the header for period label patterns
  // Pattern: "N Month M/D/YYYY thru M/D/YYYY" or "N Months ..."
  const periodPattern = /^\d+\s+months?\s+\d{1,2}\/\d{1,2}\/\d{4}\s+thru\s+\d{1,2}\/\d{1,2}\/\d{4}$/i;

  let periodRow = null;
  let periodRowIdx = -1;

  for (let i = 0; i < headerIdx; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const matches = row.filter((cell) => cell != null && periodPattern.test(String(cell).trim()));
    if (matches.length >= 2) {
      periodRow = row;
      periodRowIdx = i;
      break;
    }
  }

  if (!periodRow) return null;

  // Collect period blocks from the period label row
  const periods = [];
  let currentPeriod = null;

  for (let col = 0; col < periodRow.length; col++) {
    const cell = String(periodRow[col] || "").trim();
    if (periodPattern.test(cell)) {
      if (currentPeriod) {
        currentPeriod.endCol = col - 1;
        periods.push(currentPeriod);
      }
      currentPeriod = { label: cell, shortLabel: _shortenPeriodLabel(cell), startCol: col, endCol: col };
    }
  }
  if (currentPeriod) {
    // Last period extends to end of header row
    const headerRow = rawRows[headerIdx];
    currentPeriod.endCol = headerRow ? headerRow.length - 1 : currentPeriod.startCol;
    periods.push(currentPeriod);
  }

  if (periods.length < 2) return null;

  // Derive metric column names from the header row within the first period block
  const headerRow = rawRows[headerIdx];
  const firstPeriod = periods[0];
  const metricsPerPeriod = [];
  for (let col = firstPeriod.startCol; col <= firstPeriod.endCol && col < headerRow.length; col++) {
    const cell = String(headerRow[col] || "").trim();
    if (cell) metricsPerPeriod.push(cell);
  }

  return { periods, metricsPerPeriod };
}

/**
 * Convert a verbose period label into a compact display label.
 * "1 Month 12/1/2025 thru 12/31/2025" → "1M Dec 2025"
 * "2 Month 11/1/2025 thru 12/31/2025" → "2M Nov-Dec 2025"
 */
function _shortenPeriodLabel(label) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Extract: N Month(s) startDate thru endDate
  const m = label.match(/^(\d+)\s+months?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+thru\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
  if (!m) return label;

  const [, n, startMo, , startYr, endMo, , endYr] = m;
  const startMonth = MONTHS[parseInt(startMo, 10) - 1] || startMo;
  const endMonth = MONTHS[parseInt(endMo, 10) - 1] || endMo;

  if (startMonth === endMonth && startYr === endYr) {
    return `${n}M ${endMonth} ${endYr}`;
  }
  const startPart = startYr === endYr ? startMonth : `${startMonth} ${startYr}`;
  return `${n}M ${startPart}-${endMonth} ${endYr}`;
}

/**
 * Build a per-column period label array for use with cleanHeaders().
 * For each column index, returns the shortLabel of whichever period block
 * that column belongs to, or null if the column is before all periods.
 */
function _buildPeriodLabelsArray(periodInfo, totalCols) {
  const labels = new Array(totalCols).fill(null);
  for (const period of periodInfo.periods) {
    for (let col = period.startCol; col <= Math.min(period.endCol, totalCols - 1); col++) {
      labels[col] = period.shortLabel;
    }
  }
  return labels;
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
 * Handles pivot period detection for VIP/iDig-style multi-period reports.
 */
function processStandardRows(rawRows, headerIdx) {
  // Detect pivot period structure before building headers
  const pivotInfo = detectPivotPeriods(rawRows, headerIdx);

  let headerRow;
  let pivotMeta = undefined;

  if (pivotInfo) {
    const rawHeader = rawRows[headerIdx].map((c) => (c == null ? "" : String(c)));
    const periodLabels = _buildPeriodLabelsArray(pivotInfo, rawHeader.length);
    headerRow = cleanHeaders(rawHeader, periodLabels);
    pivotMeta = {
      periods: pivotInfo.periods,
      metricsPerPeriod: pivotInfo.metricsPerPeriod,
    };
  } else {
    headerRow = cleanHeaders(rawRows[headerIdx].map((c) => (c == null ? "" : String(c))));
  }

  let dataRows = rawRows.slice(headerIdx + 1)
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

  // Filter subtotal/total rows for pivot reports and standard reports alike
  dataRows = filterSubtotalRows(dataRows, headerRow);

  const result = { headers: headerRow, rows: dataRows };
  if (pivotMeta) {
    result._pivotMeta = pivotMeta;
  }
  return result;
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
  filterSubtotalRows,
  detectPivotPeriods,
  parseFileBuffer,
  parseRawRows,
  getSheetNames,
};
