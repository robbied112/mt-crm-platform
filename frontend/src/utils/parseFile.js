/**
 * Browser file parser — wraps shared pipeline core with File/FileReader APIs.
 * Core parsing logic (header detection, grouped format) lives in packages/pipeline/src/parseFile.js.
 *
 * Smart sheet selection: when an Excel file has multiple sheets, all sheets
 * are scored by data quality and the best one is auto-selected.  The result
 * includes `sheetInfo` metadata so callers can display a sheet picker and
 * re-parse a different sheet if needed.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Multi-sheet flow:                                           │
 * │  1. Read file → XLSX workbook (cached in _workbookCache)   │
 * │  2. For each sheet: peek first 15 rows → scoreSheet()      │
 * │  3. Pick highest-scoring sheet → full parseSheet()          │
 * │  4. Return { headers, rows, sheetInfo }                    │
 * │                                                             │
 * │ Sheet switching (via parseFileSheet):                       │
 * │  1. Hit _workbookCache (no re-read from disk)              │
 * │  2. Full parseSheet() on requested sheet                   │
 * │  3. Return { headers, rows, sheetInfo }                    │
 * └─────────────────────────────────────────────────────────────┘
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  findHeaderRow,
  cleanHeaders,
  detectGroupedFormat,
  processGroupedRows,
  processStandardRows,
} from "../../../packages/pipeline/src/parseFile.js";

// Re-export core functions for tests and other consumers
export { findHeaderRow, cleanHeaders, detectGroupedFormat, processGroupedRows, processStandardRows };

// ─── Workbook Cache ─────────────────────────────────────────────
// Keyed by file name + size + lastModified to avoid stale hits.
// Holds one entry at a time (last uploaded file).

let _workbookCache = { key: null, wb: null };

function cacheKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function getCachedWorkbook(file) {
  const key = cacheKey(file);
  return _workbookCache.key === key ? _workbookCache.wb : null;
}

function setCachedWorkbook(file, wb) {
  _workbookCache = { key: cacheKey(file), wb };
}

/** Clear cache — useful for tests. */
export function clearWorkbookCache() {
  _workbookCache = { key: null, wb: null };
}

// ─── Sheet Scoring ──────────────────────────────────────────────

/** Sheet names that almost never contain the primary data. */
export const PENALTY_NAMES = /^(summary|cover|instructions?|notes?|template|toc|table of contents|readme|info|about|help|index|overview|metadata|legend|definitions?)$/i;

/** Sheet names that suggest real data. */
export const BONUS_NAMES = /^(data|detail|details|report|sales|depletions?|inventory|placements?|velocity|revenue|invoices?|transactions?|orders?|accounts?|aging|ar|ap|quickbooks|qb|export|raw|sheet1)$/i;

/**
 * Score a single sheet to determine how likely it is to contain the primary data.
 * Higher score = more likely to be the real data sheet.
 *
 * Only needs the first ~15 rows (for header detection + density check) and
 * total row count. Callers should pass a small sample, not the full sheet.
 *
 * @param {string} sheetName
 * @param {Array[]} sampleRows - First ~15 rows (2D array of raw cell values)
 * @param {number} totalRowCount - Total number of rows in the sheet (from sheet range)
 * @returns {{ score: number, rowCount: number, headerCount: number, headerIdx: number }}
 */
export function scoreSheet(sheetName, sampleRows, totalRowCount) {
  if (!sampleRows || sampleRows.length === 0) {
    return { score: -100, rowCount: 0, headerCount: 0, headerIdx: 0 };
  }

  const headerIdx = findHeaderRow(sampleRows);
  const headerRow = sampleRows[headerIdx] || [];
  const nonEmptyHeaders = headerRow.filter(
    (c) => c !== null && c !== undefined && String(c).trim() !== ""
  );

  // Use actual total row count (from sheet range) minus header rows
  const dataRowCount = Math.max(0, (totalRowCount ?? sampleRows.length) - headerIdx - 1);

  // Base score: data rows (capped so a huge sheet doesn't dominate everything)
  let score = Math.min(dataRowCount, 5000);

  // Bonus for having real headers (3+ non-empty text headers)
  if (nonEmptyHeaders.length >= 3) {
    score += nonEmptyHeaders.length * 10;
  } else {
    score -= 200; // barely any columns — probably not data
  }

  // Data density: check available sample rows after header
  const sampleEnd = Math.min(sampleRows.length, headerIdx + 11);
  let filledCells = 0;
  let totalCells = 0;
  for (let i = headerIdx + 1; i < sampleEnd; i++) {
    const row = sampleRows[i];
    if (!row) continue;
    for (let j = 0; j < nonEmptyHeaders.length; j++) {
      totalCells++;
      if (row[j] !== null && row[j] !== undefined && String(row[j]).trim() !== "") {
        filledCells++;
      }
    }
  }
  const density = totalCells > 0 ? filledCells / totalCells : 0;
  score += density * 100;

  // Sheet name bonuses / penalties
  const trimmedName = sheetName.trim();
  if (PENALTY_NAMES.test(trimmedName)) {
    score -= 500;
  }
  if (BONUS_NAMES.test(trimmedName)) {
    score += 50;
  }

  return {
    score,
    rowCount: dataRowCount,
    headerCount: nonEmptyHeaders.length,
    headerIdx,
  };
}

