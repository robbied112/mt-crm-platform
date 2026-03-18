import { describe, it, expect } from "vitest";
import {
  DISTRIBUTOR_SYSTEMS,
  DATA_SOURCE_CATEGORIES,
  PLANNED_SOURCES,
  ROLE_CATEGORY_ORDER,
  ROLE_RECOMMENDATIONS,
  matchDistributorByHeaders,
  matchDistributorByFilename,
  getReportGuide,
  getDistributorSystemIds,
  getAllSourceIds,
  getSystemsByCategory,
  getCategoryOrder,
} from "../config/reportGuides";

const GENERIC_IDS = ["generic", "genericAccounting"];

describe("DISTRIBUTOR_SYSTEMS config validation", () => {
  const systemIds = Object.keys(DISTRIBUTOR_SYSTEMS);

  it("has distributor systems, accounting systems, and generics", () => {
    expect(systemIds.length).toBeGreaterThanOrEqual(8);
    expect(systemIds).toContain("generic");
    expect(systemIds).toContain("genericAccounting");
    expect(systemIds).toContain("quickbooks");
    expect(systemIds).toContain("idig");
  });

  it.each(systemIds)("%s has all required fields", (id) => {
    const sys = DISTRIBUTOR_SYSTEMS[id];
    expect(sys.name).toBeTruthy();
    expect(sys.shortName).toBeTruthy();
    expect(sys.sourceName).toBeTruthy();
    expect(sys.category).toBeTruthy();
    expect(Array.isArray(sys.headerSignatures)).toBe(true);
    expect(Array.isArray(sys.filenamePatterns)).toBe(true);
    expect(typeof sys.reports).toBe("object");
    expect(Object.keys(sys.reports).length).toBeGreaterThan(0);
  });

  it.each(systemIds)("%s reports have required fields", (id) => {
    const sys = DISTRIBUTOR_SYSTEMS[id];
    for (const [reportType, report] of Object.entries(sys.reports)) {
      expect(report.title).toBeTruthy();
      expect(report.description).toBeTruthy();
      expect(Array.isArray(report.steps)).toBe(true);
      expect(report.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(report.tips)).toBe(true);
      expect(Array.isArray(report.expectedColumns)).toBe(true);
    }
  });

  it("non-generic systems have at least one header signature", () => {
    for (const [id, sys] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
      if (GENERIC_IDS.includes(id)) continue;
      expect(sys.headerSignatures.length).toBeGreaterThan(0);
    }
  });

  it("non-generic systems have at least one filename pattern", () => {
    for (const [id, sys] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
      if (GENERIC_IDS.includes(id)) continue;
      expect(sys.filenamePatterns.length).toBeGreaterThan(0);
    }
  });

  it("cadence field is optional (null for generics)", () => {
    expect(DISTRIBUTOR_SYSTEMS.generic.cadence).toBeNull();
    expect(DISTRIBUTOR_SYSTEMS.genericAccounting.cadence).toBeNull();
    expect(DISTRIBUTOR_SYSTEMS.sgws.cadence).toBe("weekly");
    expect(DISTRIBUTOR_SYSTEMS.quickbooks.cadence).toBe("monthly");
  });

  it("every system has a valid category", () => {
    const validCategories = DATA_SOURCE_CATEGORIES.map((c) => c.key);
    for (const sys of Object.values(DISTRIBUTOR_SYSTEMS)) {
      expect(validCategories).toContain(sys.category);
    }
  });
});

