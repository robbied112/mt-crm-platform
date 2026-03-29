/**
 * generateBlueprintForTenant — called inline from rebuildViewsForTenant.
 * NOT a Cloud Function export. Generates AI-powered dashboard blueprint from raw import data.
 *
 * Uses Claude to analyze data profiles and generate a dynamic dashboard configuration
 * (blueprint) that the generic frontend renderer can display.
 */

const { callClaude, extractToolResult } = require("./lib/claude");
const { buildDataProfile, computeBlueprint, extractFilterValues } = require("./lib/pipeline/aggregationEngine");
const { matchTemplates } = require("./lib/pipeline/templates");
const { writeChunked, createAdminFirestoreAdapter } = require("./lib/pipeline/firestore");

// ─── Blueprint Tool Schema ──────────────────────────────────────────────────

const BLUEPRINT_TOOL = {
  name: "dashboard_blueprint",
  description:
    "Generate a complete dashboard blueprint with tabs, sections (KPIs, charts, tables), " +
    "global filters, and data source specifications for a wine/spirits supplier's data.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Dashboard name (e.g. 'Main Dashboard', 'Q4 Depletion Report')",
      },
      globalFilters: {
        type: "array",
        description: "Filter definitions that apply across all tabs",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["select", "multiSelect", "dateRange"] },
            sourceColumn: { type: "string", description: "Column name in raw data to extract filter values from" },
            multi: { type: "boolean" },
          },
          required: ["id", "label", "type", "sourceColumn"],
        },
      },
      tabs: {
        type: "array",
        description: "Dashboard tabs, each containing sections",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string", description: "Tab display name" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["kpiRow", "chart", "table", "text", "grid"],
                  },
                  title: { type: "string" },
                  chartType: {
                    type: "string",
                    enum: ["bar", "line", "doughnut", "scatter", "area"],
                    description: "Only for chart sections",
                  },
                  items: {
                    type: "array",
                    description: "KPI items (for kpiRow type)",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        aggregation: {
                          type: "object",
                          properties: {
                            fn: { type: "string", enum: ["sum", "avg", "min", "max", "count", "countDistinct", "median"] },
                            field: { type: "string" },
                            source: { type: "string" },
                          },
                          required: ["fn", "field", "source"],
                        },
                        format: { type: "string", enum: ["number", "currency", "decimal", "percent"] },
                      },
                      required: ["label", "aggregation"],
                    },
                  },
                  dataSource: {
                    type: "object",
                    description: "Data query specification for chart/table sections",
                    properties: {
                      source: { type: "string", description: "Import type to query (e.g. 'depletion', 'inventory', 'revenue', 'pipeline')" },
                      groupBy: { type: "array", items: { type: "string" } },
                      aggregation: {
                        description: "Single or array of aggregation specs",
                        oneOf: [
                          {
                            type: "object",
                            properties: {
                              fn: { type: "string" },
                              field: { type: "string" },
                              as: { type: "string" },
                            },
                            required: ["fn", "field"],
                          },
                          {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                fn: { type: "string" },
                                field: { type: "string" },
                                as: { type: "string" },
                              },
                              required: ["fn", "field"],
                            },
                          },
                        ],
                      },
                      sort: {
                        type: "object",
                        properties: {
                          field: { type: "string" },
                          dir: { type: "string", enum: ["asc", "desc"] },
                        },
                      },
                      limit: { type: "integer" },
                      filter: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            field: { type: "string" },
                            op: { type: "string", enum: ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains"] },
                            value: {},
                          },
                          required: ["field", "op", "value"],
                        },
                      },
                    },
                    required: ["source"],
                  },
                  columns: {
                    type: "array",
                    description: "Table column definitions (for table type)",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string" },
                        label: { type: "string" },
                        format: { type: "string", enum: ["number", "currency", "decimal", "percent", "string"] },
                        sortable: { type: "boolean" },
                      },
                      required: ["field", "label"],
                    },
                  },
                  xAxis: {
                    type: "object",
                    properties: { field: { type: "string" }, label: { type: "string" } },
                  },
                  yAxis: {
                    type: "object",
                    properties: { field: { type: "string" }, label: { type: "string" } },
                  },
                  exportable: { type: "boolean" },
                  content: { type: "string", description: "Text content for text sections" },
                },
                required: ["id", "type"],
              },
            },
          },
          required: ["id", "label", "sections"],
        },
      },
    },
    required: ["name", "globalFilters", "tabs"],
  },
};

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CruFolio's Dashboard Blueprint Generator for wine and spirits supplier teams.

