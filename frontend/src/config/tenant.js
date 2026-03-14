/**
 * Tenant Configuration
 * Extracted from index.html TENANT_CONFIG object.
 * Phase 2: this will be loaded from Firestore at tenants/{tenantId}/config
 */

const TENANT_CONFIG = {
  tenantId: "default",
  userRole: "supplier",  // "supplier" | "distributor"
  companyName: "",
  logo: "",
  primaryColor: "#0F766E",
  accentColor: "#14B8A6",
  stateNames: {},
  regionMap: {},
  channels: [],
  pipelineStages: [
    "Lead",
    "Contacted",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost",
  ],
  pipelineTiers: ["Tier 1", "Tier 2", "Tier 3"],
  scoringWeights: {
    velocity: 0.3,
    momentum: 0.2,
    sellThru: 0.15,
    accountCount: 0.15,
    inventoryHealth: 0.2,
  },
  productCatalog: [],
  productLines: [],
  productUnit: "cases",
  terminology: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Distributor",
    account: "Account",
    depletion: "Depletion",
  },
  tags: [
    "VIP",
    "At Risk",
    "Hot Lead",
    "Needs Visit",
    "New",
    "Inactive",
    "Priority",
    "Seasonal",
    "Key Account",
    "Expansion Target",
  ],
  nextActions: [
    "Call",
    "Email",
    "Visit",
    "Send Samples",
    "Follow Up",
    "Reorder Check",
  ],
  features: {
    fileAttachments: true,
    emailLogging: true,
    activityTimeline: true,
    pipeline: true,
    distributorHealth: true,
    reorderForecast: true,
  },
};

export default TENANT_CONFIG;
