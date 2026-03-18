const {
  functions,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
  INTERNAL_FIELDS,
} = require("./helpers");

// ─── Rate Limit ──────────────────────────────────────────────────────────────
// Max 20 comprehension calls per tenant per hour, tracked in Firestore.

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check and increment the rate limit counter for a tenant.
 * Throws HttpsError if the tenant has exceeded the limit.
 */
async function checkRateLimit(tenantId) {
  const ref = db
    .collection("tenants")
    .doc(tenantId)
    .collection("rateLimits")
    .doc("comprehend");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    const { count, windowStart } = snap.data();

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      // Window expired — reset
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    if (count >= RATE_LIMIT_MAX) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded: max ${RATE_LIMIT_MAX} comprehension calls per hour per tenant`
      );
    }

    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
  });
}

// ─── Tool Schemas ────────────────────────────────────────────────────────────

const REPORT_ANALYSIS_TOOL = {
  name: "report_analysis",
  description:
    "Analyze a wine/spirits distributor report file and return structured metadata " +
    "describing its type, layout, column semantics, and extraction specification.",
  input_schema: {
    type: "object",
    properties: {
      reportType: {
        type: "string",
        enum: [
          "distributor_velocity",
          "quickbooks_revenue",
          "inventory_health",
          "lost_placements",
          "new_placements",
          "period_comparison",
          "product_catalog",
          "ar_aging",
          "ap_aging",
          "unknown",
        ],
        description: "The semantic category of this report",
      },
      dataStructure: {
        type: "string",
        enum: [
          "standard",
          "grouped_by_customer",
          "pivot_weekly",
          "pivot_monthly",
          "multi_section",
          "hierarchical",
        ],
        description: "How the data is laid out in the grid",
      },
      headerRow: {
        type: "integer",
        description: "0-indexed row number where the column headers live",
      },
      dataStartRow: {
        type: "integer",
        description: "0-indexed row number where the first data record begins",
      },
      confidence: {
        type: "number",
        description: "Overall classification confidence from 0 to 1",
      },
      humanSummary: {
        type: "string",
        description: "One-to-two sentence plain-English description of this file",
      },
      columnSemantics: {
        type: "object",
        description:
          "Map of column header name → semantic annotation. " +
          "Each value has: field (internal field name), confidence (0-1), reasoning (string).",
        additionalProperties: {
          type: "object",
          properties: {
            field: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["field", "confidence", "reasoning"],
        },
      },
      extractionSpec: {
        type: "object",
        description: "Machine-readable spec that tells the importer exactly how to read this file",
        properties: {
          headerRow: {
            type: "integer",
            description: "0-indexed header row",
          },
          dataStartRow: {
            type: "integer",
            description: "0-indexed first data row",
          },
          skipPatterns: {
            type: "array",
            description: "Row patterns to skip (e.g. subtotals, blank dividers)",
            items: {
              type: "object",
              properties: {
                column: { type: "integer" },
                pattern: { type: "string" },
              },
              required: ["column", "pattern"],
            },
          },
          columnOffset: {
            type: "integer",
            description: "Number of leading columns to skip before data columns begin",
          },
          pivot: {
            description:
              "Present when the file uses a pivot layout (e.g. weekly columns). " +
              "null if not a pivot.",
            oneOf: [
              {
                type: "object",
                properties: {
                  startCol: { type: "integer" },
                  endCol: { type: "integer" },
                  groupSize: { type: "integer" },
                  labelRow: { type: "integer" },
                  fieldNames: { type: "array", items: { type: "string" } },
                },
                required: ["startCol", "endCol", "groupSize", "labelRow", "fieldNames"],
              },
              { type: "null" },
            ],
          },
          sheets: {
            type: "array",
            items: { type: "string" },
            description: "Which sheet names to import (empty = all)",
          },
          columnMapping: {
            type: "object",
            description: "Map of internal field name → column header or 0-indexed column number",
            additionalProperties: {
              oneOf: [{ type: "integer" }, { type: "string" }],
            },
          },
          codeGen: {
            description: "Reserved for AI-generated extraction code. Always null from this tool.",
            type: "null",
          },
        },
        required: [
          "headerRow",
          "dataStartRow",
          "skipPatterns",
          "columnOffset",
          "pivot",
          "sheets",
          "columnMapping",
          "codeGen",
        ],
      },
      dashboardTargets: {
        type: "array",
        items: { type: "string" },
        description:
          "Which CruFolio dashboard sections this data will populate " +
          "(e.g. [\"depletions\", \"distributorScorecard\"])",
      },
      mapping: {
        type: "object",
        description:
          "Column name mapping in the same format as the existing semanticMapper. " +
          "Map of internal field name → source column header string.",
        additionalProperties: { type: "string" },
      },
      recommendedSheet: {
        description:
          "If this Excel file has multiple sheets and the currently selected sheet " +
          "is NOT the best one for data import, set this to the name of the sheet " +
          "that contains the primary data. null if the current sheet is correct " +
          "or if you are recommending a multi-sheet merge via sheetsToMerge.",
        oneOf: [{ type: "string" }, { type: "null" }],
      },
      sheetsToMerge: {
        description:
          "When this Excel file has multiple sheets containing related data that should " +
          "be combined into a single import, list the sheet names to merge here. " +
          "For example, if batches of products are split across sheets, or if one sheet " +
          "has base data and another has supplementary columns. null or empty if only " +
          "one sheet should be imported.",
        oneOf: [
          { type: "array", items: { type: "string" }, minItems: 2 },
          { type: "null" },
        ],
      },
      sheetMappings: {
        description:
          "Per-sheet column mappings when sheetsToMerge is used. Object keyed by sheet name, " +
          "where each value is a mapping of internal field name → source column header string " +
          "for that specific sheet. Required when sheetsToMerge is provided.",
        oneOf: [
          {
            type: "object",
            additionalProperties: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          { type: "null" },
        ],
      },
      mergeStrategy: {
        description:
          "How to merge the sheets listed in sheetsToMerge. " +
          "dedup_by_key: merge rows by a key field (e.g. SKU), later sheets enrich earlier ones. " +
          "append: concatenate all rows from all sheets. " +
          "enrich: join supplementary columns from additional sheets by key (no new rows). " +
          "null if sheetsToMerge is not used.",
        oneOf: [
          { type: "string", enum: ["dedup_by_key", "append", "enrich"] },
          { type: "null" },
        ],
      },
      mergeKeyField: {
        description:
          "The internal field name to use as the merge/dedup key when mergeStrategy is " +
          "dedup_by_key or enrich. Typically 'sku' for product catalogs, 'acct' for accounts. " +
          "null if mergeStrategy is append or sheetsToMerge is not used.",
        oneOf: [{ type: "string" }, { type: "null" }],
      },
    },
    required: [
      "reportType",
      "dataStructure",
      "headerRow",
      "dataStartRow",
      "confidence",
      "humanSummary",
      "columnSemantics",
      "extractionSpec",
      "dashboardTargets",
      "mapping",
    ],
  },
};

const INTEGRATION_PLAN_TOOL = {
  name: "integration_plan",
  description:
    "Given a set of analyzed report files, produce an integration plan " +
    "describing import order, dashboard coverage, missing data, and conflicts.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "High-level plain-English summary of the full data set",
      },
      fileOrder: {
        type: "array",
        items: { type: "string" },
        description: "Recommended file import order (file names)",
      },
      dashboardCoverage: {
        type: "object",
        description:
          "Map of dashboard name → coverage status. " +
          "Each value has: covered (boolean), source (filename or empty string).",
        additionalProperties: {
          type: "object",
          properties: {
            covered: { type: "boolean" },
            source: { type: "string" },
          },
          required: ["covered", "source"],
        },
      },
      missingData: {
        type: "array",
        description: "Data types that are absent from the provided files",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            description: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["type", "description", "suggestion"],
        },
      },
      conflicts: {
        type: "array",
        description: "Detected conflicts between two or more files",
        items: {
          type: "object",
          properties: {
            files: { type: "array", items: { type: "string" } },
            issue: { type: "string" },
            resolution: { type: "string" },
          },
          required: ["files", "issue", "resolution"],
        },
      },
    },
    required: ["summary", "fileOrder", "dashboardCoverage", "missingData", "conflicts"],
  },
};

// ─── Prompt Helpers ──────────────────────────────────────────────────────────

/**
 * Build a markdown table from headers + sample rows for use in an AI prompt.
 * Values are truncated at 60 chars to keep tokens reasonable.
 */
function buildMarkdownTable(headers, sampleRows) {
  const safeHeaders = headers.map((h) => String(h ?? "").replace(/\|/g, "/").slice(0, 60));
  const separator = safeHeaders.map(() => "---").join(" | ");
  const rows = sampleRows.map((row) =>
    safeHeaders
      .map((h, i) => {
        const raw = row[h] ?? row[i] ?? "";
        return String(raw).replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 60);
      })
      .join(" | ")
  );
  return [safeHeaders.join(" | "), separator, ...rows].join("\n");
}

/**
 * Build the system prompt for comprehendReport.
 */
function buildComprehendSystemPrompt() {
  const fieldList = INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n");

  return `You are CruFolio's Report Comprehension Engine.

CruFolio is a CRM and analytics platform for wine and spirits supplier teams. \
Suppliers upload reports from distributors (e.g. Southern Glazer's, RNDC, Breakthru), \
their own QuickBooks exports, inventory sheets, and placement trackers.

Your job is to analyze a report file and return a fully structured JSON analysis \
using the report_analysis tool. Be precise and specific — your output drives the \
automated import pipeline.

INTERNAL FIELDS (CruFolio's canonical data model):
${fieldList}

REPORT TYPES:
- distributor_velocity: Cases sold by SKU and/or account, often weekly or monthly periods
- quickbooks_revenue: P&L or invoice exports from QuickBooks or similar accounting tools
- inventory_health: On-hand stock, days-on-hand, reorder points
- lost_placements: Accounts that had a SKU last period but not this one
- new_placements: Accounts that added a SKU this period
- period_comparison: Side-by-side current vs. prior period (same or different columns)
- product_catalog: SKU list with pricing, descriptions, attributes
- ar_aging: Accounts Receivable aging buckets (30/60/90/120+ days)
- ap_aging: Accounts Payable aging buckets
- unknown: Cannot determine type with reasonable confidence

DATA STRUCTURES:
- standard: One header row, one record per row below it
- grouped_by_customer: Rows grouped under customer name headers, with subtotals
- pivot_weekly: Columns represent individual weeks or dates
- pivot_monthly: Columns represent months
- multi_section: Multiple distinct tables in one sheet (separated by blank rows)
- hierarchical: Parent rows with indented child rows (e.g. category → product)

DASHBOARD TARGETS (which CruFolio views this data feeds):
- depletions, distributorScorecard, inventoryHealth, placementTracker,
  revenueAnalysis, arAging, apAging, productCatalog, executiveDashboard

Map every column you recognize to an internal field. \
Use your best judgment for columns that are similar but not exact matches. \
Set confidence below 0.7 for uncertain mappings. \
Always validate your headerRow and dataStartRow against the sample rows shown.

MULTI-SHEET MERGE:
When you see data from multiple sheets (in <all_sheets>), determine if sheets contain \
related data that should be combined. Common patterns:
- Product catalogs split by batch (e.g. "Batch 1", "Batch 2") → dedup_by_key on sku
- One sheet has base data, another has supplementary columns (varietal, images) → enrich on sku
- Transaction data split by period or region → append
- A sheet with cross-reference codes (e.g. distributor SKU mappings) → enrich on sku

When merging, provide sheetMappings with a column mapping for EACH sheet (since different \
sheets may have different column names for the same field). The mapping field should use \
the primary sheet's mapping for the main mapping field, and sheetsToMerge + sheetMappings \
for per-sheet column resolution.`;
}

/**
 * Sanitize a string for safe embedding inside XML delimiters in a prompt.
 * Strips XML tags and truncates.
 */
function sanitizeForPrompt(value, maxLength = 200) {
  if (value == null) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\t]/g, "")
    .slice(0, maxLength);
}

