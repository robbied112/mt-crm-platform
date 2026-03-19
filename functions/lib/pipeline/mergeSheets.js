/**
 * Multi-sheet merge — pure data transformation for combining rows from
 * multiple Excel sheets into a unified dataset.
 *
 * Strategies:
 *   dedup_by_key — merge rows by a key field (e.g. SKU), later sheets enrich earlier
 *   append       — concatenate all rows, adding a _sourceSheet column
 *   enrich       — join supplementary columns by key (no new rows, only new fields)
 *
 * Used by both browser (DataImport) and server (Cloud Sync) import paths.
 * No browser or Firebase dependencies — pure functions only.
 */

/**
 * Merge data from multiple sheets into a unified result.
 *
 * @param {Array<{ name: string, headers: string[], rows: object[] }>} sheetsData
 *   Fully parsed sheets to merge (from parseSheets or parseFileBuffer).
 * @param {{ strategy: string, keyField?: string, sheetMappings?: object }} mergeConfig
 *   - strategy: "dedup_by_key" | "append" | "enrich"
 *   - keyField: internal field name to use as the merge key (for dedup/enrich)
 *   - sheetMappings: per-sheet column mappings { "Sheet1": { sku: "SKU Column", ... } }
 * @returns {{ headers: string[], rows: object[], mapping: object, sourceSheets: string[] }}
 */
function mergeSheets(sheetsData, mergeConfig) {
  if (!sheetsData || sheetsData.length === 0) {
    return { headers: [], rows: [], mapping: {}, sourceSheets: [] };
  }

  // Single sheet — no merge needed
  if (sheetsData.length === 1) {
    const sheet = sheetsData[0];
    const mapping = mergeConfig.sheetMappings?.[sheet.name] || {};
    return {
      headers: sheet.headers,
      rows: sheet.rows,
      mapping,
      sourceSheets: [sheet.name],
    };
  }

  const strategy = mergeConfig.strategy || "append";
  const sheetMappings = mergeConfig.sheetMappings || {};

  switch (strategy) {
    case "dedup_by_key":
      return mergeByKey(sheetsData, mergeConfig.keyField, sheetMappings);
    case "enrich":
      return mergeEnrich(sheetsData, mergeConfig.keyField, sheetMappings);
    case "append":
    default:
      return mergeAppend(sheetsData, sheetMappings);
  }
}

// ─── Strategies ──────────────────────────────────────────────────

/**
 * Normalize a row: apply a sheet-specific mapping to rename columns
 * to internal field names.
 */
function normalizeRow(row, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return { ...row };
  const result = {};
  for (const [internalField, sourceColumn] of Object.entries(mapping)) {
    if (internalField.startsWith("_")) continue; // skip internal fields
    const value = row[sourceColumn];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      result[internalField] = value;
    }
  }
  return result;
}

/**
 * Collect all unique internal field names from all sheet mappings.
 */
function collectUnifiedHeaders(sheetMappings) {
  const headers = new Set();
  for (const mapping of Object.values(sheetMappings)) {
    for (const field of Object.keys(mapping)) {
      if (!field.startsWith("_")) headers.add(field);
    }
  }
  return [...headers];
}

/**
 * Append strategy: concatenate rows from all sheets.
 * Adds _sourceSheet field to each row.
 */
function mergeAppend(sheetsData, sheetMappings) {
  const allRows = [];
  const hasMappings = Object.keys(sheetMappings).length > 0;

  for (const sheet of sheetsData) {
    const mapping = sheetMappings[sheet.name];
    for (const row of sheet.rows) {
      const normalized = hasMappings && mapping ? normalizeRow(row, mapping) : { ...row };
      normalized._sourceSheet = sheet.name;
      allRows.push(normalized);
    }
  }

  // Build unified headers
  const headers = hasMappings
    ? [...collectUnifiedHeaders(sheetMappings), "_sourceSheet"]
    : [...new Set(sheetsData.flatMap((s) => s.headers)), "_sourceSheet"];

  // Build unified mapping (merge all per-sheet mappings)
  const mapping = {};
  for (const m of Object.values(sheetMappings)) {
    for (const [field, col] of Object.entries(m)) {
      if (!field.startsWith("_") && !mapping[field]) mapping[field] = field;
    }
  }

  return {
    headers,
    rows: allRows,
    mapping,
    sourceSheets: sheetsData.map((s) => s.name),
  };
}

/**
 * Dedup-by-key strategy: merge rows across sheets by a key field.
 * Later sheets enrich earlier ones (fill in missing fields, don't overwrite existing).
 */
