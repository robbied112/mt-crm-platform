/**
 * Demo Data — pre-computed datasets for new signups.
 *
 * Seeds realistic wine/spirits data so every dashboard tab is
 * immediately populated. Cleared automatically when the user
 * uploads real data.
 */
import {
  saveAllDatasets,
  saveTenantConfig,
  saveSummary,
} from "./firestoreService";

// ─── Demo Datasets ──────────────────────────────────────────────

const distScorecard = [
  { name: "Breakthru Beverage NY", state: "NY", region: "Northeast", totalCases: 1240, totalRevenue: 148800, accounts: 42, activeSKUs: 5, depletionTrend: 8.2, avgCasePrice: 120 },
  { name: "Southern Glazer's CA", state: "CA", region: "West", totalCases: 980, totalRevenue: 127400, accounts: 38, activeSKUs: 5, depletionTrend: -2.1, avgCasePrice: 130 },
  { name: "Republic National CO", state: "CO", region: "Mountain", totalCases: 620, totalRevenue: 74400, accounts: 24, activeSKUs: 4, depletionTrend: 12.5, avgCasePrice: 120 },
  { name: "Young's Market IL", state: "IL", region: "Midwest", totalCases: 450, totalRevenue: 49500, accounts: 18, activeSKUs: 3, depletionTrend: 5.7, avgCasePrice: 110 },
];

const reorderData = [
  { account: "The Wine Bar NYC", distributor: "Breakthru Beverage NY", lastOrder: "2026-02-10", avgIntervalDays: 28, predictedReorder: "2026-03-10", daysPastDue: 5, cases: 12, revenue: 1440 },
  { account: "Napa Valley Restaurant", distributor: "Southern Glazer's CA", lastOrder: "2026-01-28", avgIntervalDays: 35, predictedReorder: "2026-03-04", daysPastDue: 11, cases: 8, revenue: 1040 },
  { account: "Boulder Wine Co", distributor: "Republic National CO", lastOrder: "2026-02-20", avgIntervalDays: 21, predictedReorder: "2026-03-13", daysPastDue: 2, cases: 6, revenue: 720 },
  { account: "Chicago Steakhouse", distributor: "Young's Market IL", lastOrder: "2026-02-15", avgIntervalDays: 30, predictedReorder: "2026-03-17", daysPastDue: 0, cases: 10, revenue: 1100 },
  { account: "Manhattan Bistro", distributor: "Breakthru Beverage NY", lastOrder: "2026-01-15", avgIntervalDays: 42, predictedReorder: "2026-02-26", daysPastDue: 17, cases: 15, revenue: 1800 },
];

