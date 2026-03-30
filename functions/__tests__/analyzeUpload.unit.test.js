const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

// Mock firebase-admin and helpers before requiring analyzeUpload
const mockDb = {
  collection: () => mockDb,
  doc: () => mockDb,
  get: async () => ({ exists: true, data: () => ({}) }),
  set: async () => {},
  runTransaction: async (fn) => fn({
    get: async () => ({ exists: false }),
    set: () => {},
    update: () => {},
  }),
  orderBy: () => mockDb,
};

// Mock the helpers module
mock.module("../helpers", {
  namedExports: {
    onCall: (opts, fn) => fn,
    HttpsError: class HttpsError extends Error {
      constructor(code, msg) { super(msg); this.code = code; }
    },
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TS",
          increment: (n) => n,
          delete: () => "DELETE",
        },
      },
    },
    db: mockDb,
    anthropicApiKey: { value: () => "test-key" },
    verifyTenantMembership: async () => ({}),
  },
});

// Mock claude
let mockClaudeResponse = null;
mock.module("../lib/claude", {
  namedExports: {
    callClaude: async () => mockClaudeResponse,
    extractToolResult: (resp) => {
      if (!resp) return { error: true, errorType: "no_response" };
      const block = resp?.content?.find((b) => b.type === "tool_use");
      return block ? block.input : { error: true, errorType: "no_tool_use" };
    },
  },
});

// Mock aggregation engine
mock.module("../lib/pipeline/aggregationEngine", {
  namedExports: {
    buildDataProfile: (imports) => ({
      imports: imports.map((i) => ({
        fileName: i.fileName,
        fileType: i.fileType,
        rowCount: i.rows?.length || 0,
        columns: {},
      })),
      crossFileJoins: [],
    }),
    computeBlueprint: () => ({ tab_overview: { sections: { kpi_1: [{ value: 100 }] } } }),
    extractFilterValues: () => ["CA", "TX", "NY"],
  },
});

// Mock templates
mock.module("../lib/pipeline/templates", {
  namedExports: {
    matchTemplates: () => [{
      template: {
        templateId: "t1",
        name: "Depletion",
        description: "Depletion dashboard",
        tabs: [{ id: "dep", label: "Depletions", sections: [] }],
      },
      score: 0.8,
    }],
  },
});

// Mock firestore chunked I/O
const writtenDocs = [];
mock.module("../lib/pipeline/firestore", {
  namedExports: {
    readChunked: async () => [
      { acct: "Total Wine", dist: "SGW", st: "CA", qty: 100, revenue: 2000 },
      { acct: "BevMo", dist: "SGW", st: "CA", qty: 75, revenue: 1500 },
    ],
    writeChunked: async (db, path, data, opts) => {
      writtenDocs.push({ path, data });
    },
    createAdminFirestoreAdapter: () => ({}),
  },
});

// Mock generateBlueprint exports
mock.module("../generateBlueprint", {
  namedExports: {
    buildRawDataBySource: (imports) => {
      const bySource = {};
      for (const imp of imports) {
        const src = imp.fileType || "unknown";
        if (!bySource[src]) bySource[src] = [];
        if (imp.rows) bySource[src].push(...imp.rows);
      }
      return bySource;
    },
    normalizeSourceType: (t) => t,
  },
});

// Now require the module under test
const { analyzeUploadForTenant } = require("../analyzeUpload");

// Valid Claude response with combined tool output
const VALID_CLAUDE_RESPONSE = {
  content: [{
    type: "tool_use",
    name: "wine_analysis",
    input: {
      name: "Test Dashboard",
      globalFilters: [{ id: "f_state", label: "State", type: "select", sourceColumn: "st" }],
      tabs: [
        {
          id: "overview",
          label: "Executive Overview",
          sections: [
            {
              id: "kpi_1",
              type: "kpiRow",
              title: "Key Metrics",
              items: [
                { label: "Total Cases", aggregation: { fn: "sum", field: "qty", source: "depletion" }, format: "number" },
              ],
            },
          ],
        },
      ],
      narrativeSegments: [
        { type: "text", content: "Your depletions are trending up across California." },
        { type: "text", content: "Total Wine remains your top account by volume." },
      ],
      suggestedQuestions: [
        "Which accounts are trending down?",
        "What's my best SKU?",
        "How is Texas performing?",
      ],
      actions: [
        { text: "Call Total Wine buyer about Q2 reorder", priority: 1, relatedAccount: "Total Wine" },
        { text: "Check inventory at SGW warehouse", priority: 2, relatedAccount: null },
      ],
    },
  }],
};

