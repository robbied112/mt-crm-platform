/**
 * Structure-Aware Data Extractor
 *
 * Executes ExtractionSpec objects (returned by the comprehendReport AI) to
 * extract structured data from raw spreadsheet rows.
 *
 * Handles:
 *   - Header row detection and data start row
 *   - Subtotal/summary row skipping via pattern matching
 *   - Pivot table flattening (weekly/monthly column pairs)
 *   - Column offset adjustment
 *   - Multi-sheet extraction
 *   - Column mapping from indices to internal field names
 *
 * All functions are pure (no browser or Firebase dependencies).
 */

const { cleanHeaders } = require("./parseFile");

// ─── applySkipPatterns ───────────────────────────────────────────

/**
 * Filter rows that match any skip pattern.
 *
 * @param {Array[]} rows       - 2D array of raw row arrays
 * @param {Array<{column: number, pattern: string}>} patterns
 * @returns {Array[]}          - rows with matching rows removed
 */
function applySkipPatterns(rows, patterns) {
  if (!patterns || patterns.length === 0) return rows;

  return rows.filter((row) => {
    for (const { column, pattern } of patterns) {
      let re;
      try {
        re = new RegExp(pattern);
      } catch {
        // Malformed regex — skip this pattern rather than crashing
        continue;
      }
      const cellVal = row == null ? "" : String(row[column] ?? "").trim();
      if (re.test(cellVal)) return false;
    }
    return true;
  });
}

// ─── flattenPivot ────────────────────────────────────────────────

/**
 * Flatten a pivot layout where each time-period occupies a fixed-width
 * column group (e.g., [qty, revenue] per week).
 *
 * For each source data row, one output row is emitted per group.
 * Non-pivot columns are copied as-is. Each output row gains:
 *   - `_pivotLabel`  — the label from rawRows[labelRow][groupCol] (first col of group)
 *   - one key per fieldName mapped to the column value within the group
 *
 * @param {Array[]} rawRows  - full 2D source array (including header/label rows)
 * @param {object}  spec     - full ExtractionSpec (must have .pivot and .dataStartRow)
 * @returns {Array[]}        - flattened 2D rows (no header row; use existing header logic)
 */
function flattenPivot(rawRows, spec) {
  const pivot = spec.pivot;
  if (!pivot) return rawRows.slice(spec.dataStartRow);

  const { startCol, endCol, groupSize, labelRow, fieldNames } = pivot;
  const dataRows = rawRows.slice(spec.dataStartRow);

  const flattened = [];

  for (const row of dataRows) {
    // Determine non-pivot column indices
    const nonPivotPart = (colIdx) => colIdx < startCol || colIdx > endCol;

    // Iterate over column groups
    for (let groupStart = startCol; groupStart <= endCol; groupStart += groupSize) {
      // Skip groups that fall outside endCol
      if (groupStart + groupSize - 1 > endCol) break;

      const flatRow = [];

      // Copy non-pivot columns
      for (let c = 0; c < (row ? row.length : 0); c++) {
        if (nonPivotPart(c)) {
          flatRow[c] = row[c];
        }
      }

      // Attach pivot label from the label row (using first col of group)
      const label = rawRows[labelRow] ? rawRows[labelRow][groupStart] : "";
      flatRow._pivotLabel = label ?? "";

      // Map fieldNames to their values within this group
      for (let fi = 0; fi < fieldNames.length; fi++) {
        const colIdx = groupStart + fi;
        if (colIdx <= endCol) {
          flatRow[fieldNames[fi]] = row ? (row[colIdx] ?? "") : "";
        }
      }

      flattened.push(flatRow);
    }
  }

  return flattened;
}

// ─── applyColumnMapping ──────────────────────────────────────────

/**
 * Remap row objects so that internal field names replace (or augment)
 * source column keys.
 *
 * Each entry in `mapping` can be:
 *   - a number  — zero-based column index into the original headers array
 *   - a string  — exact header name as it appears in `headers`
 *
 * The returned rows retain all original keys plus the mapped internal names.
 * When a mapping target is a number and headers[n] exists, the value is
 * copied from the header-keyed property; when it is a string, it is copied
 * directly.
 *
 * @param {object[]} rows     - array of row objects (keyed by header names)
 * @param {string[]} headers  - ordered header names (parallel to column indices)
 * @param {object}   mapping  - { [internalFieldName]: number | string }
 * @returns {object[]}        - rows with internal field names added/overwritten
 */
function applyColumnMapping(rows, headers, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return rows;

  // Pre-resolve mapping entries once
  const resolved = {};
  for (const [field, ref] of Object.entries(mapping)) {
    if (typeof ref === "number") {
      // Numeric index -> look up header name
      const headerName = headers[ref];
      resolved[field] = headerName != null ? headerName : null;
    } else if (typeof ref === "string") {
      // Direct header name reference
      resolved[field] = ref;
    }
  }

  return rows.map((row) => {
    const out = Object.assign({}, row);
    for (const [field, sourceKey] of Object.entries(resolved)) {
      if (sourceKey != null && Object.prototype.hasOwnProperty.call(row, sourceKey)) {
        out[field] = row[sourceKey];
      }
    }
    return out;
  });
}

