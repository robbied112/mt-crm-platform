/**
 * analyzeUpload — AI Wine Analyst Cloud Function.
 *
 * Reads ALL imports for a tenant, calls Claude Sonnet once with a combined
 * tool schema (blueprint + narrative), computes dashboard data, and writes
 * to reportBlueprints/ (with embedded narrative). Existing BlueprintContext
 * picks up results via real-time listener — zero frontend context changes.
 */

const {
  onCall,
  HttpsError,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
} = require("./helpers");

const { callClaude, extractToolResult } = require("./lib/claude");
const {
  buildDataProfile,
  computeBlueprint,
  extractFilterValues,
} = require("./lib/pipeline/aggregationEngine");
const { matchTemplates } = require("./lib/pipeline/templates");
const {
  readChunked,
  writeChunked,
  createAdminFirestoreAdapter,
} = require("./lib/pipeline/firestore");
const { buildRawDataBySource, normalizeSourceType } = require("./generateBlueprint");

const firestoreAdapter = createAdminFirestoreAdapter({ admin, db });

// ─── Rate Limit ──────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function checkAnalysisRateLimit(tenantId) {
  const ref = db
    .collection("tenants")
    .doc(tenantId)
    .collection("rateLimits")
    .doc("analyzeUpload");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    const { count, windowStart } = snap.data();

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    if (count >= RATE_LIMIT_MAX) {
      throw new HttpsError(
        "resource-exhausted",
        `Analysis limit reached: max ${RATE_LIMIT_MAX} analyses per hour. Try again later.`
      );
    }

    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
  });
}

// ─── Wine Industry System Prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CruFolio's AI Wine Analyst — a domain expert in the wine and spirits three-tier distribution system. You analyze distributor report data and generate both a dashboard blueprint and a narrative briefing.

WINE & SPIRITS DOMAIN KNOWLEDGE:

