/**
 * Shared comprehend orchestration — DRY helper used by both DataImport
 * (single file flow) and useFileQueue (multi-file queue flow).
 *
 * Handles:
 *   1. Collecting allSheets data for multi-sheet files
 *   2. Deterministic heuristic merge for sheets sharing key columns
 *   3. Calling comprehendReport Cloud Function
 *   4. Handling recommendedSheet re-parse
 *   5. Handling sheetsToMerge → mergeSheets (AI-driven fallback)
 *   6. Falling back to rule-based mapping on failure
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ Flow:                                                        │
 * │  parseFile() result + peekAllSheets()                       │
 * │    ↓                                                         │
 * │  detectMergeableSheets() — deterministic heuristic           │
 * │    ↓ (if merge found)                                        │
 * │  parseSheets() → mergeSheets() — merge BEFORE AI call       │
 * │    ↓                                                         │
 * │  comprehendReport (Cloud Function) with merged/allSheets    │
 * │    ↓                                                         │
 * │  AI refines mapping (merge already done by heuristic)       │
 * │  OR sheetsToMerge? → parseSheets() → mergeSheets() (AI path)│
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
 * Column name patterns that suggest a key/identifier field.
 * Ordered by strength — stronger identifiers (SKU, UPC) score higher
 * than weaker ones (Product, Item) which are often descriptive labels.
 */
const KEY_PATTERNS = [
  { pattern: /^sku$/i, bonus: 15 },
  { pattern: /\bsku\b/i, bonus: 12 },
  { pattern: /^upc$/i, bonus: 15 },
  { pattern: /^gtin$/i, bonus: 15 },
  { pattern: /\bitem.?(?:number|code|id)\b/i, bonus: 12 },
  { pattern: /\bproduct.?(?:code|id|number)\b/i, bonus: 12 },
  { pattern: /^code$/i, bonus: 10 },
  { pattern: /^item$/i, bonus: 8 },
  { pattern: /^product$/i, bonus: 5 },  // weaker — often a label, not an ID
];

/**
 * Deterministic heuristic: detect sheets that share a key column and can
 * be merged without relying on AI.
 *
 * Scans peekAllSheets output for columns that appear (case-insensitive) in
 * 2+ sheets, scores them by key-likeness and value uniqueness, then returns
 * a merge config or null if no confident merge is found.
 *
 * @param {Array<{ name: string, headers: string[], sampleRows: object[] }>} allSheets
 * @returns {{ sheetsToMerge: string[], strategy: string, keyField: string } | null}
 */
export function detectMergeableSheets(allSheets) {
  if (!allSheets || allSheets.length < 2) return null;

  // Map lowercased column name → list of { sheetIdx, actualHeader }
  const columnMap = new Map();
  for (let i = 0; i < allSheets.length; i++) {
    for (const header of allSheets[i].headers) {
      const lower = header.toLowerCase().trim();
      if (!lower) continue;
      if (!columnMap.has(lower)) columnMap.set(lower, []);
      columnMap.get(lower).push({ sheetIdx: i, actualHeader: header });
    }
  }

  // Find columns shared across 2+ sheets
  const shared = [];
  for (const [lower, entries] of columnMap) {
    const uniqueSheets = new Set(entries.map((e) => e.sheetIdx));
    if (uniqueSheets.size >= 2) {
      shared.push({ lower, entries, sheetCount: uniqueSheets.size });
    }
  }
  if (shared.length === 0) return null;

  // Score each shared column — higher = better key candidate
  let bestKey = null;
  let bestScore = -1;

  for (const { lower, entries, sheetCount } of shared) {
    let score = sheetCount; // more sheets sharing = better

    // Bonus for key-like names — stronger identifiers score higher
    for (const { pattern, bonus } of KEY_PATTERNS) {
      if (pattern.test(lower)) {
        score += bonus;
        break;
      }
    }

    // Check value uniqueness in sample data — keys should be mostly unique
    let allUnique = true;
    let hasOverlap = false;
    const allValues = new Set();
    for (const { sheetIdx, actualHeader } of entries) {
      const sheet = allSheets[sheetIdx];
      const values = sheet.sampleRows
        .map((r) => String(r[actualHeader] || "").trim())
        .filter((v) => v);
      const uniqueRatio = values.length > 0 ? new Set(values).size / values.length : 0;
      if (uniqueRatio < 0.5) allUnique = false;

      // Track cross-sheet overlap
      for (const v of values) {
        const vLower = v.toLowerCase();
        if (allValues.has(vLower)) hasOverlap = true;
        allValues.add(vLower);
      }
    }

    if (allUnique) score += 5;
    if (hasOverlap) score += 3; // values shared across sheets = likely same entities

    if (score > bestScore) {
      bestScore = score;
      bestKey = { lower, entries };
    }
  }

  // Require a minimum confidence: must match a key pattern (score >= 12)
  // or have both uniqueness and overlap (score >= 10)
  if (!bestKey || bestScore < 10) return null;

  // Determine which sheets participate in the merge
  const sheetIndices = new Set(bestKey.entries.map((e) => e.sheetIdx));
  const sheetsToMerge = [...sheetIndices].map((i) => allSheets[i].name);

  // Use the actual header name from the first participating sheet as keyField
  const keyField = bestKey.entries[0].actualHeader;

  console.log(
    `[runComprehend] Heuristic detected mergeable sheets: [${sheetsToMerge.join(", ")}] on key "${keyField}"`
  );

  return { sheetsToMerge, strategy: "dedup_by_key", keyField };
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

  // ★ Heuristic merge — deterministic fallback that doesn't depend on AI
  let heuristicMerged = false;
  if (allSheets && allSheets.length >= 2) {
    const heuristicMerge = detectMergeableSheets(allSheets);
    if (heuristicMerge) {
      try {
        const sheetsData = parseSheets(file, heuristicMerge.sheetsToMerge);
        if (sheetsData.length > 1) {
          const merged = mergeSheets(sheetsData, {
            strategy: heuristicMerge.strategy,
            keyField: heuristicMerge.keyField,
          });
          if (merged.rows.length > 0) {
            heuristicMerged = true;
            result.mergedData = merged;
            result.parsed = {
              headers: merged.headers,
              rows: merged.rows,
              sheetInfo: {
                ...originalSheetInfo,
                selectedSheet: `Merged (${heuristicMerge.sheetsToMerge.join(", ")})`,
                merged: true,
              },
            };
            result.sheetInfo = result.parsed.sheetInfo;
            console.log(
              `[runComprehend] Heuristic merge produced ${merged.rows.length} rows from ${sheetsData.length} sheets`
            );
          }
        }
      } catch (err) {
        console.warn("[runComprehend] Heuristic merge failed, continuing with primary sheet:", err);
      }
    } else {
      console.debug("[runComprehend] No heuristic merge candidates found for sheets:", allSheets.map((s) => s.name));
    }
  }

  // Call comprehendReport — send merged data if heuristic merged, otherwise original
  let comprehendResult = null;
  try {
    const { data } = await comprehendCallable({
      tenantId,
      fileName: file.name,
      headers: result.parsed.headers,
      sampleRows: smartSample(result.parsed.rows),
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
  // Skip if heuristic already merged (avoid double-merge)
  if (!heuristicMerged && comprehendResult.sheetsToMerge?.length > 1) {
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
