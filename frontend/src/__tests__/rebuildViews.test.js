/**
 * Tests for rebuildViews logic — identity mapping + time-series expansion.
 *
 * The prepareNormalizedForTransform helper and the full rebuild pipeline
 * are tested here with pure functions (no Firestore dependency).
 * Integration tests with the emulator are in TODO-026.
 */
import { describe, it, expect } from "vitest";
import { transformAll } from "../../../packages/pipeline/src/transformData.js";
import { normalizeRows } from "../../../packages/pipeline/src/normalize.js";

// ─── Replicate the helper from functions/index.js ───────────
// (This is the same function used in rebuildViews Cloud Function)
function prepareNormalizedForTransform(normalizedRows) {
  let monthCount = 0;
  let weekCount = 0;
  for (const row of normalizedRows) {
    if (row._months) monthCount = Math.max(monthCount, row._months.length);
    if (row._weeks) weekCount = Math.max(weekCount, row._weeks.length);
  }

  const monthCols = Array.from({ length: monthCount }, (_, i) => `_m${i}`);
  const weekCols = Array.from({ length: weekCount }, (_, i) => `_w${i}`);

  const expanded = normalizedRows.map((row) => {
    const out = { ...row };
    if (row._months) {
      row._months.forEach((v, i) => { out[`_m${i}`] = v; });
    }
    if (row._weeks) {
      row._weeks.forEach((v, i) => { out[`_w${i}`] = v; });
    }
    return out;
  });

  const mapping = {
    acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku",
    qty: "qty", date: "date", revenue: "revenue",
    stage: "stage", owner: "owner", estValue: "estValue",
    oh: "oh", doh: "doh", lastOrder: "lastOrder", orderCycle: "orderCycle",
  };
  if (monthCols.length) mapping._monthColumns = monthCols;
  if (weekCols.length) mapping._weekColumns = weekCols;

  return { rows: expanded, mapping };
}

// ─── Tests ──────────────────────────────────────────────────

describe("prepareNormalizedForTransform", () => {
  it("builds identity mapping from normalized rows", () => {
    const rows = [
      { acct: "Co A", dist: "Dist X", st: "NY", qty: 10, revenue: 100 },
    ];
    const { mapping } = prepareNormalizedForTransform(rows);
    expect(mapping.acct).toBe("acct");
    expect(mapping.dist).toBe("dist");
    expect(mapping.qty).toBe("qty");
    expect(mapping._monthColumns).toBeUndefined();
  });

  it("expands _months into indexed columns", () => {
    const rows = [
      { acct: "A", qty: 10, _months: [5, 10, 15] },
      { acct: "B", qty: 20, _months: [8, 12] },
    ];
    const { rows: expanded, mapping } = prepareNormalizedForTransform(rows);

    // Mapping should have month columns
    expect(mapping._monthColumns).toEqual(["_m0", "_m1", "_m2"]);

    // Rows should have indexed columns
    expect(expanded[0]._m0).toBe(5);
    expect(expanded[0]._m1).toBe(10);
    expect(expanded[0]._m2).toBe(15);
    expect(expanded[1]._m0).toBe(8);
    expect(expanded[1]._m1).toBe(12);
    expect(expanded[1]._m2).toBeUndefined();
  });

  it("expands _weeks into indexed columns", () => {
    const rows = [
      { acct: "A", qty: 10, _weeks: [3, 7] },
    ];
    const { rows: expanded, mapping } = prepareNormalizedForTransform(rows);
    expect(mapping._weekColumns).toEqual(["_w0", "_w1"]);
    expect(expanded[0]._w0).toBe(3);
    expect(expanded[0]._w1).toBe(7);
  });

  it("handles rows without time-series data", () => {
    const rows = [
      { acct: "A", qty: 10 },
    ];
    const { rows: expanded, mapping } = prepareNormalizedForTransform(rows);
    expect(mapping._monthColumns).toBeUndefined();
    expect(mapping._weekColumns).toBeUndefined();
    expect(expanded[0].acct).toBe("A");
  });
});

