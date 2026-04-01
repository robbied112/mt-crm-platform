// Barrel re-exporter — all Cloud Functions for Firebase deploy
const { stripeWebhook } = require("./stripe");
const { aiMapper, aiIngest, generateImportNarration } = require("./ai");
const { rebuildViews } = require("./rebuild");
// generateBriefing is called inline from rebuild.js, not exported as a Cloud Function
const { extractAccounts } = require("./accounts");
const {
  cloudSyncOAuthCallback,
  cloudSyncDisconnect,
  cloudSyncListFolders,
  cloudSyncSyncNow,
  scheduledCloudSync,
} = require("./sync");
const { parseBillbackPDF, extractWines } = require("./billback");
const { matchProductsFromImport } = require("./productMatch");
const { migrateWinesToProducts } = require("./migration");
const {
  onSkuCreated, onSkuDeleted,
  onMasterProductCreated, onMasterProductDeleted,
} = require("./productTriggers");
const { comprehendReport, generateIntegrationPlan } = require("./comprehend");
const {
  createCheckoutSession,
  verifyCheckoutSession,
  createBillingPortalSession,
} = require("./billing");
const { validateInvite, joinTeam } = require("./team");
const { sendInviteEmail } = require("./email");
const { analyzeUpload } = require("./analyzeUpload");
const { generateWeeklyDigest } = require("./digest");

exports.stripeWebhook = stripeWebhook;
exports.aiMapper = aiMapper;
exports.aiIngest = aiIngest;
exports.generateImportNarration = generateImportNarration;
exports.rebuildViews = rebuildViews;
exports.extractAccounts = extractAccounts;
exports.cloudSyncOAuthCallback = cloudSyncOAuthCallback;
exports.cloudSyncDisconnect = cloudSyncDisconnect;
exports.cloudSyncListFolders = cloudSyncListFolders;
exports.cloudSyncSyncNow = cloudSyncSyncNow;
exports.scheduledCloudSync = scheduledCloudSync;
exports.parseBillbackPDF = parseBillbackPDF;
exports.extractWines = extractWines;
exports.matchProductsFromImport = matchProductsFromImport;
exports.migrateWinesToProducts = migrateWinesToProducts;
exports.comprehendReport = comprehendReport;
exports.generateIntegrationPlan = generateIntegrationPlan;
exports.createCheckoutSession = createCheckoutSession;
exports.verifyCheckoutSession = verifyCheckoutSession;
exports.createBillingPortalSession = createBillingPortalSession;
exports.validateInvite = validateInvite;
exports.joinTeam = joinTeam;
exports.sendInviteEmail = sendInviteEmail;
exports.analyzeUpload = analyzeUpload;
exports.onSkuCreated = onSkuCreated;
exports.onSkuDeleted = onSkuDeleted;
exports.onMasterProductCreated = onMasterProductCreated;
exports.onMasterProductDeleted = onMasterProductDeleted;
exports.generateWeeklyDigest = generateWeeklyDigest;
