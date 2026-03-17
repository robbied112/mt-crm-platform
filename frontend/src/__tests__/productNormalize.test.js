/**
 * Tests for productNormalize — canonical naming, vintage extraction,
 * and client-side exact matching for wine/spirits products.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeProductName,
  sanitizeProductName,
  extractVintage,
  buildNormalizedName,
  clientExactMatch,
} from "../utils/productNormalize";

// ---------------------------------------------------------------------------
// normalizeProductName
// ---------------------------------------------------------------------------

describe("normalizeProductName", () => {
  it("lowercases input", () => {
    expect(normalizeProductName("Château Margaux")).toBe("chateau margaux");
  });

  it("strips accents / diacritics", () => {
    expect(normalizeProductName("Côtes du Rhône")).toBe("cotes du rhone");
  });

  it("removes bottle sizes (750ml)", () => {
    expect(normalizeProductName("Margaux 750ml")).toBe("margaux");
  });

  it("removes bottle sizes (1.5L)", () => {
    expect(normalizeProductName("Reserve 1.5L")).toBe("reserve");
  });

  it("removes bottle sizes (375ML case-insensitive)", () => {
    expect(normalizeProductName("Rosé 375ML")).toBe("rose");
  });

  it("expands Ch. abbreviation", () => {
    expect(normalizeProductName("Ch. Margaux")).toBe("chateau margaux");
  });

  it("expands Dom. abbreviation", () => {
    expect(normalizeProductName("Dom. de la Romanée")).toBe(
      "domaine de la romanee"
    );
  });

  it("expands St. abbreviation", () => {
    expect(normalizeProductName("St. Emilion")).toBe("saint emilion");
  });

  it("collapses whitespace", () => {
    expect(normalizeProductName("  Margaux   Grand  ")).toBe("margaux grand");
  });

  it("returns empty string for null", () => {
    expect(normalizeProductName(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeProductName(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeProductName("")).toBe("");
  });

  it("already normalized input stays the same", () => {
    expect(normalizeProductName("chateau margaux")).toBe("chateau margaux");
  });
});

// ---------------------------------------------------------------------------
// sanitizeProductName
// ---------------------------------------------------------------------------

describe("sanitizeProductName", () => {
  it("removes control characters", () => {
    expect(sanitizeProductName("Margaux\x00\x1f")).toBe("Margaux");
  });

  it("removes zero-width chars", () => {
    expect(sanitizeProductName("Margaux\u200b")).toBe("Margaux");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeProductName("  Margaux   Grand  ")).toBe("Margaux Grand");
  });

  it("caps length at 150", () => {
    const long = "A".repeat(200);
    expect(sanitizeProductName(long).length).toBeLessThanOrEqual(150);
  });

  it("returns empty string for null", () => {
    expect(sanitizeProductName(null)).toBe("");
  });

  it("returns empty string for non-string", () => {
    expect(sanitizeProductName(42)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractVintage
// ---------------------------------------------------------------------------

describe("extractVintage", () => {
  it("extracts trailing vintage", () => {
    expect(extractVintage("Margaux 2018")).toBe("2018");
  });

  it("extracts leading vintage", () => {
    expect(extractVintage("2020 Reserve")).toBe("2020");
  });

  it("returns null for NV wines", () => {
    expect(extractVintage("NV Brut")).toBeNull();
  });

  it("returns null for non-year numbers like 750ml", () => {
    expect(extractVintage("750ml")).toBeNull();
  });

  it("returns null when no vintage info", () => {
    expect(extractVintage("No vintage info")).toBeNull();
  });

  it("handles boundary year 1900", () => {
    expect(extractVintage("Cuvée 1900")).toBe("1900");
  });

  it("returns null for null input", () => {
    expect(extractVintage(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractVintage(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildNormalizedName
// ---------------------------------------------------------------------------

describe("buildNormalizedName", () => {
  it("sanitizes then normalizes", () => {
    expect(buildNormalizedName("  Ch. Margaux\x00 2015  750ml ")).toBe(
      "chateau margaux 2015"
    );
  });
});

// ---------------------------------------------------------------------------
// clientExactMatch
// ---------------------------------------------------------------------------

describe("clientExactMatch", () => {
  const catalog = [
    {
      id: "prod-1",
      name: "Château Margaux 2015",
      normalizedName: "chateau margaux 2015",
      sku: "CM-2015",
      sourceNames: ["Ch. Margaux 2015 Grand Vin"],
    },
    {
      id: "prod-2",
      name: "Opus One 2018",
      normalizedName: "opus one 2018",
      sku: "OP-2018",
      sourceNames: [],
    },
  ];

  it("matches by normalizedName", () => {
    const { matched, unmatched } = clientExactMatch(
      ["Château Margaux 2015"],
      catalog
    );
    expect(matched.get("Château Margaux 2015")).toBe("prod-1");
    expect(unmatched).toHaveLength(0);
  });

  it("matches by SKU (case-insensitive)", () => {
    const { matched } = clientExactMatch(["cm-2015"], catalog);
    expect(matched.get("cm-2015")).toBe("prod-1");
  });

  it("matches by sourceNames", () => {
    const { matched } = clientExactMatch(
      ["Ch. Margaux 2015 Grand Vin"],
      catalog
    );
    expect(matched.get("Ch. Margaux 2015 Grand Vin")).toBe("prod-1");
  });

  it("reports unmatched names", () => {
    const { matched, unmatched } = clientExactMatch(
      ["Unknown Wine 2020"],
      catalog
    );
    expect(matched.size).toBe(0);
    expect(unmatched).toEqual(["Unknown Wine 2020"]);
  });

  it("returns empty results for empty catalog", () => {
    const { matched, unmatched } = clientExactMatch(
      ["Château Margaux 2015"],
      []
    );
    expect(matched.size).toBe(0);
    expect(unmatched).toEqual(["Château Margaux 2015"]);
  });

  it("returns empty results for empty names", () => {
    const { matched, unmatched } = clientExactMatch([], catalog);
    expect(matched.size).toBe(0);
    expect(unmatched).toHaveLength(0);
  });

  it("handles case-insensitive matching via normalization", () => {
    const { matched } = clientExactMatch(["OPUS ONE 2018"], catalog);
    expect(matched.get("OPUS ONE 2018")).toBe("prod-2");
  });

  it("handles accent-insensitive matching (Ch. vs Château)", () => {
    // Both "Ch. Margaux 2015" and "Château Margaux 2015" normalize the same way
    const { matched } = clientExactMatch(["Ch. Margaux 2015"], catalog);
    expect(matched.get("Ch. Margaux 2015")).toBe("prod-1");
  });

  it("handles non-array inputs gracefully", () => {
    const { matched, unmatched } = clientExactMatch(null, null);
    expect(matched.size).toBe(0);
    expect(unmatched).toHaveLength(0);
  });
});
