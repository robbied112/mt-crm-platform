/**
 * Tests for transformInventory — inventory data grouped by distributor
 * with derived rate, dep90, proj, status, and SKU breakdown.
 */
import { describe, it, expect } from "vitest";
// Pipeline uses CJS — require for Node test environment
const { transformInventory } = require("../../../packages/pipeline/src/transformData.js");

const mapping = { dist: "dist", st: "st", oh: "oh", doh: "doh", sku: "sku", acct: "acct" };

function row(overrides) {
  return { acct: "Acct1", dist: "DistA", st: "NY", oh: 100, doh: 45, sku: "SKU-1", ...overrides };
}

describe("transformInventory", () => {
  it("groups by distributor and includes name, st, oh, doh, status", () => {
    const rows = [row(), row({ oh: 200, doh: 30 })];
    const { inventoryData } = transformInventory(rows, mapping);
    expect(inventoryData).toHaveLength(1);
    const d = inventoryData[0];
    expect(d.name).toBe("DistA");
    expect(d.st).toBe("NY");
    expect(d.oh).toBe(300);
    expect(d.doh).toBe(38); // avg of 45 and 30, rounded
    expect(d.status).toBe("Healthy");
  });

  it("computes rate, dep90, proj from oh and doh", () => {
    const rows = [row({ oh: 380, doh: 40 })];
    const { inventoryData } = transformInventory(rows, mapping);
    const d = inventoryData[0];
    // rate = 380 / 40 = 9.5
    expect(d.rate).toBe(9.5);
    // dep90 = 9.5 * 90 = 855
    expect(d.dep90).toBe(855);
    // proj = max(0, 855 - 380) = 475
    expect(d.proj).toBe(475);
  });

  it("sets rate/dep90/proj to 0 when doh is 0", () => {
    const rows = [row({ oh: 100, doh: 0 })];
    const { inventoryData } = transformInventory(rows, mapping);
    const d = inventoryData[0];
    expect(d.rate).toBe(0);
    expect(d.dep90).toBe(0);
    expect(d.proj).toBe(0);
    // doh=0 hits doh<14 first → "Reorder Opportunity" (Dead Stock unreachable in current logic)
    expect(d.status).toBe("Reorder Opportunity");
  });

  it("builds SKU breakdown per distributor", () => {
    const rows = [
      row({ sku: "SKU-1", oh: 100, doh: 30 }),
      row({ sku: "SKU-2", oh: 50, doh: 60 }),
    ];
    const { inventoryData } = transformInventory(rows, mapping);
    const d = inventoryData[0];
    expect(d.skus).toHaveLength(2);
    const sku1 = d.skus.find((s) => s.w === "SKU-1");
    const sku2 = d.skus.find((s) => s.w === "SKU-2");
    expect(sku1.oh).toBe(100);
    expect(sku1.doh).toBe(30);
    expect(sku1.rate).toBeCloseTo(3.33, 1);
    expect(sku1.status).toBe("Healthy");
    expect(sku2.oh).toBe(50);
    expect(sku2.doh).toBe(60);
    expect(sku2.status).toBe("Healthy");
  });

  it("picks most common state for a distributor with multi-state rows", () => {
    const rows = [
      row({ st: "NY" }),
      row({ st: "NY" }),
      row({ st: "CA" }),
    ];
    const { inventoryData } = transformInventory(rows, mapping);
    expect(inventoryData[0].st).toBe("NY");
  });

  it("separates multiple distributors into separate rows", () => {
    const rows = [
      row({ dist: "DistA", oh: 100 }),
      row({ dist: "DistB", oh: 200 }),
    ];
    const { inventoryData } = transformInventory(rows, mapping);
    expect(inventoryData).toHaveLength(2);
    const names = inventoryData.map((d) => d.name).sort();
    expect(names).toEqual(["DistA", "DistB"]);
  });

  it("assigns correct status thresholds", () => {
    const tests = [
      { doh: 0, expected: "Reorder Opportunity" }, // doh=0 hits doh<14 branch first
      { doh: 10, expected: "Reorder Opportunity" },
      { doh: 45, expected: "Healthy" },
      { doh: 70, expected: "Review Needed" },
      { doh: 100, expected: "Overstocked" },
    ];
    for (const { doh, expected } of tests) {
      const rows = [row({ doh })];
      const { inventoryData } = transformInventory(rows, mapping);
      expect(inventoryData[0].status).toBe(expected);
    }
  });

  it("falls back to Unknown when dist is empty", () => {
    const rows = [row({ dist: "" })];
    const { inventoryData } = transformInventory(rows, mapping);
    expect(inventoryData[0].name).toBe("Unknown");
  });

  it("still produces distHealth alongside inventoryData", () => {
    const rows = [row()];
    const result = transformInventory(rows, mapping);
    expect(result).toHaveProperty("inventoryData");
    expect(result).toHaveProperty("distHealth");
    expect(result.distHealth).toHaveLength(1);
  });
});
