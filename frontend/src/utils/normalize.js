/**
 * Normalize Layer — re-exports from shared pipeline package.
 * Core logic lives in packages/pipeline/src/normalize.js.
 */
export {
  normalizeRows,
  preserveRawRows,
  num,
  str,
  normalizeState,
  normalizeDate,
} from "../../../packages/pipeline/src/normalize.js";
