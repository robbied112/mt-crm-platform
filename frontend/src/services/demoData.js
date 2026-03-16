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
import {
  createAccount,
  createContact,
  logActivity,
  createTask,
} from "./crmService";

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

// ─── CRM Demo Data ──────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { name: "The Wine Bar NYC", type: "on-premise", licenseType: "restaurant", wineProgram: "sommelier-driven", buyerName: "Sarah Chen", buyerTitle: "Head Sommelier", btgProgram: true, distributorName: "Breakthru Beverage NY", city: "New York", state: "NY", region: "Northeast", tags: ["VIP", "Key Account"], status: "active", channel: "On-Premise" },
  { name: "Napa Valley Restaurant", type: "on-premise", licenseType: "restaurant", wineProgram: "strong", buyerName: "Marco Russo", buyerTitle: "Beverage Director", btgProgram: true, distributorName: "Southern Glazer's CA", city: "Napa", state: "CA", region: "West", tags: ["Key Account"], status: "active", channel: "On-Premise" },
  { name: "Manhattan Bistro", type: "on-premise", licenseType: "restaurant", wineProgram: "moderate", buyerName: "David Kim", buyerTitle: "General Manager", btgProgram: true, distributorName: "Breakthru Beverage NY", city: "New York", state: "NY", region: "Northeast", tags: ["At Risk"], status: "active", channel: "On-Premise" },
  { name: "Denver Wine Cellar", type: "off-premise", licenseType: "retail", wineProgram: "strong", buyerName: "Lisa Morales", buyerTitle: "Wine Buyer", btgProgram: false, distributorName: "Republic National CO", city: "Denver", state: "CO", region: "Mountain", tags: ["Hot Lead", "Expansion Target"], status: "active", channel: "Off-Premise" },
  { name: "Chicago Steakhouse", type: "on-premise", licenseType: "restaurant", wineProgram: "strong", buyerName: "Tom Walsh", buyerTitle: "Beverage Director", btgProgram: true, distributorName: "Young's Market IL", city: "Chicago", state: "IL", region: "Midwest", tags: ["Key Account"], status: "active", channel: "On-Premise" },
  { name: "LA Wine Lounge", type: "on-premise", licenseType: "bar", wineProgram: "sommelier-driven", buyerName: "Jessica Park", buyerTitle: "Sommelier", btgProgram: true, distributorName: "Southern Glazer's CA", city: "Los Angeles", state: "CA", region: "West", tags: ["VIP"], status: "active", channel: "On-Premise" },
  { name: "Brooklyn Wine Shop", type: "off-premise", licenseType: "retail", wineProgram: "strong", buyerName: "Mike Torres", buyerTitle: "Wine Buyer", btgProgram: false, distributorName: "Breakthru Beverage NY", city: "Brooklyn", state: "NY", region: "Northeast", tags: ["New"], status: "active", channel: "Off-Premise" },
  { name: "Aspen Fine Dining", type: "on-premise", licenseType: "restaurant", wineProgram: "sommelier-driven", buyerName: "Emily Richardson", buyerTitle: "Sommelier", btgProgram: true, distributorName: "Republic National CO", city: "Aspen", state: "CO", region: "Mountain", tags: ["VIP", "Seasonal"], status: "active", channel: "On-Premise" },
  { name: "Evanston Wine Bar", type: "on-premise", licenseType: "bar", wineProgram: "moderate", buyerName: "Ryan O'Brien", buyerTitle: "Owner", btgProgram: true, distributorName: "Young's Market IL", city: "Evanston", state: "IL", region: "Midwest", tags: [], status: "active", channel: "On-Premise" },
  { name: "SoHo Vintner", type: "off-premise", licenseType: "retail", wineProgram: "strong", buyerName: "Anna Petrov", buyerTitle: "Wine Buyer", btgProgram: false, distributorName: "Breakthru Beverage NY", city: "New York", state: "NY", region: "Northeast", tags: [], status: "active", channel: "Off-Premise" },
  { name: "SF Wine Merchant", type: "off-premise", licenseType: "retail", wineProgram: "strong", buyerName: "Chris Huang", buyerTitle: "Owner", btgProgram: false, distributorName: "Southern Glazer's CA", city: "San Francisco", state: "CA", region: "West", tags: ["Priority"], status: "active", channel: "Off-Premise" },
  { name: "Vail Resort Dining", type: "on-premise", licenseType: "hotel", wineProgram: "strong", buyerName: "Karen Brooks", buyerTitle: "F&B Director", btgProgram: true, distributorName: "Republic National CO", city: "Vail", state: "CO", region: "Mountain", tags: ["Seasonal", "VIP"], status: "active", channel: "On-Premise" },
  { name: "Tribeca Table", type: "on-premise", licenseType: "restaurant", wineProgram: "moderate", buyerName: "James Wright", buyerTitle: "GM", btgProgram: false, distributorName: "Breakthru Beverage NY", city: "New York", state: "NY", region: "Northeast", tags: [], status: "prospect", channel: "On-Premise" },
  { name: "Fort Collins Bistro", type: "on-premise", licenseType: "restaurant", wineProgram: "basic", buyerName: "Amy Chen", buyerTitle: "Owner", btgProgram: false, distributorName: "Republic National CO", city: "Fort Collins", state: "CO", region: "Mountain", tags: ["Needs Visit"], status: "prospect", channel: "On-Premise" },
  { name: "Oak Park Liquors", type: "off-premise", licenseType: "retail", wineProgram: "moderate", buyerName: "Dave Johnson", buyerTitle: "Purchasing Manager", btgProgram: false, distributorName: "Young's Market IL", city: "Oak Park", state: "IL", region: "Midwest", tags: ["At Risk", "Inactive"], status: "inactive", channel: "Off-Premise" },
];

