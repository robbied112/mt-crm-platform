/**
 * File parser — handles CSV and XLSX/XLS files.
 * Automatically detects and skips metadata/title rows
 * (common in QuickBooks, VIP, and other report exports).
 * Handles QB grouped formats where customer names appear on
 * separate rows above their transactions.
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
 * Clean up header names.
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

  // If column 0 header is empty, label it "Customer"
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
        // Fill column 0 with group name if empty
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

export default function parseFile(file) {
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

          if (isGrouped) {
            resolve(processGroupedRows(rawRows, headerIdx));
          } else {
            resolve(processStandardRows(rawRows, headerIdx));
          }
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

          const rawRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false,
          });

          const headerIdx = findHeaderRow(rawRows);
          const isGrouped = detectGroupedFormat(rawRows, headerIdx);

          if (isGrouped) {
            resolve(processGroupedRows(rawRows, headerIdx));
          } else {
            resolve(processStandardRows(rawRows, headerIdx));
          }
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
