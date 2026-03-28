/**
 * Tests for transformData — depletion, QuickBooks, purchase,
 * inventory, and pipeline transforms.
 */
import { describe, it, expect } from "vitest";
import {
  transformDepletion,
  transformQuickBooks,
  transformPurchases,
  transformInventory,
  transformPipeline,
  generateSummary,
  transformAll,
} from "../utils/transformData";
import {
  DEPLETION_HEADERS, DEPLETION_ROWS,
  PURCHASE_ROWS,
  INVENTORY_ROWS,
  PIPELINE_ROWS,
  UNICODE_ROWS,
} from "./fixtures/sampleData";

// ─── Depletion Transform ─────────────────────────────────────

describe("transformDepletion", () => {
  const mapping = {
    acct: "Account Name",
    dist: "Distributor",
    st: "State",
    ch: "Channel",
    sku: "Product",
    _monthColumns: ["Nov", "Dec", "Jan", "Feb"],
  };

  it("produces distributor scorecard grouped by distributor+state", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    expect(result.distScorecard).toBeDefined();
    expect(result.distScorecard.length).toBeGreaterThan(0);

    // Should have 3 distributors: Breakthru NY, Southern CA, Republic CO
    expect(result.distScorecard.length).toBe(3);

    const breakthru = result.distScorecard.find((d) => d.name === "Breakthru Beverage NY");
    expect(breakthru).toBeDefined();
    expect(breakthru.st).toBe("NY");
    // CE is sum of qty field; with month columns mapped, qty is not populated
    // (data flows through month columns instead), so ce may be 0.
    // The weekly array should have data from month columns.
    expect(breakthru.weekly.length).toBeGreaterThan(0);
  });

  it("produces accounts ranked by total volume", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    expect(result.accountsTop).toBeDefined();
    expect(result.accountsTop.length).toBeGreaterThan(0);

    // Accounts should be sorted by total descending
    for (let i = 1; i < result.accountsTop.length; i++) {
      expect(result.accountsTop[i - 1].total).toBeGreaterThanOrEqual(result.accountsTop[i].total);
    }

    // Ranks should be sequential
    result.accountsTop.forEach((a, i) => {
      expect(a.rank).toBe(i + 1);
    });
  });

  it("calculates momentum as percentage string", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    result.distScorecard.forEach((d) => {
      expect(d.momentum).toMatch(/^[+-]\d+%$/);
    });
  });

  it("calculates consistency between 0 and 1", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    result.distScorecard.forEach((d) => {
      expect(d.con).toBeGreaterThanOrEqual(0);
      expect(d.con).toBeLessThanOrEqual(1);
    });
  });

  it("produces account concentration stats", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    expect(result.acctConcentration).toBeDefined();
    expect(result.acctConcentration.total).toBe(result.accountsTop.length);
    expect(result.acctConcentration.top10).toBeGreaterThanOrEqual(0);
    expect(result.acctConcentration.top10).toBeLessThanOrEqual(100);
  });

  it("produces new wins from small accounts", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);
    expect(result.newWins).toBeDefined();
    expect(Array.isArray(result.newWins)).toBe(true);
  });

  it("produces placement summary and re-engagement data", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    expect(result.placementSummary).toBeDefined();
    expect(result.placementSummary.length).toBeGreaterThan(0);

    expect(result.reEngagementData).toBeDefined();
    expect(result.reEngagementData.length).toBeGreaterThan(0);
  });

  it("handles unicode characters in account names", () => {
    const result = transformDepletion(UNICODE_ROWS, mapping);
    expect(result.accountsTop).toBeDefined();

    const cafe = result.accountsTop.find((a) => a.acct.includes("Caf"));
    expect(cafe).toBeDefined();
  });

  it("handles empty input gracefully", () => {
    const result = transformDepletion([], mapping);
    expect(result.distScorecard).toEqual([]);
    expect(result.accountsTop).toEqual([]);
  });

  it("outputs positional m0/m1/m2/m3 fields instead of nov/dec/jan/feb", () => {
    const result = transformDepletion(DEPLETION_ROWS, mapping);

    // accountsTop rows should have m0-m3, not nov/dec/jan/feb
    const first = result.accountsTop[0];
    expect(first).toBeDefined();
    expect(first.m0).toBeDefined();
    expect(first.m1).toBeDefined();
    expect(first.m2).toBeDefined();
    expect(first.m3).toBeDefined();
    expect(first.nov).toBeUndefined();
    expect(first.dec).toBeUndefined();
    expect(first.jan).toBeUndefined();
    expect(first.feb).toBeUndefined();

    // distScorecard uses ce/momentum/con, not month fields
    const dist = result.distScorecard[0];
    expect(dist.ce).toBeDefined();
    expect(dist.nov).toBeUndefined();
  });

  it("supports variable month column count (6 months)", () => {
    const mapping6 = {
      acct: "Account Name",
      dist: "Distributor",
      st: "State",
      ch: "Channel",
      sku: "Product",
      _monthColumns: ["M1", "M2", "M3", "M4", "M5", "M6"],
    };

    const rows6 = DEPLETION_ROWS.map((r) => ({
      ...r,
      M1: r.Nov || 0,
      M2: r.Dec || 0,
      M3: r.Jan || 0,
      M4: r.Feb || 0,
      M5: "5",
      M6: "10",
    }));

    const result = transformDepletion(rows6, mapping6);
    const first = result.accountsTop[0];
    expect(first.m0).toBeDefined();
    expect(first.m4).toBeDefined();
    expect(first.m5).toBeDefined();
    // Total should include all 6 months
    const monthSum = first.m0 + first.m1 + first.m2 + first.m3 + first.m4 + first.m5;
    expect(first.total).toBe(monthSum);
  });
});

