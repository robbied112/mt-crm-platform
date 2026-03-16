/**
 * Browser file parser — wraps shared pipeline core with File/FileReader APIs.
 * Core parsing logic (header detection, grouped format) lives in packages/pipeline/src/parseFile.js.
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

/**
 * Parse a browser File object (CSV/XLSX/XLS).
 * Returns { headers: string[], rows: object[] }
 */
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
