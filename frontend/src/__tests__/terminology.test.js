/**
 * Tests for terminology — 4-role system with backward compatibility.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Firebase and DataContext to avoid Firebase initialization
vi.mock("../config/firebase", () => ({
  db: {},
  auth: {},
  default: {},
}));

vi.mock("../context/DataContext", () => ({
  useData: () => ({ tenantConfig: {} }),
}));

const { ROLE_DEFAULTS, t, getUserRole } = await import("../utils/terminology");

describe("ROLE_DEFAULTS", () => {
  it("defines all 5 role entries (4 industry + legacy supplier)", () => {
    expect(Object.keys(ROLE_DEFAULTS)).toEqual(
      expect.arrayContaining(["supplier", "winery", "importer", "distributor", "retailer"])
    );
  });

  it("winery uses Retailer for account, Distributor for dist", () => {
    expect(ROLE_DEFAULTS.winery.account).toBe("Retailer");
    expect(ROLE_DEFAULTS.winery.distributor).toBe("Distributor");
    expect(ROLE_DEFAULTS.winery.depletion).toBe("Depletion");
  });

  it("importer uses Distributor for account, Distributor for dist", () => {
    expect(ROLE_DEFAULTS.importer.account).toBe("Distributor");
    expect(ROLE_DEFAULTS.importer.distributor).toBe("Distributor");
    expect(ROLE_DEFAULTS.importer.depletion).toBe("Orders");
  });

  it("distributor uses Retailer for account, Supplier for dist", () => {
    expect(ROLE_DEFAULTS.distributor.account).toBe("Retailer");
    expect(ROLE_DEFAULTS.distributor.distributor).toBe("Supplier");
    expect(ROLE_DEFAULTS.distributor.depletion).toBe("Sell-Through");
  });

  it("retailer uses Store for account, Supplier for dist", () => {
    expect(ROLE_DEFAULTS.retailer.account).toBe("Store");
    expect(ROLE_DEFAULTS.retailer.distributor).toBe("Supplier");
    expect(ROLE_DEFAULTS.retailer.depletion).toBe("Purchases");
  });

  it("every role has all required terminology keys", () => {
    const requiredKeys = [
      "volume", "longPeriod", "shortPeriod", "distributor", "account",
      "depletion", "healthTab", "selectEntity", "chooseEntity",
      "purchaseLabel", "entityScorecard", "noEntityData",
      "uploadEntityHint", "reEngageDescription", "newWinsDescription",
      "netPlacementTitle", "uploadHint",
    ];

    for (const [role, defaults] of Object.entries(ROLE_DEFAULTS)) {
      for (const key of requiredKeys) {
        expect(defaults[key], `${role}.${key} should be defined`).toBeTruthy();
      }
    }
  });

  it("legacy supplier has same distributor term as winery", () => {
    expect(ROLE_DEFAULTS.supplier.distributor).toBe(ROLE_DEFAULTS.winery.distributor);
  });
});

describe("t() static helper", () => {
  it("returns fallback value for unknown key", () => {
    const result = t("unknownKey");
    expect(result).toBe("unknownKey");
  });

  it("resolves known keys", () => {
    const acct = t("account");
    expect(typeof acct).toBe("string");
    expect(acct.length).toBeGreaterThan(0);
  });
});

describe("getUserRole", () => {
  it("returns a string role", () => {
    const role = getUserRole();
    expect(typeof role).toBe("string");
    expect(role).toBe("supplier");
  });
});
