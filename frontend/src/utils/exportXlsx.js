import * as XLSX from "xlsx";

/**
 * Export an array of objects to an XLSX file download.
 * @param {object[]} data - Array of row objects
 * @param {string} fileName - File name without extension
 * @param {string} [sheetName="Sheet1"] - Worksheet name
 * @param {object} [options] - Optional config
 * @param {string[]} [options.columns] - Column keys to include (in order). If omitted, uses all keys from first row.
 * @param {object} [options.headers] - Map of key → display header. If omitted, uses keys as-is.
 */
export function exportToXlsx(data, fileName, sheetName = "Sheet1", options = {}) {
  if (!data || data.length === 0) return;

  const columns = options.columns || Object.keys(data[0]);
  const headers = options.headers || {};

  // Build rows with display headers
  const headerRow = columns.map(k => headers[k] || k);
  const rows = data.map(row => columns.map(k => row[k] ?? ""));

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);

  // Auto-size columns
  ws["!cols"] = columns.map((k, i) => {
    const maxLen = Math.max(
      headerRow[i].length,
      ...rows.map(r => String(r[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