// ─── QuickBooks Transform ────────────────────────────────────

describe("transformQuickBooks", () => {
  // Simulate parsed QB data (after processGroupedRows)
  const qbRows = [
    { Customer: "Coastal Wine Bar", Type: "Invoice", Date: "10/15/2025", Num: "1001", "Product/Service": "Pinot Noir Reserve", Quantity: "5", Amount: "150.00" },
    { Customer: "Coastal Wine Bar", Type: "Invoice", Date: "11/20/2025", Num: "1015", "Product/Service": "Chardonnay Estate", Quantity: "3", Amount: "75.00" },
    { Customer: "Coastal Wine Bar", Type: "Invoice", Date: "01/10/2026", Num: "1042", "Product/Service": "Pinot Noir Reserve", Quantity: "8", Amount: "240.00" },
    { Customer: "Harbor Restaurant Group", Type: "Invoice", Date: "10/22/2025", Num: "1005", "Product/Service": "Sauvignon Blanc", Quantity: "10", Amount: "200.00" },
    { Customer: "Harbor Restaurant Group", Type: "Invoice", Date: "12/05/2025", Num: "1028", "Product/Service": "Pinot Noir Reserve", Quantity: "6", Amount: "180.00" },
    { Customer: "Harbor Restaurant Group", Type: "Invoice", Date: "01/15/2026", Num: "1045", "Product/Service": "Sauvignon Blanc", Quantity: "12", Amount: "240.00" },
    { Customer: "Harbor Restaurant Group", Type: "Invoice", Date: "02/01/2026", Num: "1060", "Product/Service": "Chardonnay Estate", Quantity: "4", Amount: "100.00" },
    { Customer: "Sunset Liquors", Type: "Invoice", Date: "11/01/2025", Num: "1008", "Product/Service": "Pinot Noir Reserve", Quantity: "2", Amount: "60.00" },
  ];

  const mapping = { acct: "Customer", revenue: "Amount", date: "Date", sku: "Product/Service", qty: "Quantity" };

  it("aggregates revenue by customer", () => {
    const result = transformQuickBooks(qbRows, mapping);

    expect(result.accountsTop).toBeDefined();
    expect(result.accountsTop.length).toBe(3);

    const harbor = result.accountsTop.find((a) => a.acct === "Harbor Restaurant Group");
    expect(harbor).toBeDefined();
    expect(harbor.total).toBe(720);

    const coastal = result.accountsTop.find((a) => a.acct === "Coastal Wine Bar");
    expect(coastal.total).toBe(465);
  });

  it("assigns pipeline stages based on revenue", () => {
    const result = transformQuickBooks(qbRows, mapping);

    expect(result.pipelineAccounts).toBeDefined();

    const harbor = result.pipelineAccounts.find((p) => p.acct === "Harbor Restaurant Group");
    // Revenue $720 < $1000, so stage should be "Identified"
    expect(harbor.stage).toBe("Identified");
  });

  it("calculates reorder data with purchase cycles", () => {
    const result = transformQuickBooks(qbRows, mapping);

    expect(result.reorderData).toBeDefined();
    expect(result.reorderData.length).toBeGreaterThan(0);

    result.reorderData.forEach((r) => {
      expect(r.cycle).toBeGreaterThan(0);
      expect(r.priority).toBeGreaterThanOrEqual(0);
      expect(r.priority).toBeLessThanOrEqual(100);
    });
  });

  it("ranks accounts by total descending", () => {
    const result = transformQuickBooks(qbRows, mapping);

    for (let i = 1; i < result.accountsTop.length; i++) {
      expect(result.accountsTop[i - 1].total).toBeGreaterThanOrEqual(result.accountsTop[i].total);
    }
  });

  it("filters out rows with zero revenue", () => {
    const rowsWithZero = [
      ...qbRows,
      { Customer: "Zero Co", Type: "Invoice", Date: "01/01/2026", Num: "9999", "Product/Service": "Tax Item", Quantity: "0", Amount: "0" },
    ];
    const result = transformQuickBooks(rowsWithZero, mapping);

    const zero = result.accountsTop.find((a) => a.acct === "Zero Co");
    expect(zero).toBeUndefined();
  });

  // ── Revenue view output ──

  it("produces revenueByChannel from QB data", () => {
    const result = transformQuickBooks(qbRows, mapping);
    expect(result.revenueByChannel).toBeDefined();
    expect(result.revenueByChannel.length).toBeGreaterThan(0);
    const totalRevenue = result.revenueByChannel.reduce((s, ch) => s + ch.total, 0);
    expect(totalRevenue).toBeCloseTo(1245, 0);
  });

  it("produces revenueByProduct from QB data", () => {
    const result = transformQuickBooks(qbRows, mapping);
    expect(result.revenueByProduct).toBeDefined();
    expect(result.revenueByProduct.length).toBe(3);
    const pinot = result.revenueByProduct.find((p) => p.sku.includes("Pinot"));
    expect(pinot).toBeDefined();
    expect(pinot.total).toBeCloseTo(630, 0);
  });

  it("produces revenueSummary from QB data", () => {
    const result = transformQuickBooks(qbRows, mapping);
    expect(result.revenueSummary).toBeDefined();
    expect(result.revenueSummary.topSku).toContain("Pinot");
    expect(result.revenueSummary.channelCount).toBeGreaterThan(0);
    expect(result.revenueSummary.monthKeys.length).toBeGreaterThan(0);
  });

  it("finds revenue from 'Total' column when no 'Amount' column exists", () => {
    const totalColRows = [
      { Customer: "Coastal Wine Bar", Date: "10/15/2025", "Product/Service": "Pinot Noir", Quantity: "5", Total: "150.00" },
      { Customer: "Harbor Group", Date: "11/20/2025", "Product/Service": "Chardonnay", Quantity: "3", Total: "75.00" },
    ];
    const result = transformQuickBooks(totalColRows, {});
    expect(result.accountsTop.length).toBe(2);
    expect(result.accountsTop[0].total).toBe(150);
    expect(result.revenueByChannel.length).toBeGreaterThan(0);
  });

  it("derives revenue from Debit/Credit columns in transaction detail format", () => {
    const debitCreditRows = [
      { Name: "Coastal Wine Bar", Date: "10/15/2025", "Memo/Description": "Pinot Noir", Debit: "", Credit: "150.00" },
      { Name: "Coastal Wine Bar", Date: "11/20/2025", "Memo/Description": "Chardonnay", Debit: "25.00", Credit: "" },
      { Name: "Harbor Group", Date: "10/22/2025", "Memo/Description": "Sauvignon Blanc", Debit: "", Credit: "200.00" },
    ];
    const result = transformQuickBooks(debitCreditRows, {});

    const coastal = result.accountsTop.find((a) => a.acct === "Coastal Wine Bar");
    expect(coastal).toBeDefined();
    expect(coastal.total).toBe(125); // 150 credit - 25 debit

    const harbor = result.accountsTop.find((a) => a.acct === "Harbor Group");
    expect(harbor.total).toBe(200);

    expect(result.revenueByChannel.length).toBeGreaterThan(0);
    const totalRev = result.revenueByChannel.reduce((s, ch) => s + ch.total, 0);
    expect(totalRev).toBeCloseTo(325, 0);
  });
});

