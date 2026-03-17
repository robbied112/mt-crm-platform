/**
 * Shared pipeline package — barrel export.
 *
 * Used by both frontend (via Vite CJS interop) and
 * Cloud Functions (copied to functions/lib/pipeline/ by predeploy).
 */

const parseFile = require("./parseFile");
const transformData = require("./transformData");
const extractData = require("./extractData");
const transformBillback = require("./transformBillback");
const transformRevenue = require("./transformRevenue");
const transformArAp = require("./transformArAp");
const semanticMapper = require("./semanticMapper");
const normalize = require("./normalize");
const constants = require("./constants");
const firestore = require("./firestore");

module.exports = {
  // parseFile
  findHeaderRow: parseFile.findHeaderRow,
  cleanHeaders: parseFile.cleanHeaders,
  detectGroupedFormat: parseFile.detectGroupedFormat,
  processGroupedRows: parseFile.processGroupedRows,
  processStandardRows: parseFile.processStandardRows,
  parseFileBuffer: parseFile.parseFileBuffer,
  parseRawRows: parseFile.parseRawRows,
  getSheetNames: parseFile.getSheetNames,

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

  // transformRevenue
  transformRevenue: transformRevenue.transformRevenue,
  CHANNELS: transformRevenue.CHANNELS,
  CHANNEL_VALUES: transformRevenue.CHANNEL_VALUES,

  // transformArAp
  transformArAp: transformArAp.transformArAp,

  // normalize
  normalizeRows: normalize.normalizeRows,

  // constants
  CHUNK_SIZE: constants.CHUNK_SIZE,
  DATASETS: constants.DATASETS,
  OBJECT_DATASETS: constants.OBJECT_DATASETS,

  // extractData
  extractData: extractData.extractData,
  flattenPivot: extractData.flattenPivot,
  applySkipPatterns: extractData.applySkipPatterns,
  applyColumnMapping: extractData.applyColumnMapping,

  // firestore
  writeChunked: firestore.writeChunked,
  readChunked: firestore.readChunked,
  createModularFirestoreAdapter: firestore.createModularFirestoreAdapter,
  createAdminFirestoreAdapter: firestore.createAdminFirestoreAdapter,
};