Given a data profile describing all uploaded files (column statistics, cardinality, types, cross-file joins), generate a comprehensive, data-driven dashboard blueprint.

DATA SOURCES — DUAL-KEY SYSTEM:
You have two types of source keys to reference in dataSource.source:
1. File-level keys (prefixed "file_"): reference a specific uploaded file. Example: "file_4m_rolling_depletion" for the file "4M_Rolling_Depletion.csv". Use these when a tab should show data from one specific file.
2. Type-level keys: aggregate all files of the same type. Example: "depletion" combines all depletion files. Use these for cross-file summaries.

The available source keys are provided in the "availableSources" field. ONLY reference keys that appear in that list.

RULES:
- Analyze the ACTUAL data columns and statistics. Build tabs, KPIs, charts, and tables based on what the data contains, not generic templates.
- If multiple files of the same type exist (e.g. 4M, 13W, 4W depletion reports), create comparison tabs showing how metrics differ across time windows.
- Start with an Executive Overview tab that summarizes the most important metrics across all data sources.
- Use specific field names from the data profile — reference actual column names the user uploaded.
- Create meaningful global filters based on high-cardinality dimension columns (state, distributor, channel, etc).
- Each tab should have 3-6 sections mixing KPIs, charts, and tables.
- Include at least one chart per tab (bar, line, doughnut are most useful).
- Tables should be the primary detail view — always include sortable columns and exportable flag.
- KPI rows should lead each tab with 3-5 headline metrics.
- Use wine/spirits terminology: "Case Equivalents" not "units", "Depletions" not "sales", "Placements" not "orders".
- When both depletion and inventory data exist, create cross-reference insights (sell-through rate = depletions / on-hand).
- Section IDs must be unique across the entire blueprint.
- Tab IDs must be unique.
- Filter IDs must be unique.

AGGREGATION FUNCTIONS: sum, avg, min, max, count, countDistinct, median

CHART TYPES: bar (horizontal or vertical grouped data), line (time series trends), doughnut (distribution/mix), scatter (correlation), area (cumulative trends)

FORMATS: number (integers), currency ($), decimal (1-2 places), percent (%)