// ─── Purchase Transform ──────────────────────────────────────

describe("transformPurchases", () => {
  const mapping = {
    acct: "Customer",
    dist: "Distributor",
    st: "State",
    ch: "Channel",
    sku: "SKU",
    qty: "Qty",
    date: "Order Date",
  };

  it("calculates reorder cycles from purchase dates", () => {
    const result = transformPurchases(PURCHASE_ROWS, mapping);

    expect(result.reorderData).toBeDefined();
    expect(result.reorderData.length).toBeGreaterThan(0);

    // The Wine Cellar has 3 purchases ~35 days apart
    const twc = result.reorderData.find((r) => r.acct === "The Wine Cellar");
    expect(twc).toBeDefined();
    expect(twc.purch).toBe(3);
    expect(twc.cycle).toBeGreaterThan(20);
    expect(twc.cycle).toBeLessThan(60);
  });

  it("assigns priority based on days since last order vs cycle", () => {
    const result = transformPurchases(PURCHASE_ROWS, mapping);

    result.reorderData.forEach((r) => {
      expect(r.priority).toBeGreaterThanOrEqual(0);
      expect(r.priority).toBeLessThanOrEqual(100);
    });
  });

  it("sorts by priority descending", () => {
    const result = transformPurchases(PURCHASE_ROWS, mapping);

    for (let i = 1; i < result.reorderData.length; i++) {
      expect(result.reorderData[i - 1].priority).toBeGreaterThanOrEqual(result.reorderData[i].priority);
    }
  });
});

