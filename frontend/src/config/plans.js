/**
 * Plan definitions — single source of truth for pricing tiers.
 *
 * Used by: LandingPage (display), useVisibleRoutes (gating),
 *          UpgradeModal (comparison), Settings (billing info).
 *
 * Tier hierarchy: trial (all access) > enterprise > growth > starter > expired (read-only)
 */

export const PLAN_IDS = {
  STARTER: "starter",
  GROWTH: "growth",
  ENTERPRISE: "enterprise",
};

/**
 * Plan definitions with features and limits.
 * `features` lists route keys and capability flags included in each tier.
 * `limits` defines numeric caps (null = unlimited).
 */
export const PLANS = {
  [PLAN_IDS.STARTER]: {
    name: "Starter",
    price: "$49",
    unit: "/mo",
    description: "One supplier, full visibility",
    features: [
      "Up to 5 users",
      "Distributor health scores",
      "Territory management",
      "Pipeline tracking",
      "Excel data uploads",
      "Email support",
    ],
    limits: {
      users: 5,
      uploadsPerMonth: 10,
      aiCalls: false, // AI features not included
      cloudSync: false,
    },
    // Route keys available on this tier (analytics + CRM basics)
    routeAccess: [
      "performance",
      "depletions",
      "distributor-detail",
      "inventory",
      "account-insights",
      "opportunities",
      "pipeline",
      "crm-accounts",
      "crm-contacts",
      "crm-activities",
      "crm-tasks",
      "admin-settings",
    ],
  },
  [PLAN_IDS.GROWTH]: {
    name: "Growth",
    price: "$99",
    unit: "/mo",
    description: "For multi-state sales teams",
    popular: true,
    features: [
      "Up to 15 users",
      "Everything in Starter",
      "AI report analysis",
      "Account CRM with files",
      "Reorder forecasting",
      "Priority support",
    ],
    limits: {
      users: 15,
      uploadsPerMonth: null, // unlimited
      aiCalls: true,
      cloudSync: true,
    },
    // All Starter routes + premium routes
    routeAccess: [
      "performance",
      "depletions",
      "distributor-detail",
      "inventory",
      "account-insights",
      "opportunities",
      "reorder",
      "revenue",
      "executive",
      "pipeline",
      "pricing",
      "crm-accounts",
      "crm-contacts",
      "crm-activities",
      "crm-tasks",
      "portfolio",
      "billbacks",
      "admin-settings",
    ],
  },
  [PLAN_IDS.ENTERPRISE]: {
    name: "Enterprise",
    price: "Custom",
    unit: "",
    description: "Multi-brand portfolios and integrations",
    cta: "contact",
    features: [
      "Unlimited users",
      "Everything in Growth",
      "Custom integrations",
      "API access",
      "Dedicated support",
      "Custom onboarding",
    ],
    limits: {
      users: null,
      uploadsPerMonth: null,
      aiCalls: true,
      cloudSync: true,
    },
    // All routes
    routeAccess: null, // null = all routes accessible
  },
};

/**
 * Check if a route key is accessible on a given plan.
 * Trial and enterprise get all routes.
 * @param {string} planId - "starter", "growth", "enterprise", or null (trial)
 * @param {string} routeKey - Route key from config/routes.js
 * @returns {boolean}
 */
export function isRouteAllowed(planId, routeKey) {
  // Trial gets all routes; no plan defaults to most restrictive
  if (!planId) return false;
  const plan = PLANS[planId];
  if (!plan) return false;
  // null routeAccess = all routes
  if (plan.routeAccess === null) return true;
  return plan.routeAccess.includes(routeKey);
}

/**
 * Get the upgrade target plan for a given route.
 * Returns the cheapest plan that includes the route.
 * @param {string} routeKey
 * @returns {{ planId: string, plan: object } | null}
 */
export function getUpgradePlanForRoute(routeKey) {
  for (const planId of [PLAN_IDS.STARTER, PLAN_IDS.GROWTH, PLAN_IDS.ENTERPRISE]) {
    const plan = PLANS[planId];
    if (plan.routeAccess === null || plan.routeAccess.includes(routeKey)) {
      return { planId, plan };
    }
  }
  return null;
}

/**
 * Ordered array of plans for display (landing page, upgrade modal).
 */
export const PLANS_DISPLAY = [
  { id: PLAN_IDS.STARTER, ...PLANS[PLAN_IDS.STARTER] },
  { id: PLAN_IDS.GROWTH, ...PLANS[PLAN_IDS.GROWTH] },
  { id: PLAN_IDS.ENTERPRISE, ...PLANS[PLAN_IDS.ENTERPRISE] },
];