const accountsTop = [
  { name: "The Wine Bar NYC", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 180, totalRevenue: 21600, orderCount: 6, avgOrderSize: 30, trend: 15.3, rank: 1 },
  { name: "Napa Valley Restaurant", distributor: "Southern Glazer's CA", state: "CA", totalCases: 145, totalRevenue: 18850, orderCount: 5, avgOrderSize: 29, trend: 8.1, rank: 2 },
  { name: "Manhattan Bistro", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 132, totalRevenue: 15840, orderCount: 4, avgOrderSize: 33, trend: -3.2, rank: 3 },
  { name: "Denver Wine Cellar", distributor: "Republic National CO", state: "CO", totalCases: 120, totalRevenue: 14400, orderCount: 5, avgOrderSize: 24, trend: 22.4, rank: 4 },
  { name: "Chicago Steakhouse", distributor: "Young's Market IL", state: "IL", totalCases: 110, totalRevenue: 12100, orderCount: 4, avgOrderSize: 27.5, trend: 6.8, rank: 5 },
  { name: "LA Wine Lounge", distributor: "Southern Glazer's CA", state: "CA", totalCases: 98, totalRevenue: 12740, orderCount: 4, avgOrderSize: 24.5, trend: -1.5, rank: 6 },
  { name: "Brooklyn Wine Shop", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 95, totalRevenue: 11400, orderCount: 5, avgOrderSize: 19, trend: 10.2, rank: 7 },
  { name: "Aspen Fine Dining", distributor: "Republic National CO", state: "CO", totalCases: 88, totalRevenue: 10560, orderCount: 3, avgOrderSize: 29.3, trend: 18.9, rank: 8 },
  { name: "Evanston Wine Bar", distributor: "Young's Market IL", state: "IL", totalCases: 75, totalRevenue: 8250, orderCount: 3, avgOrderSize: 25, trend: 4.1, rank: 9 },
  { name: "SoHo Vintner", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 72, totalRevenue: 8640, orderCount: 3, avgOrderSize: 24, trend: 0.5, rank: 10 },
  { name: "SF Wine Merchant", distributor: "Southern Glazer's CA", state: "CA", totalCases: 68, totalRevenue: 8840, orderCount: 3, avgOrderSize: 22.7, trend: 7.3, rank: 11 },
  { name: "Vail Resort Dining", distributor: "Republic National CO", state: "CO", totalCases: 62, totalRevenue: 7440, orderCount: 2, avgOrderSize: 31, trend: 25.0, rank: 12 },
  { name: "Oak Park Liquors", distributor: "Young's Market IL", state: "IL", totalCases: 58, totalRevenue: 6380, orderCount: 2, avgOrderSize: 29, trend: -5.2, rank: 13 },
  { name: "Tribeca Table", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 55, totalRevenue: 6600, orderCount: 2, avgOrderSize: 27.5, trend: 12.0, rank: 14 },
  { name: "Pasadena Cellar", distributor: "Southern Glazer's CA", state: "CA", totalCases: 52, totalRevenue: 6760, orderCount: 2, avgOrderSize: 26, trend: 3.4, rank: 15 },
  { name: "Fort Collins Bistro", distributor: "Republic National CO", state: "CO", totalCases: 48, totalRevenue: 5760, orderCount: 2, avgOrderSize: 24, trend: 9.8, rank: 16 },
  { name: "Lincoln Park Wine", distributor: "Young's Market IL", state: "IL", totalCases: 45, totalRevenue: 4950, orderCount: 2, avgOrderSize: 22.5, trend: 1.3, rank: 17 },
  { name: "Upper East Side Wine", distributor: "Breakthru Beverage NY", state: "NY", totalCases: 42, totalRevenue: 5040, orderCount: 2, avgOrderSize: 21, trend: 7.8, rank: 18 },
  { name: "San Diego Wine House", distributor: "Southern Glazer's CA", state: "CA", totalCases: 38, totalRevenue: 4940, orderCount: 1, avgOrderSize: 38, trend: 0.0, rank: 19 },
  { name: "Naperville Grille", distributor: "Young's Market IL", state: "IL", totalCases: 35, totalRevenue: 3850, orderCount: 1, avgOrderSize: 35, trend: 0.0, rank: 20 },
];

const pipelineAccounts = [
  { name: "Eleven Madison Park", stage: "Proposal Sent", distributor: "Breakthru Beverage NY", state: "NY", estimatedCases: 60, estimatedRevenue: 9000, probability: 0.75, nextStep: "Follow up on tasting", daysInStage: 8 },
  { name: "The French Laundry", stage: "Tasting Scheduled", distributor: "Southern Glazer's CA", state: "CA", estimatedCases: 45, estimatedRevenue: 7200, probability: 0.60, nextStep: "Prepare tasting kit", daysInStage: 3 },
  { name: "Alinea", stage: "Initial Contact", distributor: "Young's Market IL", state: "IL", estimatedCases: 35, estimatedRevenue: 4200, probability: 0.30, nextStep: "Schedule intro call", daysInStage: 12 },
  { name: "Frasca Food & Wine", stage: "Negotiation", distributor: "Republic National CO", state: "CO", estimatedCases: 25, estimatedRevenue: 3750, probability: 0.85, nextStep: "Finalize pricing", daysInStage: 5 },
  { name: "Le Bernardin", stage: "Proposal Sent", distributor: "Breakthru Beverage NY", state: "NY", estimatedCases: 50, estimatedRevenue: 7500, probability: 0.65, nextStep: "Awaiting decision", daysInStage: 14 },
  { name: "Meadowood", stage: "Won", distributor: "Southern Glazer's CA", state: "CA", estimatedCases: 30, estimatedRevenue: 4500, probability: 1.0, nextStep: "First order placed", daysInStage: 0 },
  { name: "Flagstaff House", stage: "Tasting Scheduled", distributor: "Republic National CO", state: "CO", estimatedCases: 20, estimatedRevenue: 3000, probability: 0.55, nextStep: "Tasting next week", daysInStage: 6 },
  { name: "Girl & The Goat", stage: "Lost", distributor: "Young's Market IL", state: "IL", estimatedCases: 0, estimatedRevenue: 0, probability: 0, nextStep: "Re-engage in Q3", daysInStage: 30 },
];

const pipelineMeta = {
  totalDeals: 8,
  totalEstimatedRevenue: 39150,
  weightedRevenue: 26295,
  stages: {
    "Initial Contact": 1,
    "Tasting Scheduled": 2,
    "Proposal Sent": 2,
    "Negotiation": 1,
    "Won": 1,
    "Lost": 1,
  },
  avgDaysInPipeline: 9.75,
};