// ─── Inventory Transform ─────────────────────────────────────

describe("transformInventory", () => {
  const mapping = {
    st: "State",
    dist: "Distributor",
    sku: "Product",
    oh: "On Hand",
    doh: "Days on Hand",
  };

  it("groups inventory by state", () => {
    const result = transformInventory(INVENTORY_ROWS, mapping);

    expect(result.inventoryData).toBeDefined();
    // NY, CA, CO
    expect(result.inventoryData.length).toBe(3);
  });

  it("classifies inventory status by DOH", () => {
    const result = transformInventory(INVENTORY_ROWS, mapping);

    const co = result.inventoryData.find((i) => i.st === "CO");
    expect(co.status).toBe("Overstocked"); // DOH=120

    const ca = result.inventoryData.find((i) => i.st === "CA");
    // CA avg DOH = (60+7)/2 = 33.5 → Healthy
    expect(ca.status).toBe("Healthy");
  });

  it("produces distributor health data", () => {
    const result = transformInventory(INVENTORY_ROWS, mapping);

    expect(result.distHealth).toBeDefined();
    expect(result.distHealth.length).toBeGreaterThan(0);
  });
});

// ─── Pipeline Transform ──────────────────────────────────────

describe("transformPipeline", () => {
  const mapping = {
    acct: "Account",
    stage: "Stage",
    estValue: "Est Value",
    owner: "Owner",
    st: "State",
    date: "Date",
  };

  it("maps pipeline accounts with stages", () => {
    const result = transformPipeline(PIPELINE_ROWS, mapping);

    expect(result.pipelineAccounts).toBeDefined();
    expect(result.pipelineAccounts.length).toBe(3);

    const grand = result.pipelineAccounts.find((p) => p.acct === "Grand Hotel Wine Program");
    expect(grand.stage).toBe("Proposal");
    expect(grand.estValue).toBe(15000);
    expect(grand.owner).toBe("Jane Smith");
  });
});

// ─── generateSummary ─────────────────────────────────────────

describe("generateSummary", () => {
  it("generates QuickBooks summary with account count and revenue", () => {
    const datasets = {
      accountsTop: [
        { acct: "Co A", total: 1000 },
        { acct: "Co B", total: 500 },
      ],
    };
    const text = generateSummary("quickbooks", datasets);
    expect(text).toContain("2");
    expect(text).toContain("QuickBooks");
  });

  it("generates depletion summary with distributor and account counts", () => {
    const datasets = {
      distScorecard: [{ name: "Dist A", ce: 100, momentum: "+5%" }],
      accountsTop: [{ acct: "Acct A" }, { acct: "Acct B" }],
    };
    const text = generateSummary("depletion", datasets);
    expect(text).toContain("1"); // 1 distributor
    expect(text).toContain("2"); // 2 accounts
  });

  it("uses distributor role terminology", () => {
    const datasets = {
      accountsTop: [{ acct: "Store A", total: 500 }],
    };
    const text = generateSummary("quickbooks", datasets, "distributor");
    expect(text).toContain("store");
  });
});

// ─── transformAll dispatch ───────────────────────────────────

describe("transformAll", () => {
  it("dispatches to transformDepletion for depletion type", () => {
    const mapping = {
      acct: "Account Name", dist: "Distributor", st: "State",
      _monthColumns: ["Nov", "Dec", "Jan", "Feb"],
    };
    const result = transformAll(DEPLETION_ROWS, mapping, { type: "depletion" });
    expect(result.type).toBe("depletion");
    expect(result.distScorecard).toBeDefined();
  });

  it("dispatches to transformInventory for inventory type", () => {
    const mapping = { st: "State", dist: "Distributor", oh: "On Hand", doh: "Days on Hand", sku: "Product" };
    const result = transformAll(INVENTORY_ROWS, mapping, { type: "inventory" });
    expect(result.type).toBe("inventory");
    expect(result.inventoryData).toBeDefined();
  });

  it("falls back to depletion if acct + qty are mapped", () => {
    const mapping = { acct: "Account Name", qty: "Nov" };
    const result = transformAll(DEPLETION_ROWS, mapping, { type: "unknown" });
    expect(result.type).toBe("depletion");
  });
});
