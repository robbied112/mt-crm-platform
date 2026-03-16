import { describe, it, expect } from "vitest";
import { transformBillback } from "../utils/transformBillback";

const mapping = {
  wine: "Wine",
  producer: "Producer",
  dist: "Distributor",
  amount: "Amount",
  qty: "Cases",
  date: "Date",
  type: "Type",
  invoiceNo: "Invoice",
};

function row(overrides = {}) {
  return {
    Wine: "Chateau Margaux 2018",
    Producer: "Chateau Margaux",
    Distributor: "Southern Glazer's",
    Amount: "1500",
    Cases: "10",
    Date: "2024-01-15",
    Type: "depletion allowance",
    Invoice: "BB-001",
    ...overrides,
  };
}

describe("transformBillback", () => {
  it("transforms a single row correctly", () => {
    const result = transformBillback([row()], mapping);
    expect(result.spendByWine).toHaveLength(1);
    expect(result.spendByDistributor).toHaveLength(1);
    expect(result.billbackSummary.totalSpend).toBe(1500);
    expect(result.billbackSummary.totalBillbacks).toBe(1);
    expect(result.spendByWine[0].wine).toBe("Chateau Margaux 2018");
    expect(result.spendByWine[0].producer).toBe("Chateau Margaux");
  });

  it("groups multiple rows by wine and sorts by totalSpend descending", () => {
    const rows = [
      row({ Wine: "Wine A", Amount: "500" }),
      row({ Wine: "Wine B", Amount: "2000" }),
      row({ Wine: "Wine A", Amount: "300" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine).toHaveLength(2);
    expect(result.spendByWine[0].wine).toBe("Wine B");
    expect(result.spendByWine[0].totalSpend).toBe(2000);
    expect(result.spendByWine[1].wine).toBe("Wine A");
    expect(result.spendByWine[1].totalSpend).toBe(800);
  });

  it("groups by distributor correctly", () => {
    const rows = [
      row({ Distributor: "Dist A", Amount: "100" }),
      row({ Distributor: "Dist B", Amount: "200" }),
      row({ Distributor: "Dist A", Amount: "150" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByDistributor).toHaveLength(2);
    expect(result.spendByDistributor[0].dist).toBe("Dist A");
    expect(result.spendByDistributor[0].totalSpend).toBe(250);
  });

  it("aggregates same wine from different distributors into one spendByWine entry", () => {
    const rows = [
      row({ Wine: "Opus One 2019", Distributor: "Southern", Amount: "500" }),
      row({ Wine: "Opus One 2019", Distributor: "RNDC", Amount: "700" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine).toHaveLength(1);
    expect(result.spendByWine[0].totalSpend).toBe(1200);
    expect(result.spendByWine[0].distributors).toContain("Southern");
    expect(result.spendByWine[0].distributors).toContain("RNDC");
  });

  it("calculates spendPerCase correctly", () => {
    const rows = [row({ Amount: "1000", Cases: "20" })];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].spendPerCase).toBe(50);
  });

  it("handles division by zero when qty is 0", () => {
    const rows = [row({ Amount: "500", Cases: "0" })];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].spendPerCase).toBe(0);
    expect(result.billbackSummary.avgSpendPerCase).toBe(0);
  });

  it("returns empty results for empty rows", () => {
    const result = transformBillback([], mapping);
    expect(result.spendByWine).toEqual([]);
    expect(result.spendByDistributor).toEqual([]);
    expect(result.billbackSummary.totalSpend).toBe(0);
    expect(result.billbackSummary.totalBillbacks).toBe(0);
  });

  it("skips rows with no wine name", () => {
    const rows = [
      row({ Wine: "" }),
      row({ Wine: "Valid Wine" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine).toHaveLength(1);
    expect(result.spendByWine[0].wine).toBe("Valid Wine");
    expect(result.billbackSummary.totalBillbacks).toBe(1);
  });

  it("handles negative amounts (credit memos)", () => {
    const rows = [
      row({ Amount: "1000" }),
      row({ Amount: "-300" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.billbackSummary.totalSpend).toBe(700);
  });

  it("aggregates spend by type in billbackSummary", () => {
    const rows = [
      row({ Type: "depletion allowance", Amount: "500" }),
      row({ Type: "marketing", Amount: "200" }),
      row({ Type: "depletion allowance", Amount: "300" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.billbackSummary.byType["depletion allowance"]).toBe(800);
    expect(result.billbackSummary.byType["marketing"]).toBe(200);
  });

  it("calculates dateRange in billbackSummary", () => {
    const rows = [
      row({ Date: "2024-03-01" }),
      row({ Date: "2024-01-15" }),
      row({ Date: "2024-06-20" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.billbackSummary.dateRange.earliest).toBe("2024-01-15");
    expect(result.billbackSummary.dateRange.latest).toBe("2024-06-20");
  });

  it("calculates billbackSummary totals correctly", () => {
    const rows = [
      row({ Wine: "Wine A", Distributor: "Dist 1", Amount: "100", Cases: "5" }),
      row({ Wine: "Wine B", Distributor: "Dist 2", Amount: "200", Cases: "10" }),
      row({ Wine: "Wine A", Distributor: "Dist 2", Amount: "150", Cases: "5" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.billbackSummary.totalSpend).toBe(450);
    expect(result.billbackSummary.totalBillbacks).toBe(3);
    expect(result.billbackSummary.totalWines).toBe(2);
    expect(result.billbackSummary.totalDistributors).toBe(2);
    expect(result.billbackSummary.avgSpendPerCase).toBe(22.5);
  });

  it("caps wines list on spendByDistributor at 10", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({ Wine: `Wine ${i}`, Distributor: "Same Dist", Amount: "100" })
    );
    const result = transformBillback(rows, mapping);
    expect(result.spendByDistributor[0].wines.length).toBeLessThanOrEqual(10);
  });

  it("picks the most recent date as lastDate", () => {
    const rows = [
      row({ Wine: "Wine A", Date: "2024-01-01" }),
      row({ Wine: "Wine A", Date: "2024-06-15" }),
      row({ Wine: "Wine A", Date: "2024-03-10" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].lastDate).toBe("2024-06-15");
  });

  it("parses dollar amounts with $ signs and commas", () => {
    const rows = [row({ Amount: "$1,500.00" })];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].totalSpend).toBe(1500);
  });

  it("assigns the most common producer for a wine", () => {
    const rows = [
      row({ Wine: "Test Wine", Producer: "Producer A" }),
      row({ Wine: "Test Wine", Producer: "Producer B" }),
      row({ Wine: "Test Wine", Producer: "Producer A" }),
    ];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].producer).toBe("Producer A");
  });

  it("defaults type to 'other' when missing", () => {
    const rows = [row({ Type: "" })];
    const result = transformBillback(rows, mapping);
    expect(result.spendByWine[0].types).toContain("other");
    expect(result.billbackSummary.byType["other"]).toBeDefined();
  });
});
