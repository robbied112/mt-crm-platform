/**
 * Tenant Configuration
 * Extracted from index.html TENANT_CONFIG object.
 * Phase 2: this will be loaded from Firestore at tenants/{tenantId}/config
 */

const TENANT_CONFIG = {
  tenantId: "default",
  userRole: "supplier",  // "winery" | "importer" | "distributor" | "retailer" (legacy: "supplier" = "winery")
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
    "Schedule Tasting",
    "Staff Training",
  ],
  accountTypes: ["on-premise", "off-premise", "hybrid"],
  licenseTypes: ["restaurant", "bar", "retail", "hotel", "club", "other"],
  wineProgramLevels: ["none", "basic", "moderate", "strong", "sommelier-driven"],
  contactRoles: [
    "sommelier", "beverage_director", "wine_buyer",
    "gm", "owner", "bar_manager", "purchasing", "other",
  ],
  activityTypes: [
    "call", "email", "visit", "tasting", "sample_drop",
    "menu_placement", "wine_dinner", "staff_training",
    "reorder_followup", "note",
  ],
  opportunityTypes: [
    {
      key: "new_placement",
      label: "New Placement",
      stages: ["Identified", "Outreach", "Meeting", "Tasting", "Proposal", "Won", "Lost"],
      defaultValue: 2500,
    },
    {
      key: "btg_program",
      label: "BTG Program",
      stages: ["Identified", "Tasting", "Menu Trial", "Confirmed", "Won", "Lost"],
      defaultValue: 4000,
    },
    {
      key: "wine_dinner",
      label: "Wine Dinner",
      stages: ["Pitched", "Menu Planning", "Confirmed", "Executed", "Won", "Lost"],
      defaultValue: 1500,
    },
    {
      key: "list_expansion",
      label: "List Expansion",
      stages: ["Identified", "Samples Sent", "Tasting", "Approved", "Won", "Lost"],
      defaultValue: 3000,
    },
    {
      key: "reorder",
      label: "Reorder / Restock",
      stages: ["Contacted", "Confirmed", "Won", "Lost"],
      defaultValue: 1000,
    },
    {
      key: "staff_training",
      label: "Staff Training",
      stages: ["Proposed", "Scheduled", "Completed"],
      defaultValue: 0,
    },
    {
      key: "seasonal",
      label: "Seasonal Program",
      stages: ["Pitched", "Tasting", "Menu Approved", "Won", "Lost"],
      defaultValue: 2000,
    },
  ],
  useNormalizedModel: false, // Feature flag: imports/ + views/ schema (TODO-021)
  features: {
    fileAttachments: true,
    emailLogging: true,
    activityTimeline: true,
    pipeline: true,
    distributorHealth: true,
    reorderForecast: true,
    billbacks: false,
  },
};

export default TENANT_CONFIG;
