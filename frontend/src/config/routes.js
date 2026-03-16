/**
 * Centralized route definitions for the app.
 * Used by Sidebar, App router, and CommandPalette.
 */

export const ROUTES = [
  {
    key: "performance",
    path: "/",
    label: "My Territory",
    icon: "territory",
    dataKey: null,
    description: "Territory overview, KPIs, and action items",
  },
  {
    key: "depletions",
    path: "/depletions",
    label: "Depletions",
    icon: "depletions",
    termKey: "depletion",
    suffix: "s",
    dataKey: "depletions",
    description: "Volume trends, scorecard, and brand performance",
  },
  {
    key: "distributor-detail",
    path: "/distributors",
    label: "Distributors",
    icon: "distributors",
    termKey: "distributor",
    suffix: "s",
    dataKey: "distributorHealth",
    description: "Distributor health, sell-through, and inventory",
  },
  {
    key: "inventory",
    path: "/inventory",
    label: "Inventory",
    icon: "inventory",
    dataKey: "inventory",
    description: "Stock levels, days on hand, and reorder alerts",
  },
  {
    key: "accounts",
    path: "/accounts",
    label: "Accounts",
    icon: "accounts",
    termKey: "account",
    suffix: " Insights",
    dataKey: "accounts",
    description: "Top accounts, trends, and concentration analysis",
  },
  {
    key: "opportunities",
    path: "/opportunities",
    label: "Opportunities",
    icon: "opportunities",
    dataKey: "opportunities",
    description: "Re-engagement targets, new wins, and growth",
  },
  {
    key: "reorder",
    path: "/reorder",
    label: "Reorder Forecast",
    icon: "reorder",
    dataKey: "reorder",
    description: "Predicted reorders, overdue alerts, and priorities",
  },
  {
    key: "pipeline",
    path: "/pipeline",
    label: "Pipeline",
    icon: "pipeline",
    accent: true,
    dataKey: "pipeline",
    description: "Sales pipeline, funnel, and deal tracking",
  },
  {
    key: "admin-settings",
    path: "/settings",
    label: "Settings",
    icon: "settings",
    adminOnly: true,
    dataKey: null,
    description: "Branding, users, data import, and configuration",
  },
];

// Quick lookup: tab key → route path
export const KEY_TO_PATH = Object.fromEntries(ROUTES.map((r) => [r.key, r.path]));

// Quick lookup: path → route
export const PATH_TO_ROUTE = Object.fromEntries(ROUTES.map((r) => [r.path, r]));
