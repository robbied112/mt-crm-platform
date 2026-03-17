/**
 * Product Normalization — canonical naming, vintage extraction, and client-side matching.
 *
 * Provides a shared pipeline for normalizing wine/spirits product names so that
 * imports, CRM records, and pricing data can be matched reliably without AI.
 *
 * ┌──────────────┐
 * │  raw name    │   "Ch. Margaux 2015 Grand Vin 750ml"
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │ sanitize     │   strip special chars, trim to 150
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │ normalize    │   lowercase, expand abbreviations,
 * │              │   remove bottle sizes, strip accents
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │ normalized   │   "chateau margaux 2015 grand vin"
 * └──────────────┘
 *
 * clientExactMatch() uses the normalized name, SKU, and sourceNames
 * to resolve imports against existing product records without a
 * round-trip to Cloud Functions.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip Unicode accents / diacritics.
 * "Château" → "Chateau", "Côtes" → "Cotes"
 */
function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Common wine-label abbreviations → expanded form.
 * Order matters: longer patterns first to avoid partial replacement.
 */
const ABBREVIATIONS = [
  [/\bCht\.\s*/gi, "Chateau "],
  [/\bCh\.\s*/gi, "Chateau "],
  [/\bDom\.\s*/gi, "Domaine "],
  [/\bSt\.\s*/gi, "Saint "],
  [/\bMt\.\s*/gi, "Mount "],
  [/\bVdP\b/gi, "Vin de Pays"],
];

/**
 * Bottle-size patterns to strip.
 * Matches: 750ml, 750 ml, 1L, 1.5L, 375ML, 3L, etc.
 */
const BOTTLE_SIZE_RE = /\b\d+(\.\d+)?\s*(ml|l|liter|litre|cl)\b/gi;

/**
 * Vintage pattern: 4-digit year 1900–2099 as a standalone token.
 */
const VINTAGE_RE = /\b(19\d{2}|20\d{2})\b/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a product name for matching.
 *
 * Steps: strip accents → expand abbreviations → remove bottle sizes →
 *        lowercase → collapse whitespace → trim.
 *
 * @param {string} name - Raw product name
 * @returns {string} Normalized product name
 */
function normalizeProductName(name) {
  if (!name || typeof name !== "string") return "";

  let s = stripAccents(name);

  // Expand abbreviations
  for (const [pattern, replacement] of ABBREVIATIONS) {
    s = s.replace(pattern, replacement);
  }

  // Remove bottle sizes
  s = s.replace(BOTTLE_SIZE_RE, "");

  // Lowercase, collapse whitespace, trim
  s = s.toLowerCase().replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Sanitize a product name — remove problematic characters,
 * cap length at 150.
 *
 * @param {string} name - Raw product name
 * @returns {string} Sanitized product name
 */
function sanitizeProductName(name) {
  if (!name || typeof name !== "string") return "";

  // Remove control characters and zero-width chars
  let s = name.replace(/[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]/g, "");

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, " ").trim();

  // Cap length
  if (s.length > 150) {
    s = s.slice(0, 150).trim();
  }

  return s;
}

/**
 * Extract a 4-digit vintage year (1900–2099) from a wine name.
 *
 * @param {string} name - Wine product name
 * @returns {string|null} Vintage year string, or null if not found
 */
function extractVintage(name) {
  if (!name || typeof name !== "string") return null;
  const match = name.match(VINTAGE_RE);
  return match ? match[1] : null;
}

/**
 * Full normalization pipeline: sanitize → normalize.
 *
 * @param {string} name - Raw product name
 * @returns {string} Fully normalized name
 */
function buildNormalizedName(name) {
  return normalizeProductName(sanitizeProductName(name));
}

// ---------------------------------------------------------------------------
// PRODUCT_FIELDS — semantic-mapper-style field definitions
// ---------------------------------------------------------------------------

/**
 * Product-specific column definitions for the semantic mapper.
 * Each entry follows the same shape used by getFieldDefs() in
 * semanticMapper.js: { field, label, headerAliases }.
 */