Three-Tier System:
- Producer/Supplier → Distributor/Wholesaler → Retailer/Restaurant
- Distributors (Southern Glazer's/SGWS, Republic National/RNDC, Breakthru) control market access
- Producers have limited visibility into retail performance — distributor reports are their window

Depletion Metrics:
- "Depletion" = sale from distributor to retailer (not winery to distributor, that's a "shipment")
- Standard unit: 9-liter case equivalent (9L CE). Convert physical cases based on bottle size
- Velocity = cases per point of distribution per month. Good velocity varies by price tier:
  - Value (<$10): 2-4 cases/month, Premium ($10-20): 1-2, Luxury ($20+): 0.5-1
- Days on Hand (DOH) = inventory / avg monthly depletions. Target: 30-45 days
  - DOH > 60 = overstocked (distributor may stop ordering)
  - DOH < 20 = at risk of going out-of-stock

Account Types:
- On-Premise: restaurants, bars, hotels (by-the-glass, wine lists). Higher margin, lower volume
- Off-Premise: retail stores, grocery, wine shops. Lower margin, higher volume
- Key accounts: Total Wine, Spec's, BevMo, Costco, Kroger — chain accounts are high-volume
- Independent accounts: single-location stores/restaurants — relationship-driven

Distributor Report Formats:
- iDig: Common velocity/depletion portal. Column names vary wildly between distributors
- VIP: Another common portal. Different terminology
- Reports often have: Account Name, City, State, Product/SKU, Cases/Units, various date periods
- Monthly/quarterly rolling reports show columns like "Current Month", "Prior Month", "YTD"

Seasonal Patterns:
- Oct-Dec: Holiday buying surge (gift sets, premium wines)
- Jan-Feb: Post-holiday dip, distributors reduce inventory
- Mar-May: Spring wine season, rosé/white ramp-up
- Jun-Aug: Summer whites, rosé peak, lighter reds
- Sep: Harvest season, trade shows, new vintage releases

Pricing:
- FOB (Free On Board): price from winery to distributor
- Front-line/Posted: distributor's standard price to retailer
- Shelf price: what the consumer pays
- Typical distributor margin: 25-33% markup
- Typical retailer margin: 33-50% markup

Common Pain Points:
- Accounts "going dark": stopped ordering, no visibility into why
- Distributor attention: small brands get buried, reps focus on big portfolios
- Reorder timing: miss the window and lose shelf space
- Competitive displacement: another wine takes your placement
- Data fragmentation: 5+ sources, no unified view

DASHBOARD GENERATION RULES:
- Create tabs that match the data available. Depletion data → depletion tabs. Inventory → inventory tabs. Both → cross-reference tabs.
- Each tab: 3-6 sections mixing KPIs, charts, and tables
- Start with an Executive Overview tab summarizing the most important metrics
- Use actual field names from the data profile in your aggregation specs
- For "source" in dataSource, use the file type category (depletion, inventory, revenue, pipeline, purchases)
- Global filters: high-cardinality dimensions (state, distributor, channel, account, SKU)
- At least one chart per tab (bar, line, doughnut are most useful)
- Tables: sortable columns, exportable flag, primary detail view
- KPI rows: lead each tab with 3-5 headline metrics
- Use wine terminology: "Case Equivalents" not "units", "Depletions" not "sales", "Placements" not "orders"
- When depletion + inventory data exist, create cross-reference insights (sell-through rate, DOH)
- Section/tab/filter IDs must be unique

NARRATIVE RULES:
- Lead with the most important finding in one punchy sentence
- Be specific: name accounts, SKUs, distributors, states when the data shows them
- Use **account names** and **SKU names** in bold markdown when mentioning specific entities
- Include specific percentage changes (e.g., +47%, -12%) when referencing metrics
- Suggest 3 follow-up questions the user would want to ask
- Recommend 3-5 specific, actionable items (e.g., "Call Total Wine Pasadena buyer", "Check inventory at SGWS Houston")
- Keep the narrative to 2-3 short paragraphs
- Never invent data — only reference what appears in the data profile

AGGREGATION FUNCTIONS: sum, avg, min, max, count, countDistinct, median
CHART TYPES: bar, line, doughnut, scatter, area
FORMATS: number, currency, decimal, percent`;

// ─── Combined Analysis Tool Schema ───────────────────────────────────────────

const ANALYSIS_TOOL = {
  name: "wine_analysis",
  description:
    "Generate a complete dashboard blueprint with narrative analysis " +
    "for a wine/spirits supplier's uploaded data.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Dashboard name (e.g. 'Depletion Analysis', 'Q4 Overview')",
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
                      source: { type: "string", description: "Import type to query (e.g. 'depletion', 'inventory', 'revenue')" },
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
      // ─── Narrative fields (embedded in same tool response) ───
      narrativeSegments: {
        type: "array",
        description: "Ordered text segments forming the analysis narrative",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["text"] },
            content: { type: "string", description: "Narrative text content" },
          },
          required: ["type", "content"],
        },
      },
      suggestedQuestions: {
        type: "array",
        items: { type: "string" },
        description: "3 follow-up questions the user might want to ask about their data",
      },
      actions: {
        type: "array",
        description: "3-5 recommended actions based on the data",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            priority: { type: "integer" },
            relatedAccount: {
              description: "Account name if action is account-specific, null otherwise",
              oneOf: [{ type: "string" }, { type: "null" }],
            },
            accountId: {
              description: "CRM account ID if this action relates to a known account. Only include if the account appears in the CRM accounts list provided.",
              oneOf: [{ type: "string" }, { type: "null" }],
            },
          },
          required: ["text", "priority"],
        },
      },
    },
    required: ["name", "globalFilters", "tabs", "narrativeSegments", "suggestedQuestions", "actions"],
  },
};

// ─── Core Analysis Logic ─────────────────────────────────────────────────────

async function analyzeUploadForTenant({ tenantId, triggeredBy }) {
  // 1. Read ALL imports for this tenant
  const importsSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("imports")
    .orderBy("createdAt", "asc")
    .get();

  if (importsSnap.empty) {
    return { status: "no_data", message: "No imports found. Upload a file first." };
  }

  // 2. Load all import rows (reuse pattern from rebuild.js)
  const rawImports = await Promise.all(
    importsSnap.docs.map(async (importDoc) => {
      const meta = importDoc.data();
      const rows = await readChunked(
        db,
        ["tenants", tenantId, "imports", importDoc.id],
        { adapter: firestoreAdapter, emptyValue: [], preferRows: true }
      );
      return {
        fileName: meta.fileName || importDoc.id,
        fileType: meta.type || "unknown",
        type: meta.type || "unknown",
        headers: meta.originalHeaders || (meta.mapping ? Object.values(meta.mapping).filter((v) => typeof v === "string") : []),
        columnTypes: meta.columnTypes || {},
        rows,
        rowCount: rows.length,
      };
    })
  );

  const totalRows = rawImports.reduce((sum, imp) => sum + imp.rows.length, 0);
  if (totalRows === 0) {
    return { status: "no_data", message: "Imports contain no rows." };
  }

  // 3. Build data profile and match templates
  const dataProfile = buildDataProfile(rawImports);
  const templateMatches = matchTemplates(dataProfile);
  const matchedTemplates = templateMatches.slice(0, 3).map((m) => ({
    templateId: m.template.templateId,
    name: m.template.name,
    description: m.template.description,
    score: m.score,
    tabs: m.template.tabs,
  }));

  // 4. Load CRM accounts for action matching
  // TOKEN BUDGET: Monitor if CRM account list grows past 100 accounts (~500 tokens). See TODO-403.
  const accountsSnap = await db.collection("tenants").doc(tenantId).collection("accounts").get();
  const crmAccounts = accountsSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));

  // 5. Build user message with data profile + sample rows
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
              ...(col.min !== undefined
                ? { min: col.min, max: col.max, mean: Math.round(col.mean * 100) / 100 }
                : {}),
            },
          ])
        ),
      })),
      crossFileJoins: dataProfile.crossFileJoins,
    },
    crmAccounts,
    matchedTemplates,
    instructions:
      "Analyze this wine/spirits supplier's data. Generate a dashboard blueprint " +
      "with tabs, charts, KPIs, and tables based on what the data contains. " +
      "Also write a brief narrative analysis highlighting the most important findings, " +
      "suggest 3 follow-up questions, and recommend 3-5 specific actions. " +
      "Use the matched templates as inspiration but customize based on the actual data. " +
      "Reference actual column names from the data profile in your aggregation specs. " +
      "If an action relates to an account that matches one in the crmAccounts list, include the accountId. " +
      "Do not guess — only include accountId for exact or very close name matches.",
  });

  // 6. Call Claude Sonnet (single combined call)
  const apiKey = anthropicApiKey.value();
  const response = await callClaude({
    apiKey,
    model: "claude-sonnet-4-5-20241022",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tools: [ANALYSIS_TOOL],
    toolChoice: { type: "tool", name: "wine_analysis" },
    maxTokens: 8192,
  });

  const result = extractToolResult(response);
  const rawDataBySource = buildRawDataBySource(rawImports);

  let blueprintDoc;

  if (result.error) {
    console.error(`[analyzeUpload] Claude failed (${result.errorType}) for tenant ${tenantId}`);
    // Fallback: template-based blueprint + generic narrative
    blueprintDoc = await writeFallbackBlueprint({
      tenantId,
      rawImports,
      rawDataBySource,
      templateMatches,
      totalRows,
      triggeredBy,
    });
  } else {
    // 6. Compute dashboard data from Claude's blueprint
    const computedData = computeBlueprint(result, rawDataBySource);

    const filterValues = {};
    for (const filter of result.globalFilters || []) {
      filterValues[filter.id] = extractFilterValues(filter, rawDataBySource);
    }

    // 7. Write blueprint (with embedded narrative) to Firestore
    const blueprintId = `ai_${Date.now()}`;
    blueprintDoc = {
      name: result.name || "Analysis",
      version: 1,
      status: "ready",
      generatedBy: "ai",
      tabs: result.tabs,
      globalFilters: result.globalFilters || [],
      filterValues,
      narrative: {
        segments: result.narrativeSegments || [{ type: "text", content: "Analysis complete." }],
        suggestedQuestions: result.suggestedQuestions || [],
        actions: (result.actions || []).map((a, i) => ({
          text: a.text,
          priority: a.priority || i + 1,
          relatedAccount: a.relatedAccount || null,
          accountId: a.accountId || null,
        })),
      },
      dataSources: rawImports.map((r) => ({ fileName: r.fileName, fileType: r.fileType })),
      totalRows,
      triggeredBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const blueprintRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("reportBlueprints")
      .doc(blueprintId);
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
    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("reportBlueprints")
      .doc("active")
      .set(
        { blueprintId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

    console.log(
      `[analyzeUpload] Blueprint ${blueprintId} created for tenant ${tenantId}: ` +
      `${result.tabs?.length || 0} tabs, ${totalRows} rows, ${importsSnap.size} imports`
    );
  }

  return {
    status: "success",
    importCount: importsSnap.size,
    totalRows,
    tabCount: blueprintDoc?.tabs?.length || 0,
  };
}

// ─── Fallback: Template Blueprint + Generic Narrative ────────────────────────

async function writeFallbackBlueprint({
  tenantId,
  rawImports,
  rawDataBySource,
  templateMatches,
  totalRows,
  triggeredBy,
}) {
  // Combine top-matching template tabs
  const allTabs = [];
  const usedIds = new Set();

  for (const { template } of (templateMatches || []).slice(0, 3)) {
    for (const tab of template.tabs || []) {
      if (!usedIds.has(tab.id)) {
        allTabs.push(tab);
        usedIds.add(tab.id);
      }
    }
  }

  const blueprint = {
    name: "Analysis",
    globalFilters: [
      { id: "f_state", label: "State", type: "select", sourceColumn: "st", multi: true },
      { id: "f_distributor", label: "Distributor", type: "select", sourceColumn: "dist", multi: true },
    ],
    tabs: allTabs.length > 0 ? allTabs : [],
  };

  const computedData = allTabs.length > 0 ? computeBlueprint(blueprint, rawDataBySource) : {};

  const filterValues = {};
  for (const filter of blueprint.globalFilters) {
    filterValues[filter.id] = extractFilterValues(filter, rawDataBySource);
  }

  const blueprintId = `ai_fallback_${Date.now()}`;
  const blueprintDoc = {
    name: "Analysis",
    version: 1,
    status: "ready",
    generatedBy: "template",
    tabs: blueprint.tabs,
    globalFilters: blueprint.globalFilters,
    filterValues,
    narrative: {
      segments: [{ type: "text", content: "Here's what stands out in your data." }],
      suggestedQuestions: [
        "Which accounts have the highest volume?",
        "What's my inventory situation?",
        "Which distributors are performing best?",
      ],
      actions: [],
    },
    dataSources: rawImports.map((r) => ({ fileName: r.fileName, fileType: r.fileType })),
    totalRows,
    triggeredBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const blueprintRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("reportBlueprints")
    .doc(blueprintId);
  await blueprintRef.set(blueprintDoc);

  for (const [tabId, tabData] of Object.entries(computedData)) {
    await writeChunked(
      db,
      ["tenants", tenantId, "reportBlueprints", blueprintId, "computedData", tabId],
      tabData,
      { adapter: firestoreAdapter }
    );
  }

  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("reportBlueprints")
    .doc("active")
    .set(
      { blueprintId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

  console.log(`[analyzeUpload] Fallback blueprint ${blueprintId} created for tenant ${tenantId}`);
  return blueprintDoc;
}

// ─── Cloud Function Export ───────────────────────────────────────────────────

const analyzeUpload = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 540, memory: "2GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId } = req.data;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);
    await checkAnalysisRateLimit(tenantId);

    return analyzeUploadForTenant({
      tenantId,
      triggeredBy: req.auth.uid,
    });
  }
);

module.exports = {
  analyzeUpload,
  analyzeUploadForTenant,
  // Exported for testing
  _ANALYSIS_TOOL: ANALYSIS_TOOL,
  _SYSTEM_PROMPT: SYSTEM_PROMPT,
  _RATE_LIMIT_MAX: RATE_LIMIT_MAX,
};
