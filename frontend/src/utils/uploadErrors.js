/**
 * uploadErrors — Structured error model for import flows.
 *
 * Every import error gets a type, user-friendly message, recovery hint,
 * and the step where it occurred. This enables:
 *   1. Consistent user-facing error messages
 *   2. Conversational error recovery (TODO-120) with structured input
 *   3. Logging with context (what was attempted, what failed)
 *
 * Usage:
 *   import { createUploadError, ERROR_TYPES } from "../utils/uploadErrors";
 *   throw createUploadError(ERROR_TYPES.PARSE_FAILED, "CSV has no headers", { fileName });
 */

export const ERROR_TYPES = {
  // File validation
  FILE_EMPTY: "file_empty",
  FILE_TOO_LARGE: "file_too_large",
  FILE_UNSUPPORTED: "file_unsupported",

  // Parsing
  PARSE_FAILED: "parse_failed",
  NO_DATA: "no_data",
  NO_HEADERS: "no_headers",

  // AI / Mapping
  AI_COMPREHEND_FAILED: "ai_comprehend_failed",
  AI_MAPPING_FAILED: "ai_mapping_failed",
  MAPPING_INCOMPLETE: "mapping_incomplete",

  // Transform / Preview
  TRANSFORM_FAILED: "transform_failed",
  PREVIEW_FAILED: "preview_failed",

  // Import / Save
  IMPORT_FAILED: "import_failed",
  PRODUCT_MATCH_FAILED: "product_match_failed",

  // Billback-specific
  BILLBACK_EXTRACT_FAILED: "billback_extract_failed",
  BILLBACK_NO_ITEMS: "billback_no_items",

  // Network / Infrastructure
  NETWORK_ERROR: "network_error",
  TIMEOUT: "timeout",
};

/**
 * Recovery hints per error type — what the user can do about it.
 */
const RECOVERY_HINTS = {
  [ERROR_TYPES.FILE_EMPTY]: "Try selecting a different file.",
  [ERROR_TYPES.FILE_TOO_LARGE]: "Try splitting the file or removing unnecessary columns.",
  [ERROR_TYPES.FILE_UNSUPPORTED]: "CruFolio supports .csv, .xlsx, .xls, and .tsv files.",
  [ERROR_TYPES.PARSE_FAILED]: "Make sure the file has a header row with column names.",
  [ERROR_TYPES.NO_DATA]: "The file appears to have headers but no data rows.",
  [ERROR_TYPES.NO_HEADERS]: "The file needs a header row so we can map your columns.",
  [ERROR_TYPES.AI_COMPREHEND_FAILED]: "We'll fall back to rule-based mapping. You may need to adjust a few columns.",
  [ERROR_TYPES.AI_MAPPING_FAILED]: "We'll use rule-based mapping instead. You can adjust columns manually.",
  [ERROR_TYPES.MAPPING_INCOMPLETE]: "Please map the required columns before proceeding.",
  [ERROR_TYPES.TRANSFORM_FAILED]: "Try adjusting your column mappings — some values may not match the expected format.",
  [ERROR_TYPES.PREVIEW_FAILED]: "We'll skip the preview and save your data directly.",
  [ERROR_TYPES.IMPORT_FAILED]: "Check your connection and try again.",
  [ERROR_TYPES.PRODUCT_MATCH_FAILED]: "Your data was imported successfully. Product matching can be done later from Portfolio.",
  [ERROR_TYPES.BILLBACK_EXTRACT_FAILED]: "Make sure this is a billback/depletion allowance PDF.",
  [ERROR_TYPES.BILLBACK_NO_ITEMS]: "No line items could be found. Try a different PDF.",
  [ERROR_TYPES.NETWORK_ERROR]: "Check your internet connection and try again.",
  [ERROR_TYPES.TIMEOUT]: "The operation took too long. Try with a smaller file or try again later.",
};

/**
 * Steps in the import flow — used for error context.
 */
export const IMPORT_STEPS = {
  VALIDATE: "validate",
  PARSE: "parse",
  COMPREHEND: "comprehend",
  MAP: "map",
  TRANSFORM: "transform",
  PREVIEW: "preview",
  SAVE: "save",
  MATCH: "match",
};

/**
 * Create a structured upload error.
 *
 * @param {string} type — one of ERROR_TYPES
 * @param {string} message — technical/specific message
 * @param {object} [context] — additional context (fileName, step, etc.)
 * @returns {object} { type, message, recoveryHint, step, context, timestamp }
 */
export function createUploadError(type, message, context = {}) {
  return {
    type: type || ERROR_TYPES.IMPORT_FAILED,
    message: message || "Something went wrong.",
    recoveryHint: RECOVERY_HINTS[type] || "Try again or contact support.",
    step: context.step || null,
    context,
    timestamp: Date.now(),
  };
}

/**
 * Format an upload error for user display.
 * Returns a plain string suitable for rendering in the UI.
 *
 * @param {object|string} error — structured error object or plain string
 * @returns {string}
 */
export function formatUploadError(error) {
  if (typeof error === "string") return error;
  if (!error) return "An unknown error occurred.";
  return error.message || "Something went wrong.";
}

/**
 * Get recovery hint for an error.
 *
 * @param {object|string} error — structured error object or plain string
 * @returns {string|null}
 */
export function getRecoveryHint(error) {
  if (typeof error === "string") return null;
  if (!error) return null;
  return error.recoveryHint || RECOVERY_HINTS[error.type] || null;
}