const DEMO_CONTACTS = [
  { firstName: "Sarah", lastName: "Chen", title: "Head Sommelier", role: "sommelier", email: "sarah@winebarnyc.com", phone: "(212) 555-0101", preferredContact: "email", isPrimary: true, notes: "Prefers Burgundy and Rhone styles. Strong advocate for natural wines." },
  { firstName: "James", lastName: "Park", title: "General Manager", role: "gm", email: "james@winebarnyc.com", phone: "(212) 555-0102", preferredContact: "phone", isPrimary: false, notes: "" },
  { firstName: "Marco", lastName: "Russo", title: "Beverage Director", role: "beverage_director", email: "marco@napavalleyrest.com", phone: "(707) 555-0201", preferredContact: "email", isPrimary: true, notes: "Italian heritage, loves Nebbiolo. Decision maker for wine program." },
  { firstName: "David", lastName: "Kim", title: "General Manager", role: "gm", email: "david@manhattanbistro.com", phone: "(212) 555-0301", preferredContact: "phone", isPrimary: true, notes: "Wants to expand wine list but budget-conscious." },
  { firstName: "Lisa", lastName: "Morales", title: "Wine Buyer", role: "wine_buyer", email: "lisa@denverwinecellar.com", phone: "(303) 555-0401", preferredContact: "email", isPrimary: true, notes: "Loves our Pinot Noir. Looking for allocation of Cab." },
  { firstName: "Tom", lastName: "Walsh", title: "Beverage Director", role: "beverage_director", email: "tom@chicagosteakhouse.com", phone: "(312) 555-0501", preferredContact: "text", isPrimary: true, notes: "Prefers big reds. Cab and Pinot are his favorites." },
  { firstName: "Jessica", lastName: "Park", title: "Head Sommelier", role: "sommelier", email: "jessica@lawinelounge.com", phone: "(310) 555-0601", preferredContact: "email", isPrimary: true, notes: "Certified sommelier. Very influential in LA wine scene." },
  { firstName: "Mike", lastName: "Torres", title: "Wine Buyer", role: "wine_buyer", email: "mike@brooklynwineshop.com", phone: "(718) 555-0701", preferredContact: "email", isPrimary: true, notes: "New account. Excited about our rosé and SB." },
  { firstName: "Emily", lastName: "Richardson", title: "Sommelier", role: "sommelier", email: "emily@aspenfinedining.com", phone: "(970) 555-0801", preferredContact: "email", isPrimary: true, notes: "High-end clientele. Interested in reserve and library wines." },
  { firstName: "Karen", lastName: "Brooks", title: "F&B Director", role: "beverage_director", email: "karen@vailresort.com", phone: "(970) 555-1201", preferredContact: "email", isPrimary: true, notes: "Seasonal buyer. Big orders for ski season Dec-Mar." },
];

