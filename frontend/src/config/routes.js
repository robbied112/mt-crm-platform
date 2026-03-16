/**
 * Centralized route definitions.
 * Each route has a path, label, icon (emoji), and section for sidebar grouping.
 */

export const ROUTES = {
  // Analytics
  TERRITORY:        { path: "/territory",          label: "My Territory",       icon: "\u{1F3E0}", section: "analytics", dataKey: null },
  DEPLETIONS:       { path: "/depletions",         label: "Depletions",         icon: "\u{1F4C9}", section: "analytics", dataKey: "depletions",        termKey: "depletion", termSuffix: "s" },
  DISTRIBUTOR:      { path: "/distributor-health",  label: "Distributors",       icon: "\u{1F3ED}", section: "analytics", dataKey: "distributorHealth", termKey: "distributor", termSuffix: "s" },
  INVENTORY:        { path: "/inventory",          label: "Inventory",          icon: "\u{1F4E6}", section: "analytics", dataKey: "inventory" },
  ACCOUNT_INSIGHTS: { path: "/account-insights",   label: "Account Insights",   icon: "\u{1F4CA}", section: "analytics", dataKey: "accounts",         termKey: "account", termSuffix: " Insights" },
  OPPORTUNITIES:    { path: "/opportunities",      label: "Opportunities",      icon: "\u{1F31F}", section: "analytics", dataKey: "opportunities" },
  REORDER:          { path: "/reorder",            label: "Reorder Forecast",   icon: "\u{1F504}", section: "analytics", dataKey: "reorder" },

  // CRM
  ACCOUNTS:         { path: "/accounts",           label: "Accounts",           icon: "\u{1F4CB}", section: "crm" },
  CONTACTS:         { path: "/contacts",           label: "Contacts",           icon: "\u{1F465}", section: "crm" },
  PIPELINE:         { path: "/pipeline",           label: "Pipeline",           icon: "\u{1F4B0}", section: "crm",      dataKey: "pipeline" },
  ACTIVITIES:       { path: "/activities",         label: "Activities",         icon: "\u{1F4DD}", section: "crm" },
  TASKS:            { path: "/tasks",              label: "Tasks",              icon: "\u{2705}",  section: "crm" },

  // Admin
  SETTINGS:         { path: "/settings",           label: "Settings",           icon: "\u{2699}\u{FE0F}",  section: "admin", adminOnly: true },
};

// Detail routes (not shown in sidebar)
export const DETAIL_ROUTES = {
  ACCOUNT_DETAIL:   { path: "/accounts/:id" },
};

export const SECTIONS = [
  { key: "analytics", label: "Analytics" },
  { key: "crm",       label: "CRM" },
  { key: "admin",     label: "Admin" },
];

// Reverse lookups
export const KEY_TO_PATH = Object.fromEntries(
  Object.entries(ROUTES).map(([k, v]) => [k, v.path])
);

export const PATH_TO_ROUTE = Object.fromEntries(
  Object.entries(ROUTES).map(([k, v]) => [v.path, { key: k, ...v }])
);