const PRODUCT_FIELDS = [
  {
    field: "varietal",
    label: "Varietal / Grape",
    headerAliases: ["varietal", "grape", "variety", "grape variety", "varietal/blend"],
  },
  {
    field: "appellation",
    label: "Appellation",
    headerAliases: ["appellation", "aoc", "ava", "designation", "sub-region"],
  },
  {
    field: "wineRegion",
    label: "Wine Region",
    headerAliases: ["wine region", "region of origin", "growing region"],
  },
  {
    field: "country",
    label: "Country",
    headerAliases: ["country", "country of origin"],
  },
  {
    field: "caseSize",
    label: "Case Size",
    headerAliases: ["case size", "pack size", "case pack", "bottles per case", "units per case"],
  },
  {
    field: "bottleSize",
    label: "Bottle Size",
    headerAliases: ["bottle size", "ml", "size", "format", "container size"],
  },
  {
    field: "alcoholPct",
    label: "Alcohol %",
    headerAliases: ["alcohol", "abv", "alcohol %", "alc", "alcohol by volume"],
  },
  {
    field: "fobPrice",
    label: "FOB Price",
    headerAliases: ["fob", "fob price", "cost", "landed cost", "ex-cellar", "producer price"],
  },
  {
    field: "producer",
    label: "Producer / Winery",
    headerAliases: [
      "producer", "winery", "brand", "supplier", "house",
      "domaine", "chateau", "estate", "maker",
    ],
  },
];

// ---------------------------------------------------------------------------
// Client-side exact matching
// ---------------------------------------------------------------------------

/**
 * Match raw product names against existing product records using
 * deterministic (non-AI) rules.
 *
 * Match priority:
 *   1. normalizedName === buildNormalizedName(rawName)
 *   2. SKU exact match  (case-insensitive)
 *   3. sourceNames[]    (any entry matches normalized raw name)
 *
 * @param {string[]} productNames - Raw product name strings from an import
 * @param {Array<{id: string, name: string, normalizedName: string, sku?: string, sourceNames?: string[]}>} existingProducts
 * @returns {{ matched: Map<string, string>, unmatched: string[] }}
 */
function clientExactMatch(productNames, existingProducts) {
  if (!Array.isArray(productNames) || !Array.isArray(existingProducts)) {
    return { matched: new Map(), unmatched: [] };
  }

  // Pre-build lookup indexes
  const byNormalized = new Map(); // normalizedName → product id
  const bySku = new Map();        // lowercase sku → product id
  const bySourceName = new Map(); // normalized sourceName → product id

  for (const prod of existingProducts) {
    if (prod.normalizedName) {
      byNormalized.set(prod.normalizedName, prod.id);
    }
    if (prod.sku) {
      bySku.set(String(prod.sku).toLowerCase().trim(), prod.id);
    }
    if (Array.isArray(prod.sourceNames)) {
      for (const sn of prod.sourceNames) {
        const norm = buildNormalizedName(sn);
        if (norm) bySourceName.set(norm, prod.id);
      }
    }
  }

  const matched = new Map();
  const unmatched = [];

  for (const rawName of productNames) {
    const normalized = buildNormalizedName(rawName);
    if (!normalized) {
      unmatched.push(rawName);
      continue;
    }

    // 1. normalizedName match
    if (byNormalized.has(normalized)) {
      matched.set(rawName, byNormalized.get(normalized));
      continue;
    }

    // 2. SKU match — treat raw name as a potential SKU
    const skuKey = String(rawName).toLowerCase().trim();
    if (bySku.has(skuKey)) {
      matched.set(rawName, bySku.get(skuKey));
      continue;
    }

    // 3. sourceNames match
    if (bySourceName.has(normalized)) {
      matched.set(rawName, bySourceName.get(normalized));
      continue;
    }

    unmatched.push(rawName);
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  normalizeProductName,
  sanitizeProductName,
  extractVintage,
  buildNormalizedName,
  PRODUCT_FIELDS,
  clientExactMatch,
};