describe("snapshot comparison: normalizeRows → prepareNormalized → transformAll", () => {
  // This is the "2am Friday" test from the eng review:
  // rebuildViews output must match transformAll on the same rows.

  const rawRows = [
    {
      "Account Name": "The Wine Bar",
      Distributor: "Southern Glazer's",
      State: "NY",
      Channel: "On-Premise",
      Product: "Pinot Noir 750ml",
      Cases: "25",
      Date: "2024-03-15",
      Amount: "$1,250.00",
    },
    {
      "Account Name": "Metro Liquors",
      Distributor: "Republic National",
      State: "CA",
      Channel: "Off-Premise",
      Product: "Chardonnay 750ml",
      Cases: "50",
      Date: "2024-04-01",
      Amount: "2500",
    },
    {
      "Account Name": "The Wine Bar",
      Distributor: "Southern Glazer's",
      State: "NY",
      Channel: "On-Premise",
      Product: "Cabernet 750ml",
      Cases: "15",
      Date: "2024-04-10",
      Amount: "$750.00",
    },
  ];

  const directMapping = {
    acct: "Account Name",
    dist: "Distributor",
    st: "State",
    ch: "Channel",
    sku: "Product",
    qty: "Cases",
    date: "Date",
    revenue: "Amount",
  };

  it("rebuild path produces same output as direct transform for depletion", () => {
    // Direct path: transformAll(rawRows, directMapping, "depletion")
    const directResult = transformAll(rawRows, directMapping, "depletion");

    // Rebuild path: normalizeRows → prepareNormalized → transformAll
    const normalized = normalizeRows(rawRows, directMapping);
    const { rows: expanded, mapping: identityMapping } = prepareNormalizedForTransform(normalized);
    const rebuildResult = transformAll(expanded, identityMapping, "depletion");

    // Both should produce the same type
    expect(rebuildResult.type).toBe(directResult.type);

    // Compare key datasets
    expect(rebuildResult.distScorecard).toEqual(directResult.distScorecard);
    expect(rebuildResult.accountsTop).toEqual(directResult.accountsTop);
    expect(rebuildResult.reorderData).toEqual(directResult.reorderData);
    expect(rebuildResult.newWins).toEqual(directResult.newWins);
    expect(rebuildResult.placementSummary).toEqual(directResult.placementSummary);
  });

  it("rebuild path produces same output for quickbooks type", () => {
    const qbRows = [
      { Customer: "Wine Bar", Type: "Invoice", Date: "2024-03-15", "Product/Service": "Pinot", Quantity: "10", Amount: "500" },
      { Customer: "Wine Bar", Type: "Invoice", Date: "2024-04-01", "Product/Service": "Cab", Quantity: "5", Amount: "250" },
      { Customer: "Metro", Type: "Invoice", Date: "2024-03-20", "Product/Service": "Chard", Quantity: "20", Amount: "800" },
    ];
    // QB transform does header-scan fallback (findCol) for unmapped fields.
    // With normalized rows, original column names are gone, so all fields
    // used by the transform MUST be in the mapping. This is correct behavior:
    // the AI mapper always produces a complete mapping.
    const qbMapping = {
      acct: "Customer",
      ch: "Type",
      sku: "Product/Service",
      qty: "Quantity",
      date: "Date",
      revenue: "Amount",
    };

    const directResult = transformAll(qbRows, qbMapping, "quickbooks");
    const normalized = normalizeRows(qbRows, qbMapping);
    const { rows: expanded, mapping: identityMapping } = prepareNormalizedForTransform(normalized);
    const rebuildResult = transformAll(expanded, identityMapping, "quickbooks");

    expect(rebuildResult.type).toBe(directResult.type);
    expect(rebuildResult.accountsTop).toEqual(directResult.accountsTop);
    expect(rebuildResult.pipelineAccounts).toEqual(directResult.pipelineAccounts);
  });
});
