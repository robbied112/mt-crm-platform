/**
 * AI-Powered Column Mapper — Frontend Integration
 *
 * Calls the Anthropic API via a Cloud Function proxy to intelligently
 * map uploaded file columns to internal CRM fields. Returns results
 * in the same format as semanticMapper.autoDetectMapping for drop-in use.
 *
 * Falls back to the rule-based semanticMapper if the AI call fails.
 */

import { autoDetectMapping } from "./semanticMapper";
import { getUserRole } from "./terminology";

const INTERNAL_FIELDS = [
  { field: "acct",       label: "Account / Customer Name" },
  { field: "dist",       label: "Distributor / Wholesaler" },
  { field: "st",         label: "State" },
  { field: "ch",         label: "Channel" },
  { field: "sku",        label: "Product / SKU / Item" },
  { field: "qty",        label: "Quantity / Volume" },
  { field: "date",       label: "Date / Period" },
  { field: "revenue",    label: "Revenue / Amount" },
  { field: "stage",      label: "Pipeline Stage" },
  { field: "owner",      label: "Owner / Sales Rep" },
  { field: "estValue",   label: "Deal Value" },
  { field: "oh",         label: "On Hand (Inventory)" },
  { field: "doh",        label: "Days on Hand" },
  { field: "lastOrder",  label: "Last Order Date" },
  { field: "orderCycle", label: "Order Cycle" },
];

/**
 * Build a sample table string for the AI prompt.
 */
function buildSampleTable(headers, rows) {
  const sample = rows.slice(0, 8);
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...sample.map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
  ].join("\n");
}

/**
 * Call the AI mapper Cloud Function.
 * Falls back to rule-based mapping on failure.
 *
 * @param {string[]} headers
 * @param {object[]} rows
 * @returns {Promise<{ mapping, confidence, unmapped }>}
 */
export async function aiAutoDetectMapping(headers, rows) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const userRole = getUserRole();

  if (!apiKey) {
    console.warn("[AI Mapper] No API key found, falling back to rule-based mapper");
    return autoDetectMapping(headers, rows, userRole);
  }

  try {
    const table = buildSampleTable(headers, rows);

    const roleContext = userRole === "distributor"
      ? "You are a data mapping expert for a beverage/CPG distributor CRM. The user is a distributor tracking suppliers and their own stores."
      : "You are a data mapping expert for a beverage/CPG supplier CRM. The user is a supplier tracking distributors and retail accounts.";

    const prompt = `${roleContext} Map each column to an internal field.

INTERNAL FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n")}

SOURCE DATA:
${table}

Return JSON: { "mapping": { "<field>": "<column>" }, "monthColumns": [], "weekColumns": [], "uploadType": "quickbooks"|"depletion"|"sales"|"purchases"|"inventory"|"pipeline"|"unknown", "confidence": { "<field>": 0.0-1.0 } }

Return ONLY valid JSON.`;

    // Call Anthropic API via proxy (Cloud Function) to avoid CORS
    // If no proxy is configured, fall back to rule-based
    const proxyUrl = import.meta.env.VITE_AI_MAPPER_URL;

    let result;
    if (proxyUrl) {
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, sampleRows: rows.slice(0, 8), userRole }),
      });
      result = await resp.json();
    } else {
      // Direct API call (works in Node.js, may hit CORS in browser)
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");
      result = JSON.parse(jsonMatch[0]);
    }

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
