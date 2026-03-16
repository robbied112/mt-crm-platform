import { describe, it, expect } from "vitest";
import {
  DISTRIBUTOR_SYSTEMS,
  ROLE_RECOMMENDATIONS,
  matchDistributorByHeaders,
  matchDistributorByFilename,
  getReportGuide,
  getDistributorSystemIds,
} from "../config/reportGuides";

describe("DISTRIBUTOR_SYSTEMS config validation", () => {
  const systemIds = Object.keys(DISTRIBUTOR_SYSTEMS);

  it("has at least 4 distributor systems plus generic", () => {
    expect(systemIds.length).toBeGreaterThanOrEqual(5);
    expect(systemIds).toContain("generic");
  });

  it.each(systemIds)("%s has all required fields", (id) => {
    const sys = DISTRIBUTOR_SYSTEMS[id];
    expect(sys.name).toBeTruthy();
    expect(sys.shortName).toBeTruthy();
    expect(sys.portalName).toBeTruthy();
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
      if (id === "generic") continue;
      expect(sys.headerSignatures.length).toBeGreaterThan(0);
    }
  });

  it("non-generic systems have at least one filename pattern", () => {
    for (const [id, sys] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
      if (id === "generic") continue;
      expect(sys.filenamePatterns.length).toBeGreaterThan(0);
    }
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

  it("never matches the generic system", () => {
    // Generic has no signatures, so it should never match
    const result = matchDistributorByHeaders(["Name", "Amount", "Date"]);
    expect(result === null || result.systemId !== "generic").toBe(true);
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

  it("matches RNDC / iDIG filename", () => {
    expect(matchDistributorByFilename("iDIG_Depletion_Detail.xlsx")?.systemId).toBe("rndc");
    expect(matchDistributorByFilename("RNDC_Report.csv")?.systemId).toBe("rndc");
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

  it("falls back to generic for unknown system", () => {
    const { system, report } = getReportGuide("unknown_system", "depletion");
    expect(system.shortName).toBe("Other");
    expect(report.title).toBeTruthy();
  });

  it("falls back to depletion report type if requested type not found", () => {
    const { report } = getReportGuide("sgws", "nonexistent_type");
    expect(report.title).toBe("Weekly Depletion Report");
  });

  it("defaults reportType to depletion", () => {
    const { report } = getReportGuide("sgws");
    expect(report.title).toBe("Weekly Depletion Report");
  });
});

describe("getDistributorSystemIds", () => {
  it("returns system IDs excluding generic", () => {
    const ids = getDistributorSystemIds();
    expect(ids).not.toContain("generic");
    expect(ids).toContain("sgws");
    expect(ids).toContain("breakthru");
    expect(ids).toContain("rndc");
    expect(ids).toContain("youngs");
  });
});