// ─── Validate Column Indices ─────────────────────────────────────────────────

/**
 * Walk the extractionSpec and clamp/remove any column indices that exceed
 * the actual header count. Returns a sanitized copy of the spec.
 */
function validateExtractionSpec(spec, headerCount) {
  if (!spec || typeof spec !== "object") return spec;

  const result = { ...spec };

  // columnOffset
  if (typeof result.columnOffset === "number" && result.columnOffset >= headerCount) {
    result.columnOffset = 0;
  }

  // pivot column bounds
  if (result.pivot && typeof result.pivot === "object") {
    result.pivot = { ...result.pivot };
    if (result.pivot.startCol >= headerCount) result.pivot.startCol = 0;
    if (result.pivot.endCol >= headerCount) result.pivot.endCol = headerCount - 1;
    if (result.pivot.startCol > result.pivot.endCol) result.pivot = null;
  }

  // columnMapping: remove entries pointing to out-of-range numeric indices
  if (result.columnMapping && typeof result.columnMapping === "object") {
    const cleaned = {};
    for (const [field, ref] of Object.entries(result.columnMapping)) {
      if (typeof ref === "number") {
        if (ref >= 0 && ref < headerCount) cleaned[field] = ref;
        // else drop it silently
      } else {
        cleaned[field] = ref; // string header names are not index-validated here
      }
    }
    result.columnMapping = cleaned;
  }

  return result;
}

