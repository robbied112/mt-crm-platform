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
  "spendByWine",
  "spendByDistributor",
  "billbackSummary",
];

const OBJECT_DATASETS = new Set([
  "pipelineMeta",
  "qbDistOrders",
  "acctConcentration",
  "billbackSummary",
]);

module.exports = {
  CHUNK_SIZE,
  DATASETS,
  OBJECT_DATASETS,
};