Always generate at least 3 tabs. More is better if the data supports it.`;

// ─── Blueprint Generation ───────────────────────────────────────────────────

/**
 * Generate a blueprint for a tenant. Called inline from rebuild.js.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {object[]} params.rawImports - Array of { fileName, fileType, headers, columnTypes, rows }
 * @param {object} params.db - Firestore instance
 * @param {object} params.admin - Firebase Admin
 * @param {string} params.apiKey - Anthropic API key
 * @returns {object|null} The blueprint data, or null on failure
 */
async function generateBlueprintForTenant({ tenantId, rawImports, db, admin, apiKey }) {
  try {
    if (!rawImports || rawImports.length === 0) {
      console.log(`[generateBlueprint] No raw imports for tenant ${tenantId}, skipping`);
      return null;
    }

    const firestoreAdapter = createAdminFirestoreAdapter({ admin, db });

    // 1. Build data profile (summaries, not raw rows)
    const dataProfile = buildDataProfile(rawImports);

    // 2. Match industry templates
    const templateMatches = matchTemplates(dataProfile);
    const matchedTemplates = templateMatches.slice(0, 3).map((m) => ({
      templateId: m.template.templateId,
      name: m.template.name,
      description: m.template.description,
      score: m.score,
      tabs: m.template.tabs,
    }));

    // 3. Build raw data by source (needed for availableSources list)
    const rawDataBySource = buildRawDataBySource(rawImports);
    const availableSources = Object.keys(rawDataBySource);

    // 4. Build the AI prompt
    const hasRichProfile = dataProfile.imports.some((imp) =>
      Object.values(imp.columns).some((col) => col.nonNullCount > 0)
    );

    const userMessage = JSON.stringify({
      dataProfile: {
        imports: dataProfile.imports.map((imp) => ({
          fileName: imp.fileName,
          fileType: imp.fileType,
          rowCount: imp.rowCount,
          columns: Object.fromEntries(
            Object.entries(imp.columns).map(([header, col]) => [
              header,
              {
                dataType: col.dataType,
                cardinality: col.cardinality,
                nonNullCount: col.nonNullCount,
                samples: col.samples,
                semantic: col.semantic,
                ...(col.min !== undefined ? { min: col.min, max: col.max, mean: Math.round(col.mean * 100) / 100 } : {}),
              },
            ])
          ),
        })),
        crossFileJoins: dataProfile.crossFileJoins,
      },
      availableSources,
      // Only include templates when data profile is sparse (fallback guidance)
      ...(hasRichProfile ? {} : { matchedTemplates }),
      instructions:
        "Generate a dashboard blueprint based on the data profile above. " +
        "Use the availableSources list for dataSource.source values — use file-level keys (file_*) " +
        "for file-specific tabs and type-level keys for cross-file aggregation. " +
        "When multiple files of the same type exist, create comparison tabs. " +
        "Reference actual column names from the data profile in your aggregation specs.",
    });

    // 5. Call Claude
    const response = await callClaude({
      apiKey,
      model: "claude-sonnet-4-20250514",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tools: [BLUEPRINT_TOOL],
      toolChoice: { type: "tool", name: "dashboard_blueprint" },
      maxTokens: 8192,
    });

    const result = extractToolResult(response);
    if (result.error) {
      console.error(`[generateBlueprint] Claude failed (${result.errorType}) for tenant ${tenantId}`);
      // Fallback: use templates directly without AI customization
      return await generateFallbackBlueprint({ tenantId, rawImports, templateMatches, db, admin, firestoreAdapter });
    }

    // 6. Compute data for all sections
    const computedData = computeBlueprint(result, rawDataBySource);

    // 7. Extract filter values
    const filterValues = {};
    for (const filter of result.globalFilters || []) {
      filterValues[filter.id] = extractFilterValues(filter, rawDataBySource);
    }

    // 8. Write blueprint to Firestore
    const blueprintId = `bp_${Date.now()}`;
    const blueprintDoc = {
      name: result.name || "Dashboard",
      version: 1,
      status: "ready",
      generatedBy: "ai",
      tabs: result.tabs,
      globalFilters: result.globalFilters || [],
      filterValues,
      dataSources: rawImports.map((r) => ({ fileName: r.fileName, fileType: r.fileType })),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const blueprintRef = db.collection("tenants").doc(tenantId)
      .collection("reportBlueprints").doc(blueprintId);
    await blueprintRef.set(blueprintDoc);

    // Write computed data per tab
    for (const [tabId, tabData] of Object.entries(computedData)) {
      await writeChunked(
        db,
        ["tenants", tenantId, "reportBlueprints", blueprintId, "computedData", tabId],
        tabData,
        { adapter: firestoreAdapter }
      );
    }

    // Update active pointer
    await db.collection("tenants").doc(tenantId)
      .collection("reportBlueprints").doc("active")
      .set({ blueprintId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    console.log(`[generateBlueprint] Blueprint ${blueprintId} created for tenant ${tenantId} with ${result.tabs?.length || 0} tabs`);
    return { blueprintId, ...blueprintDoc };
  } catch (err) {
    console.error(`[generateBlueprint] Error for tenant ${tenantId}:`, err.message);
    return null;
  }
}

/**
 * Fallback blueprint from templates when AI fails.
 */
async function generateFallbackBlueprint({ tenantId, rawImports, templateMatches, db, admin, firestoreAdapter }) {
  if (!templateMatches || templateMatches.length === 0) return null;

  // Combine top-matching template tabs
  const allTabs = [];
  const usedIds = new Set();

  for (const { template } of templateMatches.slice(0, 3)) {
    for (const tab of template.tabs || []) {
      if (!usedIds.has(tab.id)) {
        allTabs.push(tab);
        usedIds.add(tab.id);
      }
    }
  }

  if (allTabs.length === 0) return null;

  const blueprint = {
    name: "Dashboard",
    globalFilters: [
      { id: "f_state", label: "State", type: "select", sourceColumn: "st", multi: true },
      { id: "f_distributor", label: "Distributor", type: "select", sourceColumn: "dist", multi: true },
    ],
    tabs: allTabs,
  };

  // Compute data
  const rawDataBySource = buildRawDataBySource(rawImports);
  const computedData = computeBlueprint(blueprint, rawDataBySource);

  const filterValues = {};
  for (const filter of blueprint.globalFilters) {
    filterValues[filter.id] = extractFilterValues(filter, rawDataBySource);
  }

  // Write to Firestore
  const blueprintId = `bp_${Date.now()}`;
  const blueprintDoc = {
    name: "Dashboard",
    version: 1,
    status: "ready",
    generatedBy: "template",
    tabs: blueprint.tabs,
    globalFilters: blueprint.globalFilters,
    filterValues,
    dataSources: rawImports.map((r) => ({ fileName: r.fileName, fileType: r.fileType })),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const blueprintRef = db.collection("tenants").doc(tenantId)
    .collection("reportBlueprints").doc(blueprintId);
  await blueprintRef.set(blueprintDoc);

  for (const [tabId, tabData] of Object.entries(computedData)) {
    await writeChunked(
      db,
      ["tenants", tenantId, "reportBlueprints", blueprintId, "computedData", tabId],
      tabData,
      { adapter: firestoreAdapter }
    );
  }

  await db.collection("tenants").doc(tenantId)
    .collection("reportBlueprints").doc("active")
    .set({ blueprintId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  console.log(`[generateBlueprint] Fallback blueprint ${blueprintId} created for tenant ${tenantId}`);
  return { blueprintId, ...blueprintDoc };
}

/**
 * Build rawDataBySource from import rows with dual-key strategy:
 *   - Per-file keys (file_<sanitized_name>) for file-specific analysis
 *   - Per-type keys (depletion, inventory, etc.) for cross-file aggregation
 *
 * This preserves individual file identity while still allowing type-level queries.
 */
function buildRawDataBySource(rawImports) {
  const bySource = {};
  for (const imp of rawImports) {
    // Per-file key for file-specific analysis
    const fileKey = sanitizeSourceKey(imp.fileName);
    if (fileKey) {
      if (!bySource[fileKey]) bySource[fileKey] = [];
      if (imp.rows) bySource[fileKey].push(...imp.rows);
    }

    // Per-type key for cross-file aggregation
    const typeKey = normalizeSourceType(imp.fileType || imp.type || "unknown");
    if (!bySource[typeKey]) bySource[typeKey] = [];
    if (imp.rows) bySource[typeKey].push(...imp.rows);
  }
  return bySource;
}

/**
 * Sanitize a filename into a source key. Prefixed with "file_" to avoid
 * collision with type keys (e.g. "depletion.csv" → "file_depletion").
 */
function sanitizeSourceKey(fileName) {
  if (!fileName) return null;
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase().slice(0, 50);
  return `file_${base}`;
}

/**
 * Normalize file types to source categories used in blueprint dataSource.source.
 */
function normalizeSourceType(fileType) {
  const aliases = {
    distributor_velocity: "depletion",
    depletion_report: "depletion",
    sales: "depletion",
    sales_report: "depletion",
    inventory_health: "inventory",
    inventory_snapshot: "inventory",
    quickbooks_revenue: "revenue",
    ar_aging: "revenue",
    ap_aging: "revenue",
    pipeline: "pipeline",
    purchases: "purchases",
    product_catalog: "products",
  };
  return aliases[fileType] || fileType;
}

module.exports = { generateBlueprintForTenant, buildRawDataBySource, normalizeSourceType, sanitizeSourceKey };