describe("analyzeUploadForTenant", () => {
  beforeEach(() => {
    writtenDocs.length = 0;

    // Default: non-empty imports
    mockDb.get = async () => ({
      empty: false,
      size: 2,
      docs: [
        {
          id: "imp1",
          data: () => ({ fileName: "idig_ca.xlsx", type: "depletion", mapping: { acct: "Account" } }),
        },
        {
          id: "imp2",
          data: () => ({ fileName: "idig_tx.xlsx", type: "depletion", mapping: { acct: "Account" } }),
        },
      ],
    });
  });

  it("returns no_data when imports are empty", async () => {
    mockDb.get = async () => ({ empty: true, size: 0, docs: [] });
    const result = await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });
    assert.equal(result.status, "no_data");
  });

  it("generates blueprint and narrative from Claude response", async () => {
    mockClaudeResponse = VALID_CLAUDE_RESPONSE;

    let blueprintWritten = false;
    let activePointerWritten = false;

    mockDb.set = async function (data, opts) {
      if (data.tabs) blueprintWritten = true;
      if (data.blueprintId) activePointerWritten = true;
    };

    const result = await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });

    assert.equal(result.status, "success");
    assert.equal(result.importCount, 2);
    assert.equal(result.tabCount, 1);
    assert.ok(blueprintWritten, "Blueprint doc should be written");
    assert.ok(activePointerWritten, "Active pointer should be updated");
  });

  it("falls back to template when Claude fails", async () => {
    mockClaudeResponse = null; // triggers error path

    let blueprintWritten = false;
    mockDb.set = async function (data) {
      if (data.generatedBy === "template") blueprintWritten = true;
    };

    const result = await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });

    assert.equal(result.status, "success");
    assert.ok(blueprintWritten, "Fallback blueprint should be written");
  });

  it("includes narrative in blueprint doc", async () => {
    mockClaudeResponse = VALID_CLAUDE_RESPONSE;

    let savedNarrative = null;
    mockDb.set = async function (data) {
      if (data.narrative) savedNarrative = data.narrative;
    };

    await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });

    assert.ok(savedNarrative, "Narrative should be embedded in blueprint");
    assert.equal(savedNarrative.segments.length, 2);
    assert.equal(savedNarrative.suggestedQuestions.length, 3);
    assert.equal(savedNarrative.actions.length, 2);
    assert.equal(savedNarrative.actions[0].relatedAccount, "Total Wine");
  });

  it("writes computedData chunks", async () => {
    mockClaudeResponse = VALID_CLAUDE_RESPONSE;
    mockDb.set = async () => {};

    await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });

    // computeBlueprint returns { tab_overview: {...} }, so one writeChunked call
    const chunkWrites = writtenDocs.filter((d) => d.path.includes("computedData"));
    assert.ok(chunkWrites.length > 0, "Should write computed data chunks");
  });

  it("fallback narrative has generic content", async () => {
    mockClaudeResponse = null;

    let savedNarrative = null;
    mockDb.set = async function (data) {
      if (data.narrative) savedNarrative = data.narrative;
    };

    await analyzeUploadForTenant({ tenantId: "t1", triggeredBy: "user1" });

    assert.ok(savedNarrative);
    assert.equal(savedNarrative.segments[0].content, "Here's what stands out in your data.");
    assert.equal(savedNarrative.suggestedQuestions.length, 3);
  });
});
