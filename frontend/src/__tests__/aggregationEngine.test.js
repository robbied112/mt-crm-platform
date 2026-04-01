import { describe, it, expect } from "vitest";
import {
  computeSection,
  computeBlueprint,
  buildDataProfile,
  groupByFields,
  applyFilters,
  extractFilterValues,
  AGG_FNS,
} from "../../../packages/pipeline/src/aggregationEngine";

// ─── Sample Data ────────────────────────────────────────────────────────────

const SAMPLE_ROWS = [
  { acct: "Total Wine", dist: "SGW", st: "CA", ch: "Off-Premise", sku: "Cab Sauv", qty: 100, revenue: 2000 },
  { acct: "Total Wine", dist: "SGW", st: "CA", ch: "Off-Premise", sku: "Pinot Noir", qty: 50, revenue: 1500 },
  { acct: "BevMo", dist: "SGW", st: "CA", ch: "Off-Premise", sku: "Cab Sauv", qty: 75, revenue: 1500 },
  { acct: "Fig & Olive", dist: "RNDC", st: "TX", ch: "On-Premise", sku: "Cab Sauv", qty: 30, revenue: 900 },
  { acct: "Fig & Olive", dist: "RNDC", st: "TX", ch: "On-Premise", sku: "Rosé", qty: 20, revenue: 400 },
  { acct: "Costco", dist: "Breakthru", st: "FL", ch: "Off-Premise", sku: "Cab Sauv", qty: 200, revenue: 4000 },
];

// ─── Aggregation Functions ──────────────────────────────────────────────────

describe("AGG_FNS", () => {
  it("sum", () => {
    expect(AGG_FNS.sum([10, 20, 30])).toBe(60);
    expect(AGG_FNS.sum([])).toBe(0);
    expect(AGG_FNS.sum(["10", "20", null, ""])).toBe(30);
  });

  it("avg", () => {
    expect(AGG_FNS.avg([10, 20, 30])).toBe(20);
    expect(AGG_FNS.avg([])).toBe(0);
  });

  it("min/max", () => {
    expect(AGG_FNS.min([10, 5, 20])).toBe(5);
    expect(AGG_FNS.max([10, 5, 20])).toBe(20);
    expect(AGG_FNS.min([])).toBe(0);
    expect(AGG_FNS.max([])).toBe(0);
  });

  it("count/countDistinct", () => {
    expect(AGG_FNS.count(["a", "b", "a"])).toBe(3);
    expect(AGG_FNS.countDistinct(["a", "b", "a"])).toBe(2);
    expect(AGG_FNS.countDistinct(["a", null, "", "b"])).toBe(2);
  });

  it("median", () => {
    expect(AGG_FNS.median([1, 3, 5])).toBe(3);
    expect(AGG_FNS.median([1, 2, 3, 4])).toBe(2.5);
    expect(AGG_FNS.median([])).toBe(0);
  });
});

// ─── groupByFields ──────────────────────────────────────────────────────────

describe("groupByFields", () => {
  it("groups by single field", () => {
    const groups = groupByFields(SAMPLE_ROWS, ["dist"]);
    expect(groups.size).toBe(3);
    expect(groups.get("SGW").length).toBe(3);
    expect(groups.get("RNDC").length).toBe(2);
    expect(groups.get("Breakthru").length).toBe(1);
  });

  it("groups by multiple fields", () => {
    const groups = groupByFields(SAMPLE_ROWS, ["dist", "st"]);
    expect(groups.size).toBe(3);
  });

  it("returns all rows in one group when no groupBy", () => {
    const groups = groupByFields(SAMPLE_ROWS, []);
    expect(groups.size).toBe(1);
    expect(groups.get("__all__").length).toBe(6);
  });
});

// ─── applyFilters ───────────────────────────────────────────────────────────

describe("applyFilters", () => {
  it("filters with eq", () => {
    const result = applyFilters(SAMPLE_ROWS, [{ field: "st", op: "eq", value: "CA" }]);
    expect(result.length).toBe(3);
  });

  it("filters with in", () => {
    const result = applyFilters(SAMPLE_ROWS, [{ field: "st", op: "in", value: ["CA", "TX"] }]);
    expect(result.length).toBe(5);
  });

  it("filters with gt", () => {
    const result = applyFilters(SAMPLE_ROWS, [{ field: "qty", op: "gt", value: 50 }]);
    expect(result.length).toBe(3); // 100, 75, 200
  });

  it("combines multiple filters (AND)", () => {
    const result = applyFilters(SAMPLE_ROWS, [
      { field: "st", op: "eq", value: "CA" },
      { field: "qty", op: "gte", value: 75 },
    ]);
    expect(result.length).toBe(2); // Total Wine Cab (100) + BevMo Cab (75)
  });

  it("contains filter", () => {
    const result = applyFilters(SAMPLE_ROWS, [{ field: "acct", op: "contains", value: "wine" }]);
    expect(result.length).toBe(2); // Total Wine rows
  });
});

// ─── computeSection ─────────────────────────────────────────────────────────