function mergeByKey(sheetsData, keyField, sheetMappings) {
  if (!keyField) {
    // No key field specified — fall back to append
    return mergeAppend(sheetsData, sheetMappings);
  }

  const hasMappings = Object.keys(sheetMappings).length > 0;
  const merged = new Map(); // keyValue → merged row
  const insertOrder = []; // preserve insertion order for output

  for (const sheet of sheetsData) {
    const mapping = sheetMappings[sheet.name];
    for (const row of sheet.rows) {
      const normalized = hasMappings && mapping ? normalizeRow(row, mapping) : { ...row };

      const keyValue = String(normalized[keyField] || "").trim().toLowerCase();
      if (!keyValue) {
        // No key — still include the row
        const uid = `_nokey_${merged.size}`;
        normalized._sourceSheet = sheet.name;
        merged.set(uid, normalized);
        insertOrder.push(uid);
        continue;
      }

      if (merged.has(keyValue)) {
        // Enrich existing row — fill in missing fields only
        const existing = merged.get(keyValue);
        for (const [field, value] of Object.entries(normalized)) {
          if (field === "_sourceSheet") continue;
          const existingVal = existing[field];
          if ((existingVal === undefined || existingVal === null || String(existingVal).trim() === "") &&
              value !== undefined && value !== null && String(value).trim() !== "") {
            existing[field] = value;
          }
        }
        // Track additional source sheets
        if (!existing._sourceSheets) {
          existing._sourceSheets = [existing._sourceSheet || sheetsData[0].name];
        }
        existing._sourceSheets.push(sheet.name);
      } else {
        normalized._sourceSheet = sheet.name;
        merged.set(keyValue, normalized);
        insertOrder.push(keyValue);
      }
    }
  }

  const rows = insertOrder.map((key) => merged.get(key));

  const headers = hasMappings
    ? collectUnifiedHeaders(sheetMappings)
    : [...new Set(sheetsData.flatMap((s) => s.headers))];

  const mapping = {};
  for (const m of Object.values(sheetMappings)) {
    for (const [field] of Object.entries(m)) {
      if (!field.startsWith("_") && !mapping[field]) mapping[field] = field;
    }
  }

  return {
    headers,
    rows,
    mapping,
    sourceSheets: sheetsData.map((s) => s.name),
  };
}

/**
 * Enrich strategy: join supplementary columns by key.
 * First sheet is the base — additional sheets only add NEW fields (no new rows).
 */
function mergeEnrich(sheetsData, keyField, sheetMappings) {
  if (!keyField || sheetsData.length < 2) {
    return mergeByKey(sheetsData, keyField, sheetMappings);
  }

  const hasMappings = Object.keys(sheetMappings).length > 0;

  // First sheet is the base
  const baseSheet = sheetsData[0];
  const baseMapping = sheetMappings[baseSheet.name];
  const baseRows = baseSheet.rows.map((row) =>
    hasMappings && baseMapping ? normalizeRow(row, baseMapping) : { ...row }
  );

  // Index base rows by key
  const keyIndex = new Map();
  for (const row of baseRows) {
    const keyValue = String(row[keyField] || "").trim().toLowerCase();
    if (keyValue) keyIndex.set(keyValue, row);
  }

  // Enrich from subsequent sheets
  for (let i = 1; i < sheetsData.length; i++) {
    const sheet = sheetsData[i];
    const mapping = sheetMappings[sheet.name];

    for (const row of sheet.rows) {
      const normalized = hasMappings && mapping ? normalizeRow(row, mapping) : { ...row };
      const keyValue = String(normalized[keyField] || "").trim().toLowerCase();
      if (!keyValue || !keyIndex.has(keyValue)) continue;

      const baseRow = keyIndex.get(keyValue);
      for (const [field, value] of Object.entries(normalized)) {
        if (field === keyField) continue;
        const existingVal = baseRow[field];
        if ((existingVal === undefined || existingVal === null || String(existingVal).trim() === "") &&
            value !== undefined && value !== null && String(value).trim() !== "") {
          baseRow[field] = value;
        }
      }
    }
  }

  const headers = hasMappings
    ? collectUnifiedHeaders(sheetMappings)
    : [...new Set(sheetsData.flatMap((s) => s.headers))];

  const mapping = {};
  for (const m of Object.values(sheetMappings)) {
    for (const [field] of Object.entries(m)) {
      if (!field.startsWith("_") && !mapping[field]) mapping[field] = field;
    }
  }

  return {
    headers,
    rows: baseRows,
    mapping,
    sourceSheets: sheetsData.map((s) => s.name),
  };
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = { mergeSheets };
