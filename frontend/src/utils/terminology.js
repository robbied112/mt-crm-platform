/**
 * Terminology helper — returns tenant-specific labels with fallbacks.
 * Role-aware: swaps "Distributor"/"Account" labels based on userRole.
 *
 * Supplier view:  dist = Distributor, acct = Account
 * Distributor view: dist = Supplier, acct = Store
 *
 * Two usage patterns:
 *   1. React components: useTerminology() hook — triggers re-renders on role change
 *   2. Non-React code:   t(key) — reads current role (updated by DataContext)
 */

import { useCallback } from "react";
import { useData } from "../context/DataContext";
import TENANT_CONFIG from "../config/tenant";

export const ROLE_DEFAULTS = {
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
 * Resolve a terminology key for a given role and overrides.
 */
function resolve(key, role, termOverrides) {
  if (termOverrides?.[key]) return termOverrides[key];
  const roleDefaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.supplier;
  return roleDefaults[key] || key;
}

/**
 * Static t() — reads from TENANT_CONFIG (updated by DataContext on role change).
 * Use in non-React code (transforms, scripts). For React components, prefer useTerminology().
 */
export function t(key) {
  const terms = TENANT_CONFIG.terminology || {};
  const role = TENANT_CONFIG.userRole || "supplier";
  return resolve(key, role, terms);
}

/**
 * Get the current user role from static config.
 */
export function getUserRole() {
  return TENANT_CONFIG.userRole || "supplier";
}

/**
 * React hook — returns a reactive t() that re-renders when role/config changes.
 * Use this in React components instead of importing t() directly.
 */
export function useTerminology() {
  const { tenantConfig } = useData();
  const role = tenantConfig?.userRole || "supplier";
  const terms = tenantConfig?.terminology || {};

  const term = useCallback((key) => resolve(key, role, terms), [role, terms]);

  return { t: term, userRole: role };
}
