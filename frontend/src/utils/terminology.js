/**
 * Terminology helper — returns tenant-specific labels with fallbacks.
 * Role-aware: swaps "Distributor"/"Account" labels based on userRole.
 *
 * Supplier view:  dist = Distributor, acct = Account
 * Distributor view: dist = Supplier, acct = Store
 */

import TENANT_CONFIG from "../config/tenant";

const ROLE_DEFAULTS = {
  supplier: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Distributor",
    account: "Account",
    depletion: "Depletion",
    healthTab: "Distributor Health",
    selectEntity: "Select Distributor",
    chooseEntity: "Choose a distributor",
    purchaseLabel: "Distributor Purchases",
    entityScorecard: "Distributor Scorecard",
    noEntityData: "No Distributor Data",
    uploadEntityHint: "Upload distributor health data to populate this view.",
    reEngageDescription: "These accounts previously carried your products and represent warm leads for reconnection. Focus outreach here for highest conversion probability.",
    newWinsDescription: "Recent new accounts — momentum builders for the brand. Ensure proper stocking and distributor support.",
    netPlacementTitle: "Net Placement Activity by Distributor",
    uploadHint: "Upload your distributor and sales data files. The system will automatically detect the format and map columns.",
  },
  distributor: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Supplier",
    account: "Store",
    depletion: "Sell-Through",
    healthTab: "Supplier Health",
    selectEntity: "Select Supplier",
    chooseEntity: "Choose a supplier",
    purchaseLabel: "Supplier Orders",
    entityScorecard: "Supplier Scorecard",
    noEntityData: "No Supplier Data",
    uploadEntityHint: "Upload supplier data to populate this view.",
    reEngageDescription: "These stores previously stocked products from these suppliers and represent warm leads for restocking. Prioritize outreach here for the highest reorder probability.",
    newWinsDescription: "Recently onboarded supplier products — momentum builders for your portfolio. Ensure proper shelf space and inventory levels.",
    netPlacementTitle: "Net Placement Activity by Supplier",
    uploadHint: "Upload your supplier and inventory data files. The system will automatically detect the format and map columns.",
  },
};

/**
 * Get the tenant-specific term for a given key.
 * Checks tenant overrides first, then role-specific defaults.
 *
 * @param {string} key - Term key (e.g., "distributor", "account", "healthTab")
 * @returns {string}
 */
export function t(key) {
  // Tenant-level overrides always win
  const terms = TENANT_CONFIG.terminology || {};
  if (terms[key]) return terms[key];

  // Role-specific defaults
  const role = TENANT_CONFIG.userRole || "supplier";
  const roleDefaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.supplier;
  return roleDefaults[key] || key;
}

/**
 * Get the current user role.
 * @returns {"supplier" | "distributor"}
 */
export function getUserRole() {
  return TENANT_CONFIG.userRole || "supplier";
}