const inventoryData = [
  { sku: "VVW-CAB-2022", product: "Estate Cabernet 2022", distributor: "Breakthru Beverage NY", state: "NY", onHand: 340, committed: 45, available: 295, depletionRate: 52, weeksOfSupply: 5.7 },
  { sku: "VVW-CAB-2022", product: "Estate Cabernet 2022", distributor: "Southern Glazer's CA", state: "CA", onHand: 280, committed: 30, available: 250, depletionRate: 40, weeksOfSupply: 6.3 },
  { sku: "VVW-CAB-2022", product: "Estate Cabernet 2022", distributor: "Republic National CO", state: "CO", onHand: 150, committed: 20, available: 130, depletionRate: 25, weeksOfSupply: 5.2 },
  { sku: "VVW-CHARD-2023", product: "Reserve Chardonnay 2023", distributor: "Breakthru Beverage NY", state: "NY", onHand: 420, committed: 60, available: 360, depletionRate: 65, weeksOfSupply: 5.5 },
  { sku: "VVW-CHARD-2023", product: "Reserve Chardonnay 2023", distributor: "Southern Glazer's CA", state: "CA", onHand: 310, committed: 40, available: 270, depletionRate: 48, weeksOfSupply: 5.6 },
  { sku: "VVW-CHARD-2023", product: "Reserve Chardonnay 2023", distributor: "Young's Market IL", state: "IL", onHand: 180, committed: 25, available: 155, depletionRate: 22, weeksOfSupply: 7.0 },
  { sku: "VVW-PN-2022", product: "Pinot Noir 2022", distributor: "Breakthru Beverage NY", state: "NY", onHand: 200, committed: 35, available: 165, depletionRate: 38, weeksOfSupply: 4.3 },
  { sku: "VVW-PN-2022", product: "Pinot Noir 2022", distributor: "Southern Glazer's CA", state: "CA", onHand: 260, committed: 25, available: 235, depletionRate: 35, weeksOfSupply: 6.7 },
  { sku: "VVW-PN-2022", product: "Pinot Noir 2022", distributor: "Republic National CO", state: "CO", onHand: 120, committed: 15, available: 105, depletionRate: 18, weeksOfSupply: 5.8 },
  { sku: "VVW-SB-2023", product: "Sauvignon Blanc 2023", distributor: "Breakthru Beverage NY", state: "NY", onHand: 380, committed: 50, available: 330, depletionRate: 55, weeksOfSupply: 6.0 },
  { sku: "VVW-SB-2023", product: "Sauvignon Blanc 2023", distributor: "Southern Glazer's CA", state: "CA", onHand: 290, committed: 35, available: 255, depletionRate: 42, weeksOfSupply: 6.1 },
  { sku: "VVW-SB-2023", product: "Sauvignon Blanc 2023", distributor: "Young's Market IL", state: "IL", onHand: 160, committed: 20, available: 140, depletionRate: 20, weeksOfSupply: 7.0 },
  { sku: "VVW-RSE-2023", product: "Dry Rosé 2023", distributor: "Breakthru Beverage NY", state: "NY", onHand: 250, committed: 40, available: 210, depletionRate: 45, weeksOfSupply: 4.7 },
  { sku: "VVW-RSE-2023", product: "Dry Rosé 2023", distributor: "Republic National CO", state: "CO", onHand: 100, committed: 10, available: 90, depletionRate: 15, weeksOfSupply: 6.0 },
];

const newWins = [
  { account: "Meadowood", distributor: "Southern Glazer's CA", state: "CA", firstOrderDate: "2026-03-01", cases: 30, revenue: 4500 },
  { account: "Denver Wine Cellar", distributor: "Republic National CO", state: "CO", firstOrderDate: "2026-02-15", cases: 24, revenue: 2880 },
  { account: "Brooklyn Wine Shop", distributor: "Breakthru Beverage NY", state: "NY", firstOrderDate: "2026-01-20", cases: 18, revenue: 2160 },
];

const distHealth = [
  { distributor: "Breakthru Beverage NY", state: "NY", totalSKUs: 5, activeSKUs: 5, accountsPenetrated: 42, totalAccounts: 65, penetrationRate: 64.6, inventoryHealth: "Good", avgDaysToDepletion: 38 },
  { distributor: "Southern Glazer's CA", state: "CA", totalSKUs: 5, activeSKUs: 5, accountsPenetrated: 38, totalAccounts: 72, penetrationRate: 52.8, inventoryHealth: "Good", avgDaysToDepletion: 43 },
  { distributor: "Republic National CO", state: "CO", totalSKUs: 4, activeSKUs: 4, accountsPenetrated: 24, totalAccounts: 40, penetrationRate: 60.0, inventoryHealth: "Watch", avgDaysToDepletion: 36 },
  { distributor: "Young's Market IL", state: "IL", totalSKUs: 3, activeSKUs: 3, accountsPenetrated: 18, totalAccounts: 35, penetrationRate: 51.4, inventoryHealth: "Good", avgDaysToDepletion: 48 },
];

