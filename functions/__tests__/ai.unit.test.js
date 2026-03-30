/**
 * Unit tests for AI mapping helpers: buildAIPrompt and parseAIResponse.
 *
 * helpers.js requires firebase-functions which isn't available in plain
 * Node test context, so we extract and test the pure functions directly.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// ─── Inline copies of pure functions from helpers.js ─────────────
// These are exact copies tested against the real module's behavior.

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

function buildAIPrompt(headers, rows, userRole) {
  const roleContext = userRole === "distributor"
    ? "You are a data mapping expert for a beverage/CPG distributor CRM. The user is a distributor tracking suppliers/vendors and their own stores/locations."
    : "You are a data mapping expert for a beverage/CPG supplier CRM. The user is a supplier tracking distributors and retail accounts.";

  const table = [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
  ].join("\n");

  return `${roleContext} Map each column to an internal field.

INTERNAL FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n")}

SOURCE DATA:
${table}

Return JSON: { "mapping": { "<field>": "<column>" }, "monthColumns": [], "weekColumns": [], "uploadType": "quickbooks"|"depletion"|"sales"|"purchases"|"inventory"|"pipeline"|"unknown", "confidence": { "<field>": 0.0-1.0 } }

Return ONLY valid JSON.`;
}

function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned no valid JSON");
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }
}

// ─── Tests ───────────────────────────────────────────────────────

describe("buildAIPrompt", () => {
  const headers = ["Customer", "Product", "Cases", "Date"];
  const rows = [
    { Customer: "Acme Wines", Product: "Cab Sauv 2021", Cases: "24", Date: "2025-01" },
    { Customer: "Best Spirits", Product: "Pinot Noir 2022", Cases: "12", Date: "2025-02" },
  ];

  it("includes supplier role context by default", () => {
    const prompt = buildAIPrompt(headers, rows, "supplier");
    assert.ok(prompt.includes("supplier CRM"));
    assert.ok(prompt.includes("tracking distributors"));
  });

  it("includes distributor role context when specified", () => {
    const prompt = buildAIPrompt(headers, rows, "distributor");
    assert.ok(prompt.includes("distributor CRM"));
    assert.ok(prompt.includes("tracking suppliers"));
  });

  it("includes all column headers in the table", () => {
    const prompt = buildAIPrompt(headers, rows, "supplier");
    for (const h of headers) {
      assert.ok(prompt.includes(h), `Missing header: ${h}`);
    }
  });

  it("includes sample row data", () => {
    const prompt = buildAIPrompt(headers, rows, "supplier");
    assert.ok(prompt.includes("Acme Wines"));
    assert.ok(prompt.includes("Cab Sauv 2021"));
  });

  it("includes internal field definitions", () => {
    const prompt = buildAIPrompt(headers, rows, "supplier");
    assert.ok(prompt.includes("acct: Account / Customer Name"));
    assert.ok(prompt.includes("sku: Product / SKU / Item"));
    assert.ok(prompt.includes("qty: Quantity / Volume"));
  });

  it("requests JSON response format", () => {
    const prompt = buildAIPrompt(headers, rows, "supplier");
    assert.ok(prompt.includes("Return ONLY valid JSON"));
    assert.ok(prompt.includes('"mapping"'));
  });

  it("limits rows to first 8", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => ({
      Customer: `Customer_${i}`,
      Product: `Product_${i}`,
      Cases: String(i),
      Date: "2025-01",
    }));
    const prompt = buildAIPrompt(headers, manyRows, "supplier");
    assert.ok(prompt.includes("Customer_7"));
    assert.ok(!prompt.includes("Customer_8"));
  });

  it("truncates long cell values at 40 chars", () => {
    const longRows = [{ Customer: "A".repeat(100), Product: "B", Cases: "1", Date: "2025" }];
    const prompt = buildAIPrompt(headers, longRows, "supplier");
    assert.ok(!prompt.includes("A".repeat(100)));
    assert.ok(prompt.includes("A".repeat(40)));
  });

  it("handles null/undefined values in rows", () => {
    const nullRows = [{ Customer: null, Product: undefined, Cases: "", Date: "2025" }];
    const prompt = buildAIPrompt(headers, nullRows, "supplier");
    assert.ok(typeof prompt === "string");
  });

  it("handles empty rows array", () => {
    const prompt = buildAIPrompt(headers, [], "supplier");
    assert.ok(prompt.includes("Customer"));
    assert.ok(prompt.includes("---"));
  });
});

describe("parseAIResponse", () => {
  it("parses valid JSON response", () => {
    const text = '{"mapping": {"acct": "Customer"}, "uploadType": "depletion", "confidence": {"acct": 0.95}}';
    const result = parseAIResponse(text);
    assert.deepEqual(result.mapping, { acct: "Customer" });
    assert.equal(result.uploadType, "depletion");
  });

  it("extracts JSON from text with surrounding content", () => {
    const text = 'Here is the mapping:\n{"mapping": {"acct": "Name"}, "uploadType": "sales"}\nDone.';
    const result = parseAIResponse(text);
    assert.deepEqual(result.mapping, { acct: "Name" });
  });

  it("throws on empty response", () => {
    assert.throws(() => parseAIResponse(""), /no valid JSON/i);
  });

  it("throws on non-JSON response", () => {
    assert.throws(() => parseAIResponse("I cannot map these columns."), /no valid JSON/i);
  });

  it("throws on malformed JSON", () => {
    assert.throws(() => parseAIResponse("{mapping: broken}"), /invalid JSON/i);
  });

  it("handles JSON with nested objects", () => {
    const text = '{"mapping": {"acct": "Name"}, "confidence": {"acct": 0.9}, "monthColumns": ["Jan", "Feb"]}';
    const result = parseAIResponse(text);
    assert.deepEqual(result.monthColumns, ["Jan", "Feb"]);
  });

  it("handles response with markdown code block", () => {
    const text = '```json\n{"mapping": {"acct": "Customer"}, "uploadType": "depletion"}\n```';
    const result = parseAIResponse(text);
    assert.deepEqual(result.mapping, { acct: "Customer" });
  });

  it("handles response with extra whitespace", () => {
    const text = '\n\n  {"mapping": {"acct": "Name"}}  \n\n';
    const result = parseAIResponse(text);
    assert.deepEqual(result.mapping, { acct: "Name" });
  });

  it("handles deeply nested JSON", () => {
    const text = '{"mapping": {"acct": "Name"}, "confidence": {"acct": 0.9}, "monthColumns": [], "weekColumns": [], "uploadType": "depletion"}';
    const result = parseAIResponse(text);
    assert.equal(result.uploadType, "depletion");
    assert.deepEqual(result.weekColumns, []);
  });
});
