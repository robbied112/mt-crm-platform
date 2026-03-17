/**
 * Product Normalization — re-exports from shared pipeline package.
 * Core logic lives in packages/pipeline/src/productNormalize.js.
 */
export {
  normalizeProductName,
  sanitizeProductName,
  extractVintage,
  buildNormalizedName,
  clientExactMatch,
  PRODUCT_FIELDS,
} from "../../../packages/pipeline/src/productNormalize.js";
