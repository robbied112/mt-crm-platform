const CHUNK_SIZE = 500;

const DATASETS = [
  "distScorecard",
  "reorderData",
  "accountsTop",
  "pipelineAccounts",
  "pipelineMeta",
  "inventoryData",
  "newWins",
  "distHealth",
  "reEngagementData",
  "placementSummary",
  "qbDistOrders",
  "acctConcentration",
  "skuBreakdown",
  "spendByWine",
  "spendByDistributor",
  "billbackSummary",
  "revenueByChannel",
  "revenueByProduct",
  "revenueSummary",
  "arAgingSummary",
  "apAgingSummary",
];

const OBJECT_DATASETS = new Set([
  "pipelineMeta",
  "qbDistOrders",
  "acctConcentration",
  "billbackSummary",
  "revenueSummary",
  "arAgingSummary",
  "apAgingSummary",
]);

module.exports = {
  CHUNK_SIZE,
  DATASETS,
  OBJECT_DATASETS,
};
