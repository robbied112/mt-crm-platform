// Barrel re-exporter — all Cloud Functions for Firebase deploy
const { stripeWebhook } = require("./stripe");
const { aiMapper, aiIngest } = require("./ai");
const { rebuildViews } = require("./rebuild");
const { extractAccounts } = require("./accounts");
const { cloudSyncOAuthCallback, cloudSyncDisconnect, cloudSyncListFolders, cloudSyncSyncNow, scheduledCloudSync } = require("./sync");

exports.stripeWebhook = stripeWebhook;
exports.aiMapper = aiMapper;
exports.aiIngest = aiIngest;
exports.rebuildViews = rebuildViews;
exports.extractAccounts = extractAccounts;
exports.cloudSyncOAuthCallback = cloudSyncOAuthCallback;
exports.cloudSyncDisconnect = cloudSyncDisconnect;
exports.cloudSyncListFolders = cloudSyncListFolders;
exports.cloudSyncSyncNow = cloudSyncSyncNow;
exports.scheduledCloudSync = scheduledCloudSync;