// ─── comprehendReport ────────────────────────────────────────────────────────

const comprehendReport = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const {
      tenantId,
      headers,
      sampleRows,
      fileName,
      sheetNames,
      selectedSheet,
      sheetSummaries,
      allSheets,
    } = data;

    if (!tenantId || !headers || !sampleRows || !fileName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "tenantId, headers, sampleRows, and fileName are required"
      );
    }

    await verifyTenantMembership(context.auth.uid, tenantId);
    await checkRateLimit(tenantId);

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "ANTHROPIC_API_KEY not configured"
      );
    }

    // Build the markdown table from smart-sampled rows (caller sends first 20 + mid 20 + last 10)
    const table = buildMarkdownTable(headers, sampleRows);

    const safeFileName = sanitizeForPrompt(fileName, 200);
    const safeSelectedSheet = selectedSheet ? sanitizeForPrompt(selectedSheet, 80) : "";

    // Build sheet context block for multi-sheet files
    let sheetContextBlock = "";
    let allSheetsBlock = "";
    const hasAllSheets = Array.isArray(allSheets) && allSheets.length > 1;

    if (hasAllSheets) {
      // Full multi-sheet mode — we have actual data from each sheet
      const sheetBlocks = allSheets.map((s) => {
        const safeName = sanitizeForPrompt(s.name, 80);
        const marker = safeName === safeSelectedSheet ? " [PRIMARY / AUTO-SELECTED]" : "";
        const sheetTable = buildMarkdownTable(
          s.headers || [],
          (s.sampleRows || []).slice(0, 10)
        );
        return (
          `<sheet name="${safeName}"${marker}>\n` +
          `${sheetTable}\n` +
          `</sheet>`
        );
      }).join("\n\n");

      allSheetsBlock =
        `<all_sheets count="${allSheets.length}">\n` +
        `${sheetBlocks}\n` +
        `</all_sheets>\n`;

      sheetContextBlock =
        `<sheet_context>\n` +
        `This Excel file has ${allSheets.length} sheets with FULL DATA shown below. ` +
        `The system auto-selected "${safeSelectedSheet}" as the primary sheet.\n` +
        `Review ALL sheets to determine:\n` +
        `1. If multiple sheets contain related data that should be merged (set sheetsToMerge, sheetMappings, mergeStrategy)\n` +
        `2. If a different single sheet would be better (set recommendedSheet)\n` +
        `3. If the selected sheet is correct (leave recommendedSheet null)\n` +
        `\nWhen sheets contain related data (e.g. same products split by batch, or a supplementary sheet ` +
        `with extra columns like varietal/images), use sheetsToMerge to combine them. ` +
        `Provide a sheetMappings entry for EACH sheet mapping its column headers to internal fields.\n` +
        `</sheet_context>\n`;
    } else if (Array.isArray(sheetSummaries) && sheetSummaries.length > 1) {
      // Metadata-only mode (backwards compat — allSheets not provided)
      const sheetLines = sheetSummaries.map((s) => {
        const name = sanitizeForPrompt(s.name, 80);
        const marker = name === safeSelectedSheet ? " [CURRENTLY SELECTED]" : "";
        return `  - "${name}": ${s.rowCount ?? "?"} data rows, ${s.headerCount ?? "?"} columns${marker}`;
      }).join("\n");
      sheetContextBlock =
        `<sheet_context>\n` +
        `This Excel file has ${sheetSummaries.length} sheets. ` +
        `The system auto-selected "${safeSelectedSheet}" based on data quality scoring.\n` +
        `All sheets:\n${sheetLines}\n` +
        `If the selected sheet does NOT contain the primary data (e.g. it's a summary, ` +
        `cover page, or metadata sheet), set recommendedSheet to the sheet name that ` +
        `contains the actual data rows.\n` +
        `</sheet_context>\n`;
    } else if (Array.isArray(sheetNames) && sheetNames.length > 1) {
      const safeNames = sheetNames.map((s) => sanitizeForPrompt(s, 80)).join(", ");
      sheetContextBlock =
        `<sheet_context>\n` +
        `Sheets in workbook: ${safeNames}. Currently analyzing: "${safeSelectedSheet}".\n` +
        `</sheet_context>\n`;
    }

    let mergeInstruction = "";
    if (hasAllSheets) {
      mergeInstruction =
        ` Examine ALL sheets shown. If multiple sheets contain related data, ` +
        `set sheetsToMerge, sheetMappings (per-sheet column→field mappings), ` +
        `mergeStrategy, and mergeKeyField. Otherwise set recommendedSheet if ` +
        `a different single sheet is better, or leave it null.`;
    } else if (sheetContextBlock) {
      mergeInstruction =
        ` If a different sheet would be better, set recommendedSheet to that sheet name.`;
    }

    const userMessage =
      `<file_data>\n` +
      `<file_name>${safeFileName}</file_name>\n` +
      (sheetContextBlock ? sheetContextBlock : `<sheet_names>(single sheet)</sheet_names>\n`) +
      `<headers>${headers.length} columns</headers>\n` +
      `<sample_rows count="${sampleRows.length}" sheet="${safeSelectedSheet || "primary"}">\n` +
      `${table}\n` +
      `</sample_rows>\n` +
      (allSheetsBlock ? allSheetsBlock : ``) +
      `</file_data>\n\n` +
      `Analyze the file above and call the report_analysis tool with your findings.` +
      mergeInstruction;

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    let response;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-5-20241022",
        max_tokens: hasAllSheets ? 8192 : 4096,
        system: buildComprehendSystemPrompt(),
        tools: [REPORT_ANALYSIS_TOOL],
        tool_choice: { type: "tool", name: "report_analysis" },
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (err) {
      console.error("[comprehendReport] Anthropic API error:", err.message);
      return {
        error: true,
        errorType: "api_failure",
        suggestion: "The AI service is unavailable. Please try again in a moment.",
      };
    }

    // Extract the tool_use block
    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock) {
      console.error("[comprehendReport] No tool_use block in response");
      return {
        error: true,
        errorType: "no_tool_use",
        suggestion: "AI did not return a structured analysis. The file may be empty or unreadable.",
      };
    }

    let analysis;
    try {
      analysis = toolUseBlock.input;
    } catch (err) {
      console.error("[comprehendReport] Failed to parse tool input:", err.message);
      return {
        error: true,
        errorType: "parse_failure",
        suggestion: "AI returned malformed analysis data. Please retry.",
      };
    }

    // Validate column indices against actual header count
    if (analysis.extractionSpec) {
      analysis.extractionSpec = validateExtractionSpec(
        analysis.extractionSpec,
        headers.length
      );
    }

    // Ensure codeGen is null (reserved, never returned from this function)
    if (analysis.extractionSpec) {
      analysis.extractionSpec.codeGen = null;
    }

    return analysis;
  });