describe("computeSection", () => {
  const rawDataBySource = { depletion: SAMPLE_ROWS };

  it("computes sum aggregation with groupBy", () => {
    const result = computeSection({
      source: "depletion",
      groupBy: ["dist"],
      aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
      sort: { field: "totalCE", dir: "desc" },
    }, rawDataBySource);

    expect(result.length).toBe(3);
    // Sort desc: SGW (225) > Breakthru (200) > RNDC (50)
    expect(result[0].dist).toBe("SGW");
    expect(result[0].totalCE).toBe(225);
    expect(result[1].dist).toBe("Breakthru");
    expect(result[1].totalCE).toBe(200);
  });

  it("computes multiple aggregations", () => {
    const result = computeSection({
      source: "depletion",
      groupBy: ["dist"],
      aggregation: [
        { fn: "sum", field: "qty", as: "totalCE" },
        { fn: "countDistinct", field: "acct", as: "accounts" },
      ],
    }, rawDataBySource);

    const sgw = result.find((r) => r.dist === "SGW");
    expect(sgw.totalCE).toBe(225);
    expect(sgw.accounts).toBe(2);
  });

  it("applies limit", () => {
    const result = computeSection({
      source: "depletion",
      groupBy: ["acct"],
      aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
      sort: { field: "totalCE", dir: "desc" },
      limit: 2,
    }, rawDataBySource);

    expect(result.length).toBe(2);
  });

  it("applies filter before aggregation", () => {
    const result = computeSection({
      source: "depletion",
      groupBy: ["dist"],
      aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
      filter: [{ field: "st", op: "eq", value: "CA" }],
    }, rawDataBySource);

    expect(result.length).toBe(1);
    expect(result[0].dist).toBe("SGW");
    expect(result[0].totalCE).toBe(225);
  });

  it("returns raw rows when no aggregation", () => {
    const result = computeSection({
      source: "depletion",
      sort: { field: "qty", dir: "desc" },
      limit: 3,
    }, rawDataBySource);

    expect(result.length).toBe(3);
    expect(result[0].qty).toBe(200);
  });

  it("returns empty array for missing source", () => {
    const result = computeSection({
      source: "inventory",
      groupBy: ["dist"],
      aggregation: [{ fn: "sum", field: "oh", as: "totalOH" }],
    }, rawDataBySource);

    expect(result).toEqual([]);
  });
});

// ─── computeBlueprint ───────────────────────────────────────────────────────

describe("computeBlueprint", () => {
  it("computes all tabs and sections", () => {
    const blueprint = {
      tabs: [
        {
          id: "tab1",
          label: "Overview",
          sections: [
            {
              id: "kpis",
              type: "kpiRow",
              items: [
                { label: "Total CE", aggregation: { fn: "sum", field: "qty", source: "depletion" } },
                { label: "Accounts", aggregation: { fn: "countDistinct", field: "acct", source: "depletion" } },
              ],
            },
            {
              id: "chart1",
              type: "chart",
              dataSource: {
                source: "depletion",
                groupBy: ["dist"],
                aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
                sort: { field: "totalCE", dir: "desc" },
              },
            },
          ],
        },
      ],
    };

    const result = computeBlueprint(blueprint, { depletion: SAMPLE_ROWS });

    expect(result.tab1).toBeDefined();
    expect(result.tab1.sections.kpis).toHaveLength(2);
    expect(result.tab1.sections.kpis[0].label).toBe("Total CE");
    expect(result.tab1.sections.kpis[0].value).toBe(475);
    expect(result.tab1.sections.kpis[1].value).toBe(4); // 4 unique accounts
    expect(result.tab1.sections.chart1).toHaveLength(3);
  });
});

// ─── buildDataProfile ───────────────────────────────────────────────────────

describe("buildDataProfile", () => {
  it("builds column statistics", () => {
    const profile = buildDataProfile([{
      fileName: "test.csv",
      fileType: "depletion_report",
      headers: ["acct", "qty", "st"],
      rows: SAMPLE_ROWS,
    }]);

    expect(profile.imports.length).toBe(1);
    expect(profile.imports[0].rowCount).toBe(6);

    const qtyCol = profile.imports[0].columns.qty;
    expect(qtyCol.dataType).toBe("number");
    expect(qtyCol.min).toBe(20);
    expect(qtyCol.max).toBe(200);

    const acctCol = profile.imports[0].columns.acct;
    expect(acctCol.dataType).toBe("string");
    expect(acctCol.cardinality).toBe(4);
  });

  it("detects cross-file join keys", () => {
    // Need many rows so cardinality < 30% of total rows to trigger join detection
    const manyRows = [];
    for (let i = 0; i < 20; i++) {
      manyRows.push({ acct: `Acct ${i}`, dist: i < 10 ? "SGW" : "RNDC", qty: 10 + i });
    }
    const profile = buildDataProfile([
      {
        fileName: "depletions.csv",
        fileType: "depletion",
        headers: ["acct", "dist", "qty"],
        rows: manyRows,
      },
      {
        fileName: "inventory.csv",
        fileType: "inventory",
        headers: ["dist", "oh"],
        rows: [
          { dist: "SGW", oh: 500 },
          { dist: "RNDC", oh: 300 },
          { dist: "SGW", oh: 100 },
          { dist: "RNDC", oh: 200 },
          { dist: "SGW", oh: 150 },
          { dist: "RNDC", oh: 250 },
          { dist: "SGW", oh: 180 },
          { dist: "RNDC", oh: 220 },
        ],
      },
    ]);

    expect(profile.crossFileJoins.length).toBeGreaterThan(0);
    const distJoin = profile.crossFileJoins.find((j) => j.files.length === 2);
    expect(distJoin).toBeDefined();
  });
});

