/**
 * Shared pipeline package — barrel export.
 *
 * Used by both frontend (via Vite CJS interop) and
 * Cloud Functions (copied to functions/lib/pipeline/ by predeploy).
 */

const parseFile = require("./parseFile");
const transformData = require("./transformData");
const transformBillback = require("./transformBillback");
const semanticMapper = require("./semanticMapper");
const normalize = require("./normalize");

module.exports = {
  // parseFile
  findHeaderRow: parseFile.findHeaderRow,
  cleanHeaders: parseFile.cleanHeaders,
  detectGroupedFormat: parseFile.detectGroupedFormat,
  processGroupedRows: parseFile.processGroupedRows,
  processStandardRows: parseFile.processStandardRows,
  parseFileBuffer: parseFile.parseFileBuffer,
  parseRawRows: parseFile.parseRawRows,

  // transformData
  transformDepletion: transformData.transformDepletion,
  transformPurchases: transformData.transformPurchases,
  transformInventory: transformData.transformInventory,
  transformPipeline: transformData.transformPipeline,
  transformQuickBooks: transformData.transformQuickBooks,
  generateSummary: transformData.generateSummary,
  transformAll: transformData.transformAll,

  // semanticMapper
  FIELD_DEFS: semanticMapper.FIELD_DEFS,
  ROLE_FIELD_OVERRIDES: semanticMapper.ROLE_FIELD_OVERRIDES,
  getFieldDefs: semanticMapper.getFieldDefs,
  autoDetectMapping: semanticMapper.autoDetectMapping,
  detectQuickBooksFormat: semanticMapper.detectQuickBooksFormat,
  detectUploadType: semanticMapper.detectUploadType,

  // transformBillback
  transformBillback: transformBillback.transformBillback,

  // normalize
  normalizeRows: normalize.normalizeRows,
};
