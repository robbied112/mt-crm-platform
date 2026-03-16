/**
 * Tests for demoData — validates all 12 dataset shapes and seed/clear logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock firestoreService ──────────────────────────────────────
const mockSaveAllDatasets = vi.fn(async () => {});
const mockSaveTenantConfig = vi.fn(async () => {});
const mockSaveSummary = vi.fn(async () => {});

vi.mock("../services/firestoreService", () => ({
  saveAllDatasets: (...args) => mockSaveAllDatasets(...args),
  saveTenantConfig: (...args) => mockSaveTenantConfig(...args),
  saveSummary: (...args) => mockSaveSummary(...args),
}));

vi.mock("../services/crmService", () => ({
  createAccount: vi.fn(async () => "mock-account-id"),
  createContact: vi.fn(async () => "mock-contact-id"),
  logActivity: vi.fn(async () => "mock-activity-id"),
  createTask: vi.fn(async () => "mock-task-id"),
}));

import { seedDemoData, clearDemoData, DEMO_DATASETS, DEMO_SUMMARY } from "../services/demoData";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Dataset shape validation ───────────────────────────────────

describe("DEMO_DATASETS", () => {
  it("contains exactly 12 datasets", () => {
    expect(Object.keys(DEMO_DATASETS)).toHaveLength(12);
  });

  const EXPECTED_KEYS = [
    "distScorecard",
    "reorderData",
    "accountsTop",
    "pipelineAccounts",
    "pipelineMeta",
    "inventoryData",
    "newWins",
    "distHealth",
    "reEngagementData",
    "placementSummary",
    "qbDistOrders",
    "acctConcentration",
  ];

  it.each(EXPECTED_KEYS)("includes %s", (key) => {
    expect(DEMO_DATASETS).toHaveProperty(key);
    expect(DEMO_DATASETS[key]).toBeDefined();
  });

  it("distScorecard has 4 distributors with required fields", () => {
    const ds = DEMO_DATASETS.distScorecard;
    expect(ds).toHaveLength(4);
    ds.forEach((d) => {
      expect(d).toHaveProperty("name");
      expect(d).toHaveProperty("state");
      expect(d).toHaveProperty("totalCases");
      expect(d).toHaveProperty("totalRevenue");
    });
  });

  it("accountsTop has 20 accounts", () => {
    expect(DEMO_DATASETS.accountsTop).toHaveLength(20);
  });

  it("pipelineAccounts has 8 deals at various stages", () => {
    const pa = DEMO_DATASETS.pipelineAccounts;
    expect(pa).toHaveLength(8);
    const stages = new Set(pa.map((d) => d.stage));
    expect(stages.size).toBeGreaterThanOrEqual(4);
  });

  it("inventoryData spans multiple states", () => {
    const states = new Set(DEMO_DATASETS.inventoryData.map((d) => d.state));
    expect(states.size).toBeGreaterThanOrEqual(3);
  });

  it("pipelineMeta is an object with totalDeals", () => {
    expect(DEMO_DATASETS.pipelineMeta).toHaveProperty("totalDeals", 8);
    expect(DEMO_DATASETS.pipelineMeta).toHaveProperty("stages");
  });

  it("qbDistOrders is an object with totalOrders", () => {
    expect(DEMO_DATASETS.qbDistOrders).toHaveProperty("totalOrders");
    expect(DEMO_DATASETS.qbDistOrders).toHaveProperty("byDistributor");
  });

  it("acctConcentration is an object with riskLevel", () => {
    expect(DEMO_DATASETS.acctConcentration).toHaveProperty("riskLevel");
    expect(DEMO_DATASETS.acctConcentration).toHaveProperty("totalAccounts", 20);
  });

  it("reorderData has entries with predictedReorder dates", () => {
    DEMO_DATASETS.reorderData.forEach((r) => {
      expect(r).toHaveProperty("predictedReorder");
      expect(r).toHaveProperty("account");
    });
  });

  it("placementSummary has entries for each product", () => {
    expect(DEMO_DATASETS.placementSummary.length).toBeGreaterThanOrEqual(5);
    DEMO_DATASETS.placementSummary.forEach((p) => {
      expect(p).toHaveProperty("product");
      expect(p).toHaveProperty("totalAccounts");
    });
  });
});

describe("DEMO_SUMMARY", () => {
  it("is a non-empty string", () => {
    expect(typeof DEMO_SUMMARY).toBe("string");
    expect(DEMO_SUMMARY.length).toBeGreaterThan(50);
  });
});

// ─── seedDemoData ───────────────────────────────────────────────

describe("seedDemoData", () => {
  it("calls saveAllDatasets, saveTenantConfig, and saveSummary in parallel", async () => {
    await seedDemoData("tenant-123");

    expect(mockSaveAllDatasets).toHaveBeenCalledWith("tenant-123", DEMO_DATASETS);
    expect(mockSaveTenantConfig).toHaveBeenCalledWith("tenant-123", {
      demoData: true,
      companyName: "Vineyard Valley Wines",
    });
    expect(mockSaveSummary).toHaveBeenCalledWith("tenant-123", DEMO_SUMMARY);
  });

  it("calls all three functions exactly once", async () => {
    await seedDemoData("t1");
    expect(mockSaveAllDatasets).toHaveBeenCalledTimes(1);
    expect(mockSaveTenantConfig).toHaveBeenCalledTimes(1);
    expect(mockSaveSummary).toHaveBeenCalledTimes(1);
  });
});

// ─── clearDemoData ──────────────────────────────────────────────

describe("clearDemoData", () => {
  it("writes empty datasets, clears config flag, and clears summary", async () => {
    await clearDemoData("tenant-456");

    // Verify datasets are empty
    const [tid, datasets] = mockSaveAllDatasets.mock.calls[0];
    expect(tid).toBe("tenant-456");
    for (const [key, val] of Object.entries(datasets)) {
      if (Array.isArray(DEMO_DATASETS[key])) {
        expect(val).toEqual([]);
      } else {
        expect(val).toEqual({});
      }
    }

    expect(mockSaveTenantConfig).toHaveBeenCalledWith("tenant-456", {
      demoData: false,
      companyName: "",
    });
    expect(mockSaveSummary).toHaveBeenCalledWith("tenant-456", "");
  });
});
