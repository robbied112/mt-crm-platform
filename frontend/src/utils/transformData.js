/**
 * Transform Layer — re-exports from shared pipeline package.
 * Core logic lives in packages/pipeline/src/transformData.js.
 */
export {
  transformDepletion,
  transformPurchases,
  transformInventory,
  transformPipeline,
  transformQuickBooks,
  generateSummary,
  transformAll,
} from "../../../packages/pipeline/src/transformData.js";
