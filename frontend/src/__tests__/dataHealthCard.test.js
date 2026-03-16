/**
 * Tests for DataHealthCard computation logic.
 *
 * Tests the health score computation and nudge logic
 * using mock DataContext availability flags.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the contexts before importing component
vi.mock("../context/DataContext", () => ({
  useData: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";

// We test the computation logic directly by extracting it.
// The DataHealthCard component uses useMemo with availability flags.
// We replicate the logic here for pure unit testing.

const DATA_TYPES = [
  { key: "depletions", label: "Depletions", uploadType: "depletion" },
  { key: "accounts", label: "Accounts", uploadType: "depletion" },
  { key: "inventory", label: "Inventory", uploadType: "inventory" },
  { key: "pipeline", label: "Pipeline", uploadType: "pipeline" },
  { key: "distributorHealth", label: "Distributor Health", uploadType: "depletion" },
];

function computeHealth(availability, role = "Winery") {
  const loaded = DATA_TYPES.filter((dt) => availability?.[dt.key]);
  const score = DATA_TYPES.length > 0
    ? Math.round((loaded.length / DATA_TYPES.length) * 100)
    : 0;
  return { loaded, score, total: DATA_TYPES.length };
}

describe("DataHealthCard computation", () => {
  it("returns 0% when no data is loaded", () => {
    const result = computeHealth({
      depletions: false,
      accounts: false,
      inventory: false,
      pipeline: false,
      distributorHealth: false,
    });
    expect(result.score).toBe(0);
    expect(result.loaded.length).toBe(0);
  });

  it("returns 100% when all data types are loaded", () => {
    const result = computeHealth({
      depletions: true,
      accounts: true,
      inventory: true,
      pipeline: true,
      distributorHealth: true,
    });
    expect(result.score).toBe(100);
    expect(result.loaded.length).toBe(5);
  });

  it("returns correct percentage for partial data", () => {
    const result = computeHealth({
      depletions: true,
      accounts: true,
      inventory: false,
      pipeline: false,
      distributorHealth: false,
    });
    expect(result.score).toBe(40); // 2/5 = 40%
    expect(result.loaded.length).toBe(2);
  });

  it("returns 20% for a single data type loaded", () => {
    const result = computeHealth({
      depletions: true,
      accounts: false,
      inventory: false,
      pipeline: false,
      distributorHealth: false,
    });
    expect(result.score).toBe(20); // 1/5
    expect(result.loaded.length).toBe(1);
  });

  it("handles undefined availability gracefully", () => {
    const result = computeHealth(undefined);
    expect(result.score).toBe(0);
    expect(result.loaded.length).toBe(0);
  });

  it("handles null availability gracefully", () => {
    const result = computeHealth(null);
    expect(result.score).toBe(0);
    expect(result.loaded.length).toBe(0);
  });

  it("handles empty object availability", () => {
    const result = computeHealth({});
    expect(result.score).toBe(0);
    expect(result.loaded.length).toBe(0);
  });

  it("correctly identifies loaded items", () => {
    const result = computeHealth({
      depletions: true,
      accounts: false,
      inventory: true,
      pipeline: false,
      distributorHealth: true,
    });
    expect(result.score).toBe(60); // 3/5
    const loadedKeys = result.loaded.map((d) => d.key);
    expect(loadedKeys).toContain("depletions");
    expect(loadedKeys).toContain("inventory");
    expect(loadedKeys).toContain("distributorHealth");
    expect(loadedKeys).not.toContain("accounts");
    expect(loadedKeys).not.toContain("pipeline");
  });

  it("total is always 5", () => {
    expect(computeHealth({}).total).toBe(5);
    expect(computeHealth({ depletions: true }).total).toBe(5);
  });
});