const DEMO_ACTIVITIES = [
  { type: "tasting", date: "2026-03-10", subject: "Spring allocation tasting", notes: "Presented 2022 Pinot Noir and 2023 Chardonnay. Sarah loved the Pinot — wants 6 cases. Interested in BTG for Chardonnay.", outcome: "positive", followUpDate: "2026-03-20", followUpAction: "Send Samples" },
  { type: "visit", date: "2026-03-08", subject: "Quarterly check-in", notes: "Menu refresh coming in April. Marco wants to see new vintages. Competitive wines on list from Oregon producer.", outcome: "neutral", followUpDate: "2026-03-22", followUpAction: "Schedule Tasting" },
  { type: "call", date: "2026-03-07", subject: "Re-engagement call", notes: "David mentioned they're considering reducing wine program. Budget pressures. Need to show value.", outcome: "negative", followUpDate: "2026-03-14", followUpAction: "Visit" },
  { type: "sample_drop", date: "2026-03-05", subject: "New vintage samples", notes: "Left 2 bottles of 2023 SB and 1 bottle of Rosé with Lisa. She'll taste with her team this week.", outcome: "positive" },
  { type: "wine_dinner", date: "2026-03-03", subject: "Winemaker dinner", notes: "Hosted 5-course dinner at Chicago Steakhouse. 24 guests. Tom ordered 12 cases of Cab after event.", outcome: "positive" },
  { type: "visit", date: "2026-03-01", subject: "New account intro", notes: "First visit to Brooklyn Wine Shop. Mike is expanding his selection. Wants to start with Rosé and SB.", outcome: "positive", followUpDate: "2026-03-15", followUpAction: "Send Samples" },
  { type: "staff_training", date: "2026-02-28", subject: "Staff wine training", notes: "Trained 8 servers on our portfolio. Jessica arranged private tasting room. Great engagement.", outcome: "positive" },
  { type: "tasting", date: "2026-02-25", subject: "Library wine tasting", notes: "Emily tasted 2019 and 2020 Cabs. Interested in 3 cases of each for resort cellar.", outcome: "positive", followUpDate: "2026-03-05", followUpAction: "Follow Up" },
  { type: "reorder_followup", date: "2026-02-22", subject: "Reorder check", notes: "Aspen running low on Chardonnay. Karen confirmed 10-case reorder through Republic National.", outcome: "positive" },
  { type: "email", date: "2026-02-20", subject: "Spring pricing update", notes: "Sent updated pricing and allocation info to all key accounts. 12 recipients.", outcome: "neutral" },
  { type: "menu_placement", date: "2026-02-18", subject: "BTG placement confirmed", notes: "Estate Cab added to by-the-glass menu at The Wine Bar NYC. 2-case weekly pull expected.", outcome: "positive" },
  { type: "visit", date: "2026-02-15", subject: "Account review", notes: "Reviewed sales data with SoHo Vintner. Steady performer. Anna wants to do a tasting event.", outcome: "positive", followUpDate: "2026-03-01", followUpAction: "Email" },
];