const reEngagementData = [
  { account: "Manhattan Bistro", distributor: "Breakthru Beverage NY", state: "NY", lastOrder: "2026-01-15", daysSinceOrder: 59, previousCases: 33, risk: "High" },
  { account: "Oak Park Liquors", distributor: "Young's Market IL", state: "IL", lastOrder: "2026-01-08", daysSinceOrder: 66, previousCases: 29, risk: "High" },
  { account: "Pasadena Cellar", distributor: "Southern Glazer's CA", state: "CA", lastOrder: "2026-01-22", daysSinceOrder: 52, previousCases: 26, risk: "Medium" },
];

const placementSummary = [
  { product: "Estate Cabernet 2022", totalAccounts: 52, onPremise: 34, offPremise: 18, newPlacements: 5, lostPlacements: 1, netChange: 4 },
  { product: "Reserve Chardonnay 2023", totalAccounts: 48, onPremise: 30, offPremise: 18, newPlacements: 7, lostPlacements: 2, netChange: 5 },
  { product: "Pinot Noir 2022", totalAccounts: 40, onPremise: 28, offPremise: 12, newPlacements: 3, lostPlacements: 0, netChange: 3 },
  { product: "Sauvignon Blanc 2023", totalAccounts: 45, onPremise: 22, offPremise: 23, newPlacements: 8, lostPlacements: 3, netChange: 5 },
  { product: "Dry Rosé 2023", totalAccounts: 30, onPremise: 20, offPremise: 10, newPlacements: 6, lostPlacements: 1, netChange: 5 },
];

const qbDistOrders = {
  totalOrders: 47,
  totalRevenue: 400100,
  avgOrderValue: 8513,
  topDistributor: "Breakthru Beverage NY",
  byDistributor: {
    "Breakthru Beverage NY": { orders: 18, revenue: 148800 },
    "Southern Glazer's CA": { orders: 14, revenue: 127400 },
    "Republic National CO": { orders: 9, revenue: 74400 },
    "Young's Market IL": { orders: 6, revenue: 49500 },
  },
};

const acctConcentration = {
  top5Pct: 38.2,
  top10Pct: 56.8,
  top20Pct: 78.4,
  herfindahlIndex: 0.068,
  riskLevel: "Moderate",
  totalAccounts: 20,
};

const DEMO_SUMMARY =
  "Vineyard Valley Wines — 4 distributors across NY, CA, CO, IL. " +
  "3,290 total cases depleted, $400.1K revenue. " +
  "Breakthru Beverage NY leads at 1,240 cases (+8.2% trend). " +
  "8 pipeline deals worth $39.2K (weighted $26.3K). " +
  "3 re-engagement accounts need attention. 5 products placed across 122 accounts.";

// ─── All 12 datasets ─────────────────────────────────────────────

const DEMO_DATASETS = {
  distScorecard,
  reorderData,
  accountsTop,
  pipelineAccounts,
  pipelineMeta,
  inventoryData,
  newWins,
  distHealth,
  reEngagementData,
  placementSummary,
  qbDistOrders,
  acctConcentration,
};

// ─── Seed & Clear ────────────────────────────────────────────────

export async function seedDemoData(tenantId) {
  await Promise.all([
    saveAllDatasets(tenantId, DEMO_DATASETS),
    saveTenantConfig(tenantId, {
      demoData: true,
      companyName: "Vineyard Valley Wines",
    }),
    saveSummary(tenantId, DEMO_SUMMARY),
  ]);
}

export async function clearDemoData(tenantId) {
  const emptyDatasets = {};
  for (const key of Object.keys(DEMO_DATASETS)) {
    if (Array.isArray(DEMO_DATASETS[key])) {
      emptyDatasets[key] = [];
    } else {
      emptyDatasets[key] = {};
    }
  }

  await Promise.all([
    saveAllDatasets(tenantId, emptyDatasets),
    saveTenantConfig(tenantId, {
      demoData: false,
      companyName: "",
    }),
    saveSummary(tenantId, ""),
  ]);
}

export { DEMO_DATASETS, DEMO_SUMMARY };
