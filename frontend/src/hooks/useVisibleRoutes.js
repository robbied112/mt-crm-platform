/**
 * useVisibleRoutes — Centralized route visibility logic for progressive disclosure.
 *
 * Replaces 6 separate .filter() calls in Sidebar.jsx with a single hook that
 * applies all gating rules: adminOnly, hidden, dataKey, section, feature flags,
 * and progressive disclosure.
 *
 * When progressiveSidebar feature is enabled, routes without data are hidden
 * from the main nav and instead shown as collapsed "upload X to unlock" hints.
 */

import { useMemo } from "react";
import { isRouteAllowed } from "../config/plans";

/**
 * Map of dataKey → human-readable upload hint.
 * Used when a route is hidden due to missing data.
 */
const UPLOAD_HINTS = {
  depletions: "Upload depletion data to unlock",
  distributorHealth: "Upload distributor reports to unlock",
  inventory: "Upload inventory data to unlock",
  accounts: "Upload data with account info to unlock",
  opportunities: "Upload data to unlock",
  reorder: "Upload purchase history to unlock",
  revenue: "Upload revenue data to unlock",
  billbacks: "Upload billback PDFs to unlock",
};

/**
 * Section display order and labels for the sidebar.
 */
const SECTION_CONFIG = {
  analytics: { label: "ANALYTICS", order: 0 },
  tools: { label: "TOOLS", order: 1 },
  crm: { label: "CRM", order: 2 },
  portfolio: { label: "PORTFOLIO", order: 3 },
  billbacks: { label: "TRADE SPEND", order: 4 },
  admin: { label: "ADMIN", order: 5 },
};

/**
 * @param {Array} routes — ROUTES from config/routes.js
 * @param {object} options
 * @param {boolean} options.isAdmin — current user is admin
 * @param {object} options.availability — DataContext.availability map
 * @param {object} options.tenantConfig — tenant configuration
 * @returns {object} { sections, hiddenHints }
 *   sections: { analytics, tools, crm, portfolio, billbacks, admin } — arrays of visible routes
 *   hiddenHints: array of { label, hint } for collapsed progressive disclosure labels
 */
export default function useVisibleRoutes(routes, { isAdmin, userRole, availability, tenantConfig } = {}) {
  return useMemo(() => {
    const progressive = !!tenantConfig?.features?.progressiveSidebar;
    const billbacksEnabled = !!tenantConfig?.features?.billbacks;
    const aiAnalyst = !!tenantConfig?.features?.aiAnalyst;
    const hiddenHints = [];

    // AI Analyst mode: hide static analytics routes (replaced by AnalysisViewer homepage)
    const AI_ANALYST_HIDDEN_KEYS = new Set([
      "depletions", "distributors", "inventory", "account-insights",
      "opportunities", "reorder", "revenue", "executive", "territory", "reports",
    ]);

    // Classify each route into a section bucket
    const analytics = [];
    const tools = [];
    const crm = [];
    const portfolio = [];
    const billbacks = [];
    const admin = [];

    for (const route of routes) {
      // Always skip hidden routes (e.g. /portfolio/:productId detail pages)
      if (route.hidden) continue;

      // Skip deprecated routes
      if (route.deprecated) continue;

      // AI Analyst mode: hide static analytics routes
      if (aiAnalyst && AI_ANALYST_HIDDEN_KEYS.has(route.key)) continue;

      // Skip setup route (handled separately by setup card)
      if (route.section === "setup") continue;

      // Admin routes: only visible to admins
      if (route.adminOnly) {
        if (isAdmin) admin.push(route);
        continue;
      }

      // Subscription tier gating: hide routes not included in the user's plan.
      // Trial users get all routes. Expired/no subscription still see routes
      // (read-only gating is handled by useSubscription.canWrite, not route hiding).
      const subStatus = tenantConfig?.subscription?.status;
      const subPlan = tenantConfig?.subscription?.plan?.toLowerCase();
      if (subStatus === "active" && subPlan) {
        // Active paid plan — check if route is allowed on this tier
        if (!isRouteAllowed(subPlan, route.key)) {
          // Route not in plan — add as upgrade hint if progressive sidebar is on
          if (progressive) {
            hiddenHints.push({
              label: route.label,
              hint: `Upgrade to unlock ${route.label}`,
              dataKey: route.dataKey,
              section: route.section,
              tierLocked: true,
            });
          }
          continue;
        }
      }

      // Billback routes: feature-gated
      if (route.section === "billbacks") {
        if (!billbacksEnabled) continue;
      }

      // Progressive disclosure: hide routes without data
      if (progressive && route.dataKey && !availability?.[route.dataKey]) {
        const hint = UPLOAD_HINTS[route.dataKey];
        if (hint) {
          hiddenHints.push({ label: route.label, hint, dataKey: route.dataKey, section: route.section });
        }
        continue;
      }

      // Route into section
      if (route.section === "tools") {
        tools.push(route);
      } else if (route.section === "crm") {
        crm.push(route);
      } else if (route.section === "portfolio") {
        portfolio.push(route);
      } else if (route.section === "billbacks") {
        billbacks.push(route);
      } else {
        analytics.push(route);
      }
    }

    // When progressive disclosure is on, hide entire empty sections
    const sections = {
      analytics,
      tools: progressive && tools.length === 0 ? [] : tools,
      crm: progressive && crm.length === 0 ? [] : crm,
      portfolio: progressive && portfolio.length === 0 ? [] : portfolio,
      billbacks: progressive && billbacks.length === 0 ? [] : billbacks,
      admin,
    };

    return { sections, hiddenHints };
  }, [routes, isAdmin, userRole, availability, tenantConfig]);
}

export { SECTION_CONFIG, UPLOAD_HINTS };