// ─── _all fallback ──────────────────────────────────────────────────────────

describe("_all fallback", () => {
  it("falls back to _all pool when requested source has no rows", () => {
    const rawDataBySource = {
      depletion: [],
      _all: SAMPLE_ROWS,
    };

    const result = computeSection({
      source: "depletion",
      groupBy: ["dist"],
      aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
    }, rawDataBySource);

    expect(result.length).toBe(3);
    expect(result.find((r) => r.dist === "SGW").totalCE).toBe(225);
  });

  it("tracks fallbackSections in computeBlueprint when _all is used", () => {
    const blueprint = {
      tabs: [{
        id: "tab1",
        sections: [{
          id: "chart1",
          type: "chart",
          dataSource: {
            source: "inventory",
            groupBy: ["dist"],
            aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
          },
        }],
      }],
    };

    const result = computeBlueprint(blueprint, { _all: SAMPLE_ROWS });
    expect(result.tab1.fallbackSections).toContain("chart1");
    expect(result.tab1.sections.chart1.length).toBe(3);
  });

  it("marks KPI items as approximate when using _all fallback", () => {
    const blueprint = {
      tabs: [{
        id: "tab1",
        sections: [{
          id: "kpis",
          type: "kpiRow",
          items: [
            { label: "Total CE", aggregation: { fn: "sum", field: "qty", source: "inventory" } },
          ],
        }],
      }],
    };

    const result = computeBlueprint(blueprint, { _all: SAMPLE_ROWS });
    expect(result.tab1.sections.kpis[0].approximate).toBe(true);
    expect(result.tab1.sections.kpis[0].value).toBe(475);
    expect(result.tab1.fallbackSections).toContain("kpis");
  });

  it("does not mark fallback when source rows exist", () => {
    const blueprint = {
      tabs: [{
        id: "tab1",
        sections: [{
          id: "chart1",
          type: "chart",
          dataSource: {
            source: "depletion",
            groupBy: ["dist"],
            aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
          },
        }],
      }],
    };

    const result = computeBlueprint(blueprint, { depletion: SAMPLE_ROWS, _all: SAMPLE_ROWS });
    expect(result.tab1.fallbackSections).toEqual([]);
  });
});

// ─── resolveField / buildFieldMap ───────────────────────────────────────────

describe("case-insensitive field resolution", () => {
  it("resolves fields with different casing", () => {
    const rows = [{ Account: "Total Wine", QTY: 100 }];
    const result = computeSection({
      source: "depletion",
      groupBy: ["account"],
      aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
    }, { depletion: rows });

    expect(result.length).toBe(1);
    expect(result[0].Account).toBe("Total Wine");
    expect(result[0].totalCE).toBe(100);
  });

  it("handles single-object filter with field resolution", () => {
    const rows = [
      { Account: "Total Wine", State: "CA", Qty: 100 },
      { Account: "BevMo", State: "TX", Qty: 50 },
    ];
    const result = computeSection({
      source: "depletion",
      filter: { field: "state", op: "eq", value: "CA" },
    }, { depletion: rows });

    expect(result.length).toBe(1);
    expect(result[0].Account).toBe("Total Wine");
  });
});

// ─── grid sub-sections ──────────────────────────────────────────────────────

describe("grid sub-section fallback tracking", () => {
  it("tracks fallback for grid sub-sections using _all", () => {
    const blueprint = {
      tabs: [{
        id: "tab1",
        sections: [{
          id: "grid1",
          type: "grid",
          sections: [{
            id: "sub1",
            dataSource: {
              source: "inventory",
              groupBy: ["dist"],
              aggregation: [{ fn: "sum", field: "qty", as: "totalCE" }],
            },
          }],
        }],
      }],
    };

    const result = computeBlueprint(blueprint, { _all: SAMPLE_ROWS });
    expect(result.tab1.fallbackSections).toContain("sub1");
    expect(result.tab1.sections.sub1.length).toBe(3);
  });
});

// ─── extractFilterValues ────────────────────────────────────────────────────

describe("extractFilterValues", () => {
  it("extracts unique sorted values", () => {
    const values = extractFilterValues(
      { sourceColumn: "st" },
      { depletion: SAMPLE_ROWS }
    );

    expect(values).toEqual(["CA", "FL", "TX"]);
  });
});
