/**
 * Terminology helper — returns tenant-specific labels with fallbacks.
 * Role-aware: swaps labels based on userRole (4 industry roles).
 *
 *  ROLE      ACCOUNT=     DIST=         PRIMARY VIEWS
 *  winery    Retailer     Distributor   Depletions, Pipeline
 *  importer  Distributor  (self)        Orders, Inventory
 *  distrib   Retailer     Supplier      Sell-through, Inventory
 *  retailer  (self)       Supplier      Purchases, Inventory
 *
 * Legacy "supplier" maps to "winery" for backward compatibility.
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
    // Legacy alias for "winery" — kept for backward compatibility
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
  winery: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Distributor",
    account: "Retailer",
    depletion: "Depletion",
    healthTab: "Distributor Health",
    selectEntity: "Select Distributor",
    chooseEntity: "Choose a distributor",
    purchaseLabel: "Distributor Purchases",
    entityScorecard: "Distributor Scorecard",
    noEntityData: "No Distributor Data",
    uploadEntityHint: "Upload distributor depletion data to populate this view.",
    reEngageDescription: "These retailers previously carried your wines and represent warm leads for reconnection. Focus outreach here for highest conversion probability.",
    newWinsDescription: "Recent new retail placements — momentum builders for the brand. Ensure proper stocking and distributor support.",
    netPlacementTitle: "Net Placement Activity by Distributor",
    uploadHint: "Upload your distributor depletion reports, sales data, or QuickBooks exports.",
  },
  importer: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Distributor",
    account: "Distributor",
    depletion: "Orders",
    healthTab: "Distributor Health",
    selectEntity: "Select Distributor",
    chooseEntity: "Choose a distributor",
    purchaseLabel: "Distributor Orders",
    entityScorecard: "Distributor Scorecard",
    noEntityData: "No Distributor Data",
    uploadEntityHint: "Upload distributor order data to populate this view.",
    reEngageDescription: "These distributors previously carried your portfolio and represent warm leads for re-engagement. Prioritize outreach here for highest reorder probability.",
    newWinsDescription: "Recently onboarded distributors — momentum builders for your portfolio. Ensure proper inventory allocation and support.",
    netPlacementTitle: "Net Order Activity by Distributor",
    uploadHint: "Upload your distributor order reports, inventory data, or QuickBooks exports.",
  },
  distributor: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Supplier",
    account: "Retailer",
    depletion: "Sell-Through",
    healthTab: "Supplier Health",
    selectEntity: "Select Supplier",
    chooseEntity: "Choose a supplier",
    purchaseLabel: "Supplier Orders",
    entityScorecard: "Supplier Scorecard",
    noEntityData: "No Supplier Data",
    uploadEntityHint: "Upload supplier data to populate this view.",
    reEngageDescription: "These retailers previously stocked products from these suppliers and represent warm leads for restocking. Prioritize outreach here for the highest reorder probability.",
    newWinsDescription: "Recently onboarded supplier products — momentum builders for your portfolio. Ensure proper shelf space and inventory levels.",
    netPlacementTitle: "Net Placement Activity by Supplier",
    uploadHint: "Upload your supplier and inventory data files. The system will automatically detect the format and map columns.",
  },
  retailer: {
    volume: "CE",
    longPeriod: "13W",
    shortPeriod: "4W",
    distributor: "Supplier",
    account: "Store",
    depletion: "Purchases",
    healthTab: "Supplier Health",
    selectEntity: "Select Supplier",
    chooseEntity: "Choose a supplier",
    purchaseLabel: "Purchase Orders",
    entityScorecard: "Supplier Scorecard",
    noEntityData: "No Supplier Data",
    uploadEntityHint: "Upload supplier data to populate this view.",
    reEngageDescription: "These suppliers previously provided products and represent warm leads for reordering. Prioritize outreach for the best pricing and availability.",
    newWinsDescription: "Recently added suppliers — new products for your shelves. Monitor sell-through and reorder timing.",
    netPlacementTitle: "Net Purchase Activity by Supplier",
    uploadHint: "Upload your purchase orders, inventory data, or supplier invoices.",
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
