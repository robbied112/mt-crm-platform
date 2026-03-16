/**
 * AI-Powered Column Mapper — Frontend Integration
 *
 * Calls the aiMapper Cloud Function to intelligently map uploaded file
 * columns to internal CRM fields. Falls back to rule-based semanticMapper
 * if the Cloud Function call fails.
 *
 * Security: All AI calls go through the authenticated Cloud Function.
 * No API keys are exposed in the browser.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { autoDetectMapping } from "./semanticMapper";
import { getUserRole } from "./terminology";

/**
 * Call the AI mapper Cloud Function.
 * Falls back to rule-based mapping on failure.
 *
 * @param {string[]} headers
 * @param {object[]} rows
 * @returns {Promise<{ mapping, confidence, unmapped, uploadType? }>}
 */
export async function aiAutoDetectMapping(headers, rows) {
  const userRole = getUserRole();

  try {
    const functions = getFunctions();
    const aiMap = httpsCallable(functions, "aiMapper");
    const { data: result } = await aiMap({
      headers,
      sampleRows: rows.slice(0, 8),
      userRole,
    });

    // Build mapping in semanticMapper format
    const mapping = { ...result.mapping };
    if (result.monthColumns?.length) mapping._monthColumns = result.monthColumns;
    if (result.weekColumns?.length) mapping._weekColumns = result.weekColumns;

    const confidence = {};
    for (const [field] of Object.entries(result.mapping || {})) {
      confidence[field] = result.confidence?.[field] ?? 0.9;
    }
    if (result.monthColumns?.length) confidence._monthColumns = 0.9;
    if (result.weekColumns?.length) confidence._weekColumns = 0.9;

    const usedCols = new Set([
      ...Object.values(result.mapping || {}),
      ...(result.monthColumns || []),
      ...(result.weekColumns || []),
    ]);
    const unmapped = headers.filter((h) => !usedCols.has(h));

    console.log(`[AI Mapper] Mapped ${Object.keys(result.mapping).length} fields (type: ${result.uploadType})`);
    return { mapping, confidence, unmapped, uploadType: result.uploadType };
  } catch (err) {
    console.warn(`[AI Mapper] AI mapping failed: ${err.message}. Falling back to rule-based mapper.`);
    return autoDetectMapping(headers, rows, userRole);
  }
}
