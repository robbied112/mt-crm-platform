/**
 * Shared comprehend orchestration — DRY helper used by both DataImport
 * (single file flow) and useFileQueue (multi-file queue flow).
 *
 * Handles:
 *   1. Collecting allSheets data for multi-sheet files
 *   2. Calling comprehendReport Cloud Function
 *   3. Handling recommendedSheet re-parse
 *   4. Handling sheetsToMerge → mergeSheets
 *   5. Falling back to rule-based mapping on failure
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ Flow:                                                        │
 * │  parseFile() result + peekAllSheets()                       │
 * │    ↓                                                         │
 * │  comprehendReport (Cloud Function) with allSheets           │
 * │    ↓                                                         │
 * │  recommendedSheet? → re-parse that sheet                    │
 * │  sheetsToMerge? → parseSheets() → mergeSheets()             │
 * │    ↓                                                         │
 * │  Return { parsed, mapping, confidence, analysis, mergedData }│
 * └──────────────────────────────────────────────────────────────┘
 */

import { peekAllSheets, parseSheets } from "./parseFile";
import { parseFileSheet } from "./parseFile";
import { mergeSheets } from "./mergeSheets";

/**
 * Build a smart sample of rows for comprehendReport.
 * Takes first 20, middle 20, last 10 — same as existing smartSampleRows.
 */
function smartSample(rows) {
  if (rows.length <= 50) return rows;
  const first20 = rows.slice(0, 20);
  const midStart = Math.floor(rows.length / 2) - 10;
  const mid20 = rows.slice(midStart, midStart + 20);
  const last10 = rows.slice(-10);
  return [...first20, ...mid20, ...last10];
}

/**
 * Run AI comprehension on a parsed file, with multi-sheet awareness.
 *
 * @param {object} opts
 * @param {File} opts.file - The browser File object
 * @param {{ headers: string[], rows: object[], sheetInfo: object }} opts.parsed - Initial parse result
 * @param {Function} opts.comprehendCallable - Firebase callable for comprehendReport
 * @param {string} opts.tenantId
 * @returns {Promise<{
 *   parsed: object,           // possibly updated (re-parsed sheet or merged)
 *   mapping: object|null,     // AI-suggested mapping (null if AI failed)
 *   confidence: object|null,  // per-field confidence scores
 *   analysis: object|null,    // full comprehend response
 *   sheetInfo: object|null,   // possibly updated sheet info
 *   mergedData: object|null,  // merged data if sheetsToMerge was returned
 * }>}
 */
export async function runComprehend({ file, parsed, comprehendCallable, tenantId }) {
  const result = {
    parsed,
    mapping: null,
    confidence: null,
    analysis: null,
    sheetInfo: parsed.sheetInfo || null,
    mergedData: null,
  };

  const originalSheetInfo = parsed.sheetInfo;

  // Build sheet summaries (metadata for all sheets)
  const sheetSummaries = originalSheetInfo?.sheets?.map((s) => ({
    name: s.name,
    rowCount: s.rowCount,
    headerCount: s.headerCount,
  }));

  // Collect allSheets data for multi-sheet files
  let allSheets = null;
  if (originalSheetInfo?.multiSheet) {
    try {
      allSheets = peekAllSheets(file);
      if (allSheets.length === 0) allSheets = null;
    } catch (err) {
      console.warn("[runComprehend] peekAllSheets failed:", err.message);
    }
  }

  // Call comprehendReport
  let comprehendResult = null;
  try {
    const { data } = await comprehendCallable({
      tenantId,
      fileName: file.name,
      headers: parsed.headers,
      sampleRows: smartSample(parsed.rows),
      sheetNames: originalSheetInfo?.sheetNames,
      selectedSheet: originalSheetInfo?.selectedSheet,
      sheetSummaries,
      allSheets: allSheets?.map((s) => ({
        name: s.name,
        headers: s.headers,
        sampleRows: s.sampleRows,
      })),
    });

    if (!data.error) {
      comprehendResult = data;
    }
    result.analysis = data;
  } catch (err) {
    result.analysis = {
      error: true,
      errorType: err.code || "unknown",
      suggestion: err.message || "AI comprehension failed. Using rule-based mapping.",
    };
    return result;
  }

  if (!comprehendResult) return result;

  // Handle recommendedSheet — AI says a different single sheet is better
  if (comprehendResult.recommendedSheet &&
      comprehendResult.recommendedSheet !== originalSheetInfo?.selectedSheet &&
      originalSheetInfo?.sheetNames?.includes(comprehendResult.recommendedSheet) &&
      !comprehendResult.sheetsToMerge?.length) {
    try {
      const reParsed = await parseFileSheet(file, comprehendResult.recommendedSheet);
      if (reParsed.rows.length > 0) {
        result.parsed = reParsed;
        result.sheetInfo = {
          ...originalSheetInfo,
          selectedSheet: comprehendResult.recommendedSheet,
        };
      }
    } catch (err) {
      console.warn(`[runComprehend] AI recommended sheet "${comprehendResult.recommendedSheet}" but re-parse failed:`, err);
    }
  }

  // Handle sheetsToMerge — AI says combine multiple sheets
  if (comprehendResult.sheetsToMerge?.length > 1) {
    try {
      // Validate sheet names — only merge sheets that actually exist
      const validSheets = comprehendResult.sheetsToMerge.filter(
        (name) => originalSheetInfo?.sheetNames?.includes(name)
      );

      if (validSheets.length > 1) {
        // Lazy full-parse only the sheets we need to merge
        const sheetsData = parseSheets(file, validSheets);

        if (sheetsData.length > 1) {
          const mergeConfig = {
            strategy: comprehendResult.mergeStrategy || "append",
            keyField: comprehendResult.mergeKeyField || null,
            sheetMappings: comprehendResult.sheetMappings || {},
          };

          const merged = mergeSheets(sheetsData, mergeConfig);

          if (merged.rows.length > 0) {
            result.mergedData = merged;
            // Update parsed to reflect merged data so downstream code works
            result.parsed = {
              headers: merged.headers,
              rows: merged.rows,
              sheetInfo: {
                ...originalSheetInfo,
                selectedSheet: `Merged (${validSheets.join(", ")})`,
                merged: true,
              },
            };
          }
        }
      }
    } catch (err) {
      console.warn("[runComprehend] Multi-sheet merge failed, continuing with primary sheet:", err);
    }
  }

  // Extract mapping and confidence from comprehend result
  if (comprehendResult.mapping) {
    // If we merged and have a unified mapping from mergeSheets, prefer that
    if (result.mergedData?.mapping && Object.keys(result.mergedData.mapping).length > 0) {
      result.mapping = result.mergedData.mapping;
    } else {
      result.mapping = comprehendResult.mapping;
    }

    result.confidence = {};
    if (comprehendResult.columnSemantics) {
      for (const [, semantic] of Object.entries(comprehendResult.columnSemantics)) {
        if (semantic.field) {
          result.confidence[semantic.field] = semantic.confidence || 0;
        }
      }
    }
  }

  return result;
}
