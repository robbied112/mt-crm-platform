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
    key: "account-insights",
    path: "/account-insights",
    label: "Account Insights",
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
  // Tools
  {
    key: "pricing",
    path: "/pricing",
    label: "Pricing Studio",
    icon: "pricing",
    section: "tools",
    description: "Wine pricing calculator across 8 global markets",
  },
  // CRM
  {
    key: "crm-accounts",
    path: "/accounts",
    label: "Accounts",
    icon: "crmAccounts",
    section: "crm",
    description: "Manage accounts, contacts, and relationships",
  },
  {
    key: "crm-contacts",
    path: "/contacts",
    label: "Contacts",
    icon: "contacts",
    section: "crm",
    description: "Contact directory and communication history",
  },
  {
    key: "crm-activities",
    path: "/activities",
    label: "Activities",
    icon: "activities",
    section: "crm",
    description: "Activity log, visits, tastings, and follow-ups",
  },
  {
    key: "crm-tasks",
    path: "/tasks",
    label: "Tasks",
    icon: "tasks",
    section: "crm",
    description: "Task management and follow-up tracking",
  },
  // Billbacks (feature-gated)
  {
    key: "billbacks",
    path: "/billbacks",
    label: "Trade Spend",
    icon: "billbacks",
    section: "billbacks",
    dataKey: "billbacks",
    description: "Billback spend by wine, distributor, and type",
  },
  {
    key: "wines",
    path: "/wines",
    label: "Wines",
    icon: "wines",
    section: "billbacks",
    description: "Wine catalog extracted from billback imports",
  },
  // Setup / Onboarding
  {
    key: "setup",
    path: "/setup",
    label: "Setup Assistant",
    icon: "setup",
    section: "setup",
    description: "Guided setup — learn what reports to pull and upload your data",
  },
  // Admin
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