describe("DATA_SOURCE_CATEGORIES", () => {
  it("has 4 categories", () => {
    expect(DATA_SOURCE_CATEGORIES).toHaveLength(4);
  });

  it("each category has key and label", () => {
    for (const cat of DATA_SOURCE_CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });
});

describe("PLANNED_SOURCES", () => {
  it("has at least 3 planned sources", () => {
    expect(PLANNED_SOURCES.length).toBeGreaterThanOrEqual(3);
  });

  it("each planned source has id, name, and category", () => {
    for (const source of PLANNED_SOURCES) {
      expect(source.id).toBeTruthy();
      expect(source.name).toBeTruthy();
      expect(source.category).toBeTruthy();
    }
  });

  it("planned source IDs don't collide with existing system IDs", () => {
    const systemIds = Object.keys(DISTRIBUTOR_SYSTEMS);
    for (const source of PLANNED_SOURCES) {
      expect(systemIds).not.toContain(source.id);
    }
  });
});

describe("ROLE_CATEGORY_ORDER", () => {
  const roles = ["Winery", "Importer", "Distributor", "Retailer"];

  it("has ordering for all 4 roles", () => {
    for (const role of roles) {
      expect(ROLE_CATEGORY_ORDER[role]).toBeTruthy();
      expect(Array.isArray(ROLE_CATEGORY_ORDER[role])).toBe(true);
    }
  });

  it("Winery shows distributors first", () => {
    expect(ROLE_CATEGORY_ORDER.Winery[0]).toBe("distributor");
  });

  it("Retailer shows accounting first", () => {
    expect(ROLE_CATEGORY_ORDER.Retailer[0]).toBe("accounting");
  });

  it("Distributor shows accounting first", () => {
    expect(ROLE_CATEGORY_ORDER.Distributor[0]).toBe("accounting");
  });
});

describe("ROLE_RECOMMENDATIONS config validation", () => {
  const roles = ["Winery", "Importer", "Distributor", "Retailer"];

  it("has recommendations for all 4 roles", () => {
    for (const role of roles) {
      expect(ROLE_RECOMMENDATIONS[role]).toBeTruthy();
    }
  });

  it.each(roles)("%s has primary and secondary recommendations", (role) => {
    const rec = ROLE_RECOMMENDATIONS[role];
    expect(rec.primary).toBeTruthy();
    expect(rec.primaryLabel).toBeTruthy();
    expect(rec.primaryWhy).toBeTruthy();
    expect(Array.isArray(rec.secondary)).toBe(true);
  });
});

describe("matchDistributorByHeaders", () => {
  it("matches SGWS by PREMISE TYPE + CORP ITEM CD", () => {
    const result = matchDistributorByHeaders(["Account", "PREMISE TYPE", "CORP ITEM CD", "Cases"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("sgws");
    expect(result.shortName).toBe("SGWS");
  });

  it("matches Breakthru by ITEM NUMBER + BRAND FAMILY + DEPLETION QTY", () => {
    const result = matchDistributorByHeaders(["ITEM NUMBER", "BRAND FAMILY", "DEPLETION QTY", "State"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("breakthru");
  });

  it("matches RNDC by PRODUCT CODE + CASES DEPLETED", () => {
    const result = matchDistributorByHeaders(["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("rndc");
  });

  it("matches QuickBooks by DATE + TRANSACTION TYPE + AMOUNT + BALANCE", () => {
    const result = matchDistributorByHeaders(["Date", "Transaction Type", "Amount", "Balance"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("quickbooks");
  });

  it("matches QuickBooks AR Aging by AGING + CURRENT + 1 - 30", () => {
    const result = matchDistributorByHeaders(["Aging", "Current", "1 - 30", "31 - 60", "Total"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("quickbooks");
  });

  it("matches iDig by PRODUCT CODE + CASES DEPLETED (returns rndc due to insertion order)", () => {
    // iDig shares header signatures with RNDC. RNDC comes first in object order,
    // so matchDistributorByHeaders returns rndc. This is correct for DataImport.
    const result = matchDistributorByHeaders(["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("rndc");
  });

  it("is case-insensitive for header matching", () => {
    const result = matchDistributorByHeaders(["premise type", "corp item cd", "cases"]);
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("sgws");
  });

  it("returns null for unknown headers", () => {
    const result = matchDistributorByHeaders(["Foo", "Bar", "Baz"]);
    expect(result).toBeNull();
  });

  it("returns null for empty headers", () => {
    expect(matchDistributorByHeaders([])).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(matchDistributorByHeaders(null)).toBeNull();
    expect(matchDistributorByHeaders(undefined)).toBeNull();
  });

  it("never matches generic systems", () => {
    const result = matchDistributorByHeaders(["Name", "Amount", "Date"]);
    expect(result === null || !GENERIC_IDS.includes(result.systemId)).toBe(true);
  });
});

describe("matchDistributorByFilename", () => {
  it("matches SGWS filename", () => {
    const result = matchDistributorByFilename("SGWS_Depletion_Q4_2025.xlsx");
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("sgws");
  });

  it("matches Southern Glazer's filename", () => {
    const result = matchDistributorByFilename("Southern Glazers Weekly Report.csv");
    expect(result).not.toBeNull();
    expect(result.systemId).toBe("sgws");
  });

  it("matches Breakthru / Encompass filename", () => {
    expect(matchDistributorByFilename("encompass_export.xlsx")?.systemId).toBe("breakthru");
    expect(matchDistributorByFilename("Breakthru_Sales_2025.xlsx")?.systemId).toBe("breakthru");
  });

  it("matches RNDC filename", () => {
    expect(matchDistributorByFilename("RNDC_Report.csv")?.systemId).toBe("rndc");
  });

  it("matches iDig filename", () => {
    expect(matchDistributorByFilename("iDIG_Depletion_Detail.xlsx")?.systemId).toBe("idig");
    expect(matchDistributorByFilename("i-dig_report.xlsx")?.systemId).toBe("idig");
  });

  it("matches QuickBooks filename", () => {
    expect(matchDistributorByFilename("quickbooks_sales_export.xlsx")?.systemId).toBe("quickbooks");
    expect(matchDistributorByFilename("qb_ar_aging.csv")?.systemId).toBe("quickbooks");
    expect(matchDistributorByFilename("QBO_ProfitLoss.xlsx")?.systemId).toBe("quickbooks");
  });

  it("returns null for unrecognized filename", () => {
    expect(matchDistributorByFilename("my_data.xlsx")).toBeNull();
  });

  it("returns null for null/empty input", () => {
    expect(matchDistributorByFilename(null)).toBeNull();
    expect(matchDistributorByFilename("")).toBeNull();
  });
});

describe("getReportGuide", () => {
  it("returns guide for valid system and report type", () => {
    const { system, report } = getReportGuide("sgws", "depletion");
    expect(system.shortName).toBe("SGWS");
    expect(report.title).toBe("Weekly Depletion Report");
  });

  it("returns QuickBooks revenue guide", () => {
    const { system, report } = getReportGuide("quickbooks", "revenue");
    expect(system.shortName).toBe("QuickBooks");
    expect(report.title).toBe("Sales by Customer Summary");
  });

  it("returns QuickBooks AR aging guide", () => {
    const { system, report } = getReportGuide("quickbooks", "arAging");
    expect(system.shortName).toBe("QuickBooks");
    expect(report.title).toContain("Accounts Receivable");
  });

  it("returns iDig depletion guide", () => {
    const { system, report } = getReportGuide("idig", "depletion");
    expect(system.shortName).toBe("iDig");
    expect(report.title).toContain("iDig");
  });

  it("falls back to generic for unknown system", () => {
    const { system, report } = getReportGuide("unknown_system", "depletion");
    expect(system.shortName).toBe("Other");
    expect(report.title).toBeTruthy();
  });

  it("falls back to first report type if requested type not found", () => {
    const { report } = getReportGuide("quickbooks", "nonexistent_type");
    // QuickBooks has no depletion report, so it falls back to first report (revenue)
    expect(report.title).toBeTruthy();
  });

  it("defaults reportType to depletion", () => {
    const { report } = getReportGuide("sgws");
    expect(report.title).toBe("Weekly Depletion Report");
  });
});

describe("getDistributorSystemIds", () => {
  it("returns system IDs excluding generics", () => {
    const ids = getDistributorSystemIds();
    expect(ids).not.toContain("generic");
    expect(ids).not.toContain("genericAccounting");
    expect(ids).toContain("sgws");
    expect(ids).toContain("breakthru");
    expect(ids).toContain("rndc");
    expect(ids).toContain("youngs");
    expect(ids).toContain("quickbooks");
    expect(ids).toContain("idig");
  });
});

describe("getAllSourceIds", () => {
  it("returns all non-generic source IDs", () => {
    const ids = getAllSourceIds();
    expect(ids).not.toContain("generic");
    expect(ids).not.toContain("genericAccounting");
    expect(ids).toContain("sgws");
    expect(ids).toContain("quickbooks");
    expect(ids).toContain("idig");
  });

  it("has the same result as getDistributorSystemIds", () => {
    // Currently identical — both exclude generics
    expect(getAllSourceIds()).toEqual(getDistributorSystemIds());
  });
});

describe("getSystemsByCategory", () => {
  it("groups systems by category", () => {
    const grouped = getSystemsByCategory();
    expect(grouped.distributor).toContain("sgws");
    expect(grouped.distributor).toContain("breakthru");
    expect(grouped.distributor).toContain("rndc");
    expect(grouped.distributor).toContain("youngs");
    expect(grouped.accounting).toContain("quickbooks");
    expect(grouped.industry).toContain("idig");
  });

  it("excludes generic entries", () => {
    const grouped = getSystemsByCategory();
    const allIds = Object.values(grouped).flat();
    expect(allIds).not.toContain("generic");
    expect(allIds).not.toContain("genericAccounting");
  });

  it("does not include empty categories", () => {
    const grouped = getSystemsByCategory();
    for (const ids of Object.values(grouped)) {
      expect(ids.length).toBeGreaterThan(0);
    }
  });
});

describe("getCategoryOrder", () => {
  it("returns distributor-first for Winery", () => {
    const order = getCategoryOrder("Winery");
    expect(order[0]).toBe("distributor");
  });

  it("returns accounting-first for Retailer", () => {
    const order = getCategoryOrder("Retailer");
    expect(order[0]).toBe("accounting");
  });

  it("returns accounting-first for Distributor", () => {
    const order = getCategoryOrder("Distributor");
    expect(order[0]).toBe("accounting");
  });

  it("falls back to Winery order for unknown role", () => {
    const order = getCategoryOrder("UnknownRole");
    expect(order).toEqual(getCategoryOrder("Winery"));
  });

  it("falls back to Winery order for undefined", () => {
    const order = getCategoryOrder(undefined);
    expect(order).toEqual(getCategoryOrder("Winery"));
  });
});