// ─── extractData ────────────────────────────────────────────────

/**
 * Main entry point. Executes an ExtractionSpec against a 2D raw-row array
 * produced by XLSX.utils.sheet_to_json with { header: 1 }.
 *
 * ExtractionSpec shape:
 * {
 *   headerRow:     number,         // 0-indexed row containing column headers
 *   dataStartRow:  number,         // first row of data (often headerRow + 1)
 *   skipPatterns:  Array<{column: number, pattern: string}>,
 *   columnOffset:  number,         // shift all column refs by N (rarely needed)
 *   pivot: {
 *     startCol:    number,
 *     endCol:      number,
 *     groupSize:   number,
 *     labelRow:    number,
 *     fieldNames:  string[],
 *   } | null,
 *   sheets:        string[],       // which sheet names to process
 *   columnMapping: { [fieldName]: number | string },
 *   codeGen:       string | null,  // non-null means caller must use extractWithCode
 * }
 *
 * @param {Array[]} rawRows      - 2D array of cell values (header:1 format)
 * @param {object}  spec         - ExtractionSpec
 * @param {{ headers?: string[] }} [options]
 * @returns {{ headers: string[], rows: object[] } | null}
 *   Returns null when spec.codeGen is present (caller should use extractWithCode).
 */
function extractData(rawRows, spec, options) {
  // ── 1. Delegate to code-gen path ──────────────────────────────
  if (spec.codeGen != null) {
    return null;
  }

  // ── 2. Resolve headers ────────────────────────────────────────
  const colOffset = typeof spec.columnOffset === "number" ? spec.columnOffset : 0;

  const headerRowIndex = typeof spec.headerRow === "number" ? spec.headerRow : 0;
  const dataStartIndex = typeof spec.dataStartRow === "number" ? spec.dataStartRow : headerRowIndex + 1;

  const rawHeaderRow = (rawRows[headerRowIndex] || []).slice(colOffset);
  const headers = cleanHeaders(rawHeaderRow.map((c) => (c == null ? "" : String(c))));

  // ── 3. Slice data rows and apply column offset ──────────────
  let dataRows = rawRows.slice(dataStartIndex).map(
    (row) => (colOffset > 0 && Array.isArray(row) ? row.slice(colOffset) : row)
  );

  // ── 4. Apply skip patterns ────────────────────────────────────
  dataRows = applySkipPatterns(dataRows, spec.skipPatterns || []);

  // ── 5. Remove completely empty rows ──────────────────────────
  dataRows = dataRows.filter(
    (row) => row && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
  );

  let rows;

  // ── 6. Pivot flattening ───────────────────────────────────────
  if (spec.pivot) {
    // flattenPivot expects rawRows so it can read the labelRow; we need to
    // reconstruct context. We pass a synthetic rawRows where dataStartRow
    // points to our already-offset slice.
    const syntheticSpec = {
      ...spec,
      dataStartRow: 0, // dataRows is already sliced
      pivot: { ...spec.pivot },
    };
    const flatRows = flattenPivot([null, ...dataRows].slice(1), syntheticSpec);

    // Build header list that includes pivot field names
    const pivotHeaders = [
      ...headers,
      "_pivotLabel",
      ...(spec.pivot.fieldNames || []),
    ];
    const cleanedPivotHeaders = cleanHeaders(pivotHeaders);

    rows = flatRows.map((flatRow) => {
      const obj = {};
      // Copy named pivot fields stored directly on the array object
      const namedKeys = ["_pivotLabel", ...(spec.pivot.fieldNames || [])];

      // Map numeric indices to header names
      cleanedPivotHeaders.forEach((h, i) => {
        if (i < headers.length) {
          obj[h] = flatRow[i] ?? "";
        }
      });

      // Copy string-keyed pivot fields
      for (const key of namedKeys) {
        if (Object.prototype.hasOwnProperty.call(flatRow, key)) {
          obj[key] = flatRow[key];
        }
      }

      return obj;
    });

    // ── 7. Apply column mapping (pivot path) ───────────────────
    rows = applyColumnMapping(rows, cleanedPivotHeaders, spec.columnMapping || {});

    return { headers: cleanedPivotHeaders, rows };
  }

  // ── 6b. Standard row-to-object conversion ────────────────────
  rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });

  // ── 7. Apply column mapping (standard path) ──────────────────
  rows = applyColumnMapping(rows, headers, spec.columnMapping || {});

  return { headers, rows };
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  extractData,
  flattenPivot,
  applySkipPatterns,
  applyColumnMapping,
};
