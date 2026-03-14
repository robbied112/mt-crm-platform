/**
 * AI-Powered Column Mapper — "Universal Translator"
 *
 * Uses Claude (Anthropic API) to intelligently map uploaded file columns
 * to internal CRM fields. Works alongside the rule-based semanticMapper
 * as a higher-accuracy alternative for ambiguous or unusual formats.
 */

import Anthropic from "@anthropic-ai/sdk";

const INTERNAL_FIELDS = [
  { field: "acct",       label: "Account / Customer Name", description: "Business name, outlet, retailer, buyer, store, or customer identifier" },
  { field: "dist",       label: "Distributor / Wholesaler", description: "Distribution company, wholesaler, or supplier name" },
  { field: "st",         label: "State", description: "US state (2-letter code or full name)" },
  { field: "ch",         label: "Channel", description: "Trade channel: on-premise, off-premise, retail, bar, restaurant, grocery" },
  { field: "sku",        label: "Product / SKU / Item", description: "Product name, SKU code, item description, brand name, or UPC" },
  { field: "qty",        label: "Quantity / Volume", description: "Number of cases, units, or quantity sold/shipped" },
  { field: "date",       label: "Date / Period", description: "Transaction date, invoice date, order date, or time period" },
  { field: "revenue",    label: "Revenue / Amount", description: "Dollar amount, sales total, price, credit, debit, or balance" },
  { field: "stage",      label: "Pipeline Stage", description: "Deal stage: lead, contacted, proposal, negotiation, won, lost" },
  { field: "owner",      label: "Owner / Sales Rep", description: "Salesperson, account rep, or assigned owner" },
  { field: "estValue",   label: "Deal Value", description: "Estimated or actual deal/opportunity dollar value" },
  { field: "oh",         label: "On Hand (Inventory)", description: "Current inventory quantity on hand" },
  { field: "doh",        label: "Days on Hand", description: "Days of supply or days on hand metric" },
  { field: "lastOrder",  label: "Last Order Date", description: "Most recent order or purchase date" },
  { field: "orderCycle", label: "Order Cycle", description: "Average days between orders or reorder frequency" },
];

/**
 * Build a readable ASCII table from headers + sample rows for the prompt.
 */
function buildSampleTable(headers, rows) {
  const sampleRows = rows.slice(0, 8);
  const lines = [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...sampleRows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        return v == null ? "" : String(v).slice(0, 40);
      }).join(" | ")
    ),
  ];
  return lines.join("\n");
}

/**
 * AI-powered column mapping using Claude.
 *
 * @param {string[]} headers - Column headers from the parsed file
 * @param {object[]} rows    - Parsed data rows (objects keyed by header)
 * @param {string}   apiKey  - Anthropic API key
 * @returns {Promise<{ mapping, confidence, unmapped, uploadType }>}
 */
export async function aiAutoDetectMapping(headers, rows, apiKey) {
  const client = new Anthropic({ apiKey });
  const table = buildSampleTable(headers, rows);

  const systemPrompt = `You are a data mapping expert for a beverage/CPG CRM platform. Your job is to analyze uploaded spreadsheet data and map each column to the correct internal field. You understand QuickBooks exports, distributor depletion reports, inventory files, and sales pipeline data.`;

  const userPrompt = `Analyze these column headers and sample data rows. Map each source column to the most appropriate internal CRM field.

INTERNAL CRM FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label} — ${f.description}`).join("\n")}

SOURCE DATA:
${table}

Instructions:
1. Map each source column to an internal field based on both the header name AND the actual data values.
2. If a column clearly doesn't match any field, skip it.
3. Detect monthly time-series columns (e.g., "Nov", "Dec 2024", "January") and list them.
4. Detect weekly columns (e.g., "W1", "Week 3") and list them.
5. Classify the overall upload type.

Return a JSON object with exactly this structure:
{
  "mapping": { "<internalField>": "<sourceColumnHeader>", ... },
  "monthColumns": ["<header1>", "<header2>", ...],
  "weekColumns": ["<header1>", ...],
  "uploadType": "quickbooks" | "depletion" | "sales" | "purchases" | "inventory" | "pipeline" | "unknown",
  "confidence": { "<internalField>": <0.0-1.0>, ... },
  "reasoning": "<brief explanation of your mapping decisions>"
}

Return ONLY valid JSON.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content[0].text.trim();

  // Extract JSON from response (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI mapper returned no valid JSON. Raw response:\n${text}`);
  }

  const result = JSON.parse(jsonMatch[0]);

  // Build the mapping in the same format as semanticMapper.autoDetectMapping
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

  const uploadType = result.uploadType || "unknown";

  console.log(`[AI Mapper] Upload type: ${uploadType}`);
  console.log(`[AI Mapper] Reasoning: ${result.reasoning || "N/A"}`);
  console.log(`[AI Mapper] Mapped ${Object.keys(result.mapping || {}).length} fields, ${unmapped.length} unmapped`);

  return { mapping, confidence, unmapped, uploadType };
}

export { INTERNAL_FIELDS };