const DEMO_TASKS = [
  { title: "Follow up on Pinot tasting", description: "Sarah wants 6 cases of 2022 Pinot. Send allocation confirmation and pricing.", dueDate: "2026-03-20", priority: "high", status: "open" },
  { title: "Schedule Marco tasting", description: "Present new vintages for April menu refresh at Napa Valley Restaurant.", dueDate: "2026-03-22", priority: "high", status: "open" },
  { title: "Re-engagement visit — Manhattan Bistro", description: "David is considering reducing wine program. Need face-to-face meeting to show value.", dueDate: "2026-03-14", priority: "urgent", status: "open" },
  { title: "Send samples to Denver Wine Cellar", description: "Lisa wants to taste 2023 SB and Rosé with her team.", dueDate: "2026-03-15", priority: "medium", status: "open" },
  { title: "Process Brooklyn Wine Shop first order", description: "Mike wants to start with Rosé and SB. Coordinate with Breakthru.", dueDate: "2026-03-18", priority: "medium", status: "open" },
  { title: "Plan Vail ski season allocation", description: "Karen needs big order for Dec-Mar season. Review inventory with Republic National.", dueDate: "2026-03-25", priority: "medium", status: "open" },
  { title: "Follow up on Chicago winemaker dinner orders", description: "Tom ordered 12 cases of Cab after dinner. Confirm delivery.", dueDate: "2026-03-10", priority: "high", status: "completed" },
  { title: "Send spring pricing to all accounts", description: "Updated allocation and pricing for Q2.", dueDate: "2026-02-20", priority: "medium", status: "completed" },
  { title: "Staff training at LA Wine Lounge", description: "Train servers on full portfolio with Jessica.", dueDate: "2026-02-28", priority: "low", status: "completed" },
  { title: "Confirm BTG placement at Wine Bar NYC", description: "Estate Cab on BTG menu — confirm with Sarah.", dueDate: "2026-02-18", priority: "high", status: "completed" },
];

// ─── Seed & Clear ────────────────────────────────────────────────

async function seedCrmData(tenantId) {
  try {
    // Create accounts and map names to IDs for linking
    const acctIds = {};
    for (const acct of DEMO_ACCOUNTS) {
      const id = await createAccount(tenantId, acct);
      acctIds[acct.name] = id;
    }

    // Create contacts linked to accounts
    const acctNames = DEMO_ACCOUNTS.map((a) => a.name);
    for (let i = 0; i < DEMO_CONTACTS.length; i++) {
      const contact = DEMO_CONTACTS[i];
      // Link to matching account by index (first contacts map to first accounts)
      const acctName = acctNames[i] || acctNames[0];
      const accountId = acctIds[acctName] || "";
      await createContact(tenantId, { ...contact, accountId, accountName: acctName });
    }

    // Log activities linked to accounts
    for (let i = 0; i < DEMO_ACTIVITIES.length; i++) {
      const activity = DEMO_ACTIVITIES[i];
      const acctName = acctNames[i % acctNames.length];
      const accountId = acctIds[acctName] || "";
      await logActivity(tenantId, { ...activity, accountId, accountName: acctName, loggedByName: "Demo User" });
    }

    // Create tasks linked to accounts
    for (let i = 0; i < DEMO_TASKS.length; i++) {
      const task = DEMO_TASKS[i];
      const acctName = acctNames[i % acctNames.length];
      const accountId = acctIds[acctName] || "";
      await createTask(tenantId, { ...task, accountId, accountName: acctName });
    }
  } catch (err) {
    console.error("CRM demo seed error (non-blocking):", err);
  }
}

export async function seedDemoData(tenantId) {
  await Promise.all([
    saveAllDatasets(tenantId, DEMO_DATASETS),
    saveTenantConfig(tenantId, {
      demoData: true,
      companyName: "Vineyard Valley Wines",
    }),
    saveSummary(tenantId, DEMO_SUMMARY),
  ]);
  // Seed CRM data async (non-blocking — dashboard loads immediately)
  seedCrmData(tenantId);
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

  // Load all CRM docs so we can delete them
  const { loadAccounts, loadContacts, loadActivities, loadTasks } = await import("./crmService");
  const [accts, ctcts, acts, tsks] = await Promise.all([
    loadAccounts(tenantId),
    loadContacts(tenantId),
    loadActivities(tenantId),
    loadTasks(tenantId),
  ]);

  const { deleteAccount, deleteContact, deleteActivity, deleteTask } = await import("./crmService");

  await Promise.all([
    saveAllDatasets(tenantId, emptyDatasets),
    saveTenantConfig(tenantId, {
      demoData: false,
      companyName: "",
    }),
    saveSummary(tenantId, ""),
    ...accts.map((a) => deleteAccount(tenantId, a.id)),
    ...ctcts.map((c) => deleteContact(tenantId, c.id)),
    ...acts.map((a) => deleteActivity(tenantId, a.id)),
    ...tsks.map((t) => deleteTask(tenantId, t.id)),
  ]);
}

export { DEMO_DATASETS, DEMO_SUMMARY };
