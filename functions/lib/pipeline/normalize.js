/**
 * Row normalization — maps raw column names to internal field names.
 *
 * Used at import time to store rows with canonical field names
 * in the imports/ collection. Transform functions can then work
 * on pre-normalized rows without needing the original mapping.
 */

function num(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

function normalizeState(v) {
  const s = str(v).toUpperCase();
  return s.length === 2 ? s : s.slice(0, 2);
}

function normalizeDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str(v);
}

/**
 * Normalize raw rows using a column mapping.
 * Produces rows with internal field names, ready for storage in imports/.
 *
 * @param {object[]} rows - Raw parsed rows with original column names
 * @param {object} mapping - { internalField: originalColumnName, _monthColumns: [...], _weekColumns: [...] }
 * @returns {object[]} Normalized rows with internal field names
 */
function normalizeRows(rows, mapping) {
  const monthCols = mapping._monthColumns || [];
  const weekCols = mapping._weekColumns || [];

  return rows.map((r) => {
    const get = (field) => {
      const col = mapping[field];
      return col ? r[col] : undefined;
    };

    const normalized = {
      acct: str(get("acct")),
      dist: str(get("dist")),
      st: normalizeState(get("st")),
      ch: str(get("ch")),
      sku: str(get("sku")),
      qty: num(get("qty")),
      date: normalizeDate(get("date")),
      revenue: num(get("revenue")),
      stage: str(get("stage")),
      owner: str(get("owner")),
      estValue: num(get("estValue")),
      oh: num(get("oh")),
      doh: num(get("doh")),
      lastOrder: str(get("lastOrder")),
      orderCycle: num(get("orderCycle")),
    };

    // Time series columns (if present)
    if (monthCols.length > 0) {
      normalized._months = monthCols.map((c) => num(r[c]));
    }
    if (weekCols.length > 0) {
      normalized._weeks = weekCols.map((c) => num(r[c]));
    }

    return normalized;
  });
}

module.exports = {
  normalizeRows,
  // Export helpers for testing
  num,
  str,
  normalizeState,
  normalizeDate,
};
