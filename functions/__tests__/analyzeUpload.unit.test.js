const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  _ANALYSIS_TOOL: ANALYSIS_TOOL,
  _SYSTEM_PROMPT: SYSTEM_PROMPT,
  _RATE_LIMIT_MAX: RATE_LIMIT_MAX,
} = require("../analyzeUpload");

describe("ANALYSIS_TOOL schema", () => {
  it("has the correct tool name", () => {
    assert.equal(ANALYSIS_TOOL.name, "wine_analysis");
  });

  it("requires name, globalFilters, tabs, narrativeSegments, suggestedQuestions, actions", () => {
    const required = ANALYSIS_TOOL.input_schema.required;
    assert.ok(required.includes("name"));
    assert.ok(required.includes("globalFilters"));
    assert.ok(required.includes("tabs"));
    assert.ok(required.includes("narrativeSegments"));
    assert.ok(required.includes("suggestedQuestions"));
    assert.ok(required.includes("actions"));
  });

  it("has tab schema with id, label, sections required", () => {
    const tabSchema = ANALYSIS_TOOL.input_schema.properties.tabs.items;
    assert.deepEqual(tabSchema.required, ["id", "label", "sections"]);
  });

  it("has section types: kpiRow, chart, table, text, grid", () => {
    const sectionType = ANALYSIS_TOOL.input_schema.properties.tabs.items
      .properties.sections.items.properties.type;
    assert.deepEqual(sectionType.enum, ["kpiRow", "chart", "table", "text", "grid"]);
  });

  it("has chart types: bar, line, doughnut, scatter, area", () => {
    const chartType = ANALYSIS_TOOL.input_schema.properties.tabs.items
      .properties.sections.items.properties.chartType;
    assert.deepEqual(chartType.enum, ["bar", "line", "doughnut", "scatter", "area"]);
  });

  it("has aggregation functions: sum, avg, min, max, count, countDistinct, median", () => {
    const kpiAgg = ANALYSIS_TOOL.input_schema.properties.tabs.items
      .properties.sections.items.properties.items.items
      .properties.aggregation.properties.fn;
    assert.deepEqual(kpiAgg.enum, ["sum", "avg", "min", "max", "count", "countDistinct", "median"]);
  });

  it("has narrativeSegments with type and content", () => {
    const segSchema = ANALYSIS_TOOL.input_schema.properties.narrativeSegments.items;
    assert.deepEqual(segSchema.required, ["type", "content"]);
    assert.deepEqual(segSchema.properties.type.enum, ["text"]);
  });

  it("has actions with text, priority, relatedAccount", () => {
    const actionSchema = ANALYSIS_TOOL.input_schema.properties.actions.items;
    assert.deepEqual(actionSchema.required, ["text", "priority"]);
    assert.ok(actionSchema.properties.relatedAccount);
  });

  it("has filter types: select, multiSelect, dateRange", () => {
    const filterType = ANALYSIS_TOOL.input_schema.properties.globalFilters.items
      .properties.type;
    assert.deepEqual(filterType.enum, ["select", "multiSelect", "dateRange"]);
  });

  it("has globalFilters with required fields", () => {
    const filterSchema = ANALYSIS_TOOL.input_schema.properties.globalFilters.items;
    assert.deepEqual(filterSchema.required, ["id", "label", "type", "sourceColumn"]);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("contains wine industry domain knowledge", () => {
    assert.ok(SYSTEM_PROMPT.includes("three-tier"));
    assert.ok(SYSTEM_PROMPT.includes("Depletion"));
    assert.ok(SYSTEM_PROMPT.includes("9-liter case equivalent"));
    assert.ok(SYSTEM_PROMPT.includes("Days on Hand"));
  });

  it("contains distributor names", () => {
    assert.ok(SYSTEM_PROMPT.includes("Southern Glazer"));
    assert.ok(SYSTEM_PROMPT.includes("RNDC"));
    assert.ok(SYSTEM_PROMPT.includes("Breakthru"));
  });

  it("contains seasonal patterns", () => {
    assert.ok(SYSTEM_PROMPT.includes("Oct-Dec"));
    assert.ok(SYSTEM_PROMPT.includes("Holiday"));
    assert.ok(SYSTEM_PROMPT.includes("rosé"));
  });

  it("contains pricing terminology", () => {
    assert.ok(SYSTEM_PROMPT.includes("FOB"));
    assert.ok(SYSTEM_PROMPT.includes("Front-line"));
    assert.ok(SYSTEM_PROMPT.includes("Shelf price"));
  });

  it("contains dashboard generation rules", () => {
    assert.ok(SYSTEM_PROMPT.includes("Case Equivalents"));
    assert.ok(SYSTEM_PROMPT.includes("KPI rows"));
    assert.ok(SYSTEM_PROMPT.includes("exportable"));
  });

  it("contains narrative rules", () => {
    assert.ok(SYSTEM_PROMPT.includes("punchy sentence"));
    assert.ok(SYSTEM_PROMPT.includes("Never invent data"));
    assert.ok(SYSTEM_PROMPT.includes("3 follow-up questions"));
  });
});

describe("RATE_LIMIT_MAX", () => {
  it("is 10 analyses per hour", () => {
    assert.equal(RATE_LIMIT_MAX, 10);
  });
});
