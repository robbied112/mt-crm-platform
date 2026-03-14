/**
 * File parser — handles CSV and XLSX/XLS files.
 * Automatically detects and skips metadata/title rows
 * (common in QuickBooks, VIP, and other report exports).
 * Returns { headers: string[], rows: object[] }
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

    // Check that most non-empty cells look like header labels (strings, not pure numbers/dates)
    const textCells = nonEmpty.filter((cell) => {
      const s = String(cell).trim();
      return isNaN(Number(s)) && !/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(s);
    });

    if (textCells.length >= nonEmpty.length * 0.5 && nonEmpty.length >= 3) {
      return i;
    }
  }
  return 0; // fallback to first row
}

/**
 * Clean up header names:
 * - Trim whitespace
 * - Replace empty headers with the column letter (A, B, C...)
 * - Deduplicate by appending _2, _3, etc.
 */
function cleanHeaders(headers) {
  const seen = {};
  return headers.map((h, i) => {
    let name = h == null ? "" : String(h).trim();
    // Replace empty or "__EMPTY" style headers
    if (!name || /^__EMPTY/.test(name) || /^empty\s*\d*$/i.test(name)) {
      name = `Column_${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    }
    // Deduplicate
    if (seen[name]) {
      seen[name]++;
      name = `${name}_${seen[name]}`;
    } else {
      seen[name] = 1;
    }
    return name;
  });
}

export default function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv" || ext === "tsv") {
      // First pass: parse without headers to detect the real header row
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          const rawRows = result.data;
          const headerIdx = findHeaderRow(rawRows);
          const headerRow = cleanHeaders(rawRows[headerIdx]);
          const dataRows = rawRows.slice(headerIdx + 1)
            .filter((r) => r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
            .map((r) => {
              const obj = {};
              headerRow.forEach((h, i) => { obj[h] = r[i] ?? ""; });
              return obj;
            });

          resolve({ headers: headerRow, rows: dataRows });
        },
        error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
      });
    } else if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
          const sheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[sheetName];

          // Convert to 2D array first to find the real header row
          const rawRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,     // output as 2D array
            defval: "",
            raw: false,
          });

          const headerIdx = findHeaderRow(rawRows);
          const headerRow = cleanHeaders(rawRows[headerIdx].map((c) => (c == null ? "" : String(c))));

          // Convert data rows to objects using detected headers
          const dataRows = rawRows.slice(headerIdx + 1)
            .filter((r) => r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
            .map((r) => {
              const obj = {};
              headerRow.forEach((h, i) => { obj[h] = r[i] ?? ""; });
              return obj;
            });

          // Filter out summary/total rows at the bottom
          const filteredRows = dataRows.filter((r) => {
            const firstVal = String(Object.values(r)[0] || "").toLowerCase().trim();
            return firstVal !== "total" && firstVal !== "grand total" && firstVal !== "";
          });

          resolve({ headers: headerRow, rows: filteredRows });
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