// ─── generateIntegrationPlan ─────────────────────────────────────────────────

const generateIntegrationPlan = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, analyses } = data;

    if (!tenantId || !Array.isArray(analyses) || analyses.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "tenantId and a non-empty analyses array are required"
      );
    }

    await verifyTenantMembership(context.auth.uid, tenantId);
    await checkRateLimit(tenantId);

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "ANTHROPIC_API_KEY not configured"
      );
    }

    // Build the file summaries block, sanitizing each value
    const fileSummaries = analyses
      .map((a, i) => {
        const name = sanitizeForPrompt(a.fileName, 200);
        const type = sanitizeForPrompt(a.reportType, 60);
        const summary = sanitizeForPrompt(a.humanSummary, 400);
        const targets = Array.isArray(a.dashboardTargets)
          ? a.dashboardTargets.map((t) => sanitizeForPrompt(t, 60)).join(", ")
          : "";
        const rowCount = typeof a.rowCount === "number" ? a.rowCount : "unknown";
        return (
          `<file index="${i + 1}">\n` +
          `  <name>${name}</name>\n` +
          `  <report_type>${type}</report_type>\n` +
          `  <row_count>${rowCount}</row_count>\n` +
          `  <dashboard_targets>${targets}</dashboard_targets>\n` +
          `  <summary>${summary}</summary>\n` +
          `</file>`
        );
      })
      .join("\n");

    const systemPrompt =
      `You are CruFolio's Integration Planner. ` +
      `CruFolio is a wine and spirits supplier CRM and analytics platform. ` +
      `Given a set of analyzed report files, produce a structured integration plan ` +
      `using the integration_plan tool. ` +
      `Consider: which files should be imported first (foundational SKU/account data before transactions), ` +
      `which CruFolio dashboards are covered, what is missing, and any conflicts between files ` +
      `(e.g. duplicate period data from two distributors, overlapping SKUs). ` +
      `CruFolio dashboards: depletions, distributorScorecard, inventoryHealth, placementTracker, ` +
      `revenueAnalysis, arAging, apAging, productCatalog, executiveDashboard.`;

    const userMessage =
      `<files>\n${fileSummaries}\n</files>\n\n` +
      `Generate an integration plan for the ${analyses.length} file(s) above. ` +
      `Call the integration_plan tool with your findings.`;

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    let response;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-5-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [INTEGRATION_PLAN_TOOL],
        tool_choice: { type: "tool", name: "integration_plan" },
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (err) {
      console.error("[generateIntegrationPlan] Anthropic API error:", err.message);
      return {
        error: true,
        errorType: "api_failure",
        suggestion: "The AI service is unavailable. Please try again in a moment.",
      };
    }

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock) {
      console.error("[generateIntegrationPlan] No tool_use block in response");
      return {
        error: true,
        errorType: "no_tool_use",
        suggestion: "AI did not return a structured integration plan. Please retry.",
      };
    }

    return toolUseBlock.input;
  });

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { comprehendReport, generateIntegrationPlan };