/**
 * Get total row count from a sheet's range metadata without parsing all cells.
 * Falls back to 0 if the sheet has no data.
 */
function getSheetRowCount(sheet) {
  if (!sheet || !sheet["!ref"]) return 0;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  return range.e.r + 1; // 0-indexed end row + 1
}

/**
 * Read only the first N rows from a sheet (for scoring, not full parsing).
 * Uses sheet_to_json with a range limit to avoid converting every cell.
 */
function peekSheetRows(sheet, maxRows = 20) {
  if (!sheet || !sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const limitedRange = { ...range, e: { ...range.e, r: Math.min(range.e.r, maxRows - 1) } };
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    range: limitedRange,
  });
}

/**
 * Parse a specific sheet from an already-loaded XLSX workbook.
 * @param {object} wb - XLSX workbook object
 * @param {string} sheetName
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!rawRows || rawRows.length === 0) return { headers: [], rows: [] };

  const headerIdx = findHeaderRow(rawRows);
  const isGrouped = detectGroupedFormat(rawRows, headerIdx);
  return isGrouped
    ? processGroupedRows(rawRows, headerIdx)
    : processStandardRows(rawRows, headerIdx);
}

/**
 * Parse a browser File object (CSV/XLSX/XLS).
 *
 * For Excel files with multiple sheets, automatically selects the best sheet
 * using a data-quality heuristic. The result always includes:
 *   { headers, rows, sheetInfo }
 *
 * sheetInfo: {
 *   sheetNames: string[],          // all sheet names in the workbook
 *   selectedSheet: string,         // name of the sheet that was parsed
 *   sheets: Array<{ name, score, rowCount, headerCount }>,  // per-sheet scores
 *   multiSheet: boolean            // true when the file has >1 sheet
 * }
 *
 * For CSV/TSV, sheetInfo.multiSheet is false and sheetInfo.sheetNames is ["Sheet1"].
 */
export default function parseFile(file, { sheet: requestedSheet } = {}) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          const rawRows = result.data;
          const headerIdx = findHeaderRow(rawRows);
          const isGrouped = detectGroupedFormat(rawRows, headerIdx);

          const parsed = isGrouped
            ? processGroupedRows(rawRows, headerIdx)
            : processStandardRows(rawRows, headerIdx);

          resolve({
            ...parsed,
            sheetInfo: {
              sheetNames: ["Sheet1"],
              selectedSheet: "Sheet1",
              sheets: [{ name: "Sheet1", score: 0, rowCount: parsed.rows.length, headerCount: parsed.headers.length }],
              multiSheet: false,
            },
          });
        },
        error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
      });
    } else if (["xlsx", "xls"].includes(ext)) {
      // Try workbook cache first (avoids re-reading file for sheet switches)
      const cachedWb = getCachedWorkbook(file);
      if (cachedWb) {
        try {
          resolve(resolveExcel(cachedWb, requestedSheet));
        } catch (err) {
          reject(new Error(`Excel parse error: ${err.message}`));
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
          setCachedWorkbook(file, wb);
          resolve(resolveExcel(wb, requestedSheet));
        } catch (err) {
          reject(new Error(`Excel parse error: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file type: .${ext}`));
    }
  });
}

/**
 * Core Excel resolution: score sheets, pick best, parse it.
 * Extracted so both cache-hit and fresh-read paths share one codepath.
 */
function resolveExcel(wb, requestedSheet) {
  const sheetNames = wb.SheetNames;

  // If only one sheet or caller requested a specific sheet, skip scoring
  if (sheetNames.length === 1 || requestedSheet) {
    const targetSheet = requestedSheet || sheetNames[0];
    const parsed = parseSheet(wb, targetSheet);
    return {
      ...parsed,
      sheetInfo: {
        sheetNames,
        selectedSheet: targetSheet,
        sheets: [{ name: targetSheet, score: 0, rowCount: parsed.rows.length, headerCount: parsed.headers.length }],
        multiSheet: sheetNames.length > 1,
      },
    };
  }

  // Multiple sheets — score each one using only first 20 rows (perf optimization)
  const scored = sheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const totalRows = getSheetRowCount(sheet);
    const sampleRows = peekSheetRows(sheet, 20);
    const result = scoreSheet(name, sampleRows, totalRows);
    return { name, ...result };
  });

  // Sort by score descending — best sheet first
  scored.sort((a, b) => b.score - a.score);
  const bestSheet = scored[0].name;

  // Full parse only the winning sheet
  const parsed = parseSheet(wb, bestSheet);

  return {
    ...parsed,
    sheetInfo: {
      sheetNames,
      selectedSheet: bestSheet,
      sheets: scored.map(({ name, score, rowCount, headerCount }) => ({
        name, score, rowCount, headerCount,
      })),
      multiSheet: true,
    },
  };
}

/**
 * Re-parse a file using a specific sheet name.
 * Uses the cached workbook from the first parse — no redundant file read.
 */
export function parseFileSheet(file, sheetName) {
  return parseFile(file, { sheet: sheetName });
}
