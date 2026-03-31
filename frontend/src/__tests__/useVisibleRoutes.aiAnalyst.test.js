/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useVisibleRoutes from "../hooks/useVisibleRoutes";

// Minimal route definitions matching config/routes.js structure
const ROUTES = [
  { key: "briefing", path: "/", label: "Briefing", section: null },
  { key: "depletions", path: "/depletions", label: "Depletions", dataKey: "depletions", section: null },
  { key: "distributors", path: "/distributors", label: "Distributors", dataKey: "distributorHealth", section: null },
  { key: "inventory", path: "/inventory", label: "Inventory", dataKey: "inventory", section: null },
  { key: "account-insights", path: "/account-insights", label: "Account Insights", dataKey: "accounts", section: null },
  { key: "opportunities", path: "/opportunities", label: "Opportunities", dataKey: "opportunities", section: null },
  { key: "reorder", path: "/reorder", label: "Reorder Forecast", dataKey: "reorder", section: null },
  { key: "revenue", path: "/revenue", label: "Revenue & Sales", dataKey: "revenue", section: null },
  { key: "executive", path: "/executive", label: "Executive Dashboard", section: null },
  { key: "territory", path: "/territory", label: "My Territory", section: null },
  { key: "reports", path: "/reports", label: "AI Reports", section: null },
  { key: "pipeline", path: "/pipeline", label: "Pipeline", section: "tools" },
  { key: "pricing", path: "/pricing", label: "Pricing Studio", section: "tools" },
  { key: "accounts", path: "/accounts", label: "Accounts", section: "crm" },
  { key: "contacts", path: "/contacts", label: "Contacts", section: "crm" },
  { key: "settings", path: "/settings", label: "Settings", adminOnly: true },
];

const BASE_OPTIONS = {
  isAdmin: true,
  userRole: "admin",
  availability: {
    depletions: true,
    distributorHealth: true,
    inventory: true,
    accounts: true,
    opportunities: true,
    reorder: true,
    revenue: true,
    hasAnyData: true,
  },
};

describe("useVisibleRoutes aiAnalyst feature flag", () => {
  it("hides static analytics routes when aiAnalyst is true", () => {
    const { result } = renderHook(() =>
      useVisibleRoutes(ROUTES, {
        ...BASE_OPTIONS,
        tenantConfig: { features: { aiAnalyst: true } },
      })
    );

    const analyticsKeys = result.current.sections.analytics.map((r) => r.key);

    // Static analytics routes should be hidden
    expect(analyticsKeys).not.toContain("depletions");
    expect(analyticsKeys).not.toContain("distributors");
    expect(analyticsKeys).not.toContain("inventory");
    expect(analyticsKeys).not.toContain("account-insights");
    expect(analyticsKeys).not.toContain("opportunities");
    expect(analyticsKeys).not.toContain("reorder");
    expect(analyticsKeys).not.toContain("revenue");
    expect(analyticsKeys).not.toContain("executive");
    expect(analyticsKeys).not.toContain("territory");
    expect(analyticsKeys).not.toContain("ai-reports");

    // Homepage briefing should still be visible
    expect(analyticsKeys).toContain("briefing");
  });

  it("keeps non-analytics routes visible when aiAnalyst is true", () => {
    const { result } = renderHook(() =>
      useVisibleRoutes(ROUTES, {
        ...BASE_OPTIONS,
        tenantConfig: { features: { aiAnalyst: true } },
      })
    );

    // Tools, CRM, admin should be unaffected
    const toolsKeys = result.current.sections.tools.map((r) => r.key);
    const crmKeys = result.current.sections.crm.map((r) => r.key);
    const adminKeys = result.current.sections.admin.map((r) => r.key);

    expect(toolsKeys).toContain("pipeline");
    expect(toolsKeys).toContain("pricing");
    expect(crmKeys).toContain("accounts");
    expect(crmKeys).toContain("contacts");
    expect(adminKeys).toContain("settings");
  });

  it("shows all routes when aiAnalyst is false", () => {
    const { result } = renderHook(() =>
      useVisibleRoutes(ROUTES, {
        ...BASE_OPTIONS,
        tenantConfig: { features: { aiAnalyst: false } },
      })
    );

    const analyticsKeys = result.current.sections.analytics.map((r) => r.key);

    // All static analytics routes should be visible
    expect(analyticsKeys).toContain("depletions");
    expect(analyticsKeys).toContain("distributors");
    expect(analyticsKeys).toContain("inventory");
    expect(analyticsKeys).toContain("executive");
  });

  it("shows all routes when aiAnalyst is undefined (backward compat)", () => {
    const { result } = renderHook(() =>
      useVisibleRoutes(ROUTES, {
        ...BASE_OPTIONS,
        tenantConfig: { features: {} },
      })
    );

    const analyticsKeys = result.current.sections.analytics.map((r) => r.key);
    expect(analyticsKeys).toContain("depletions");
    expect(analyticsKeys).toContain("executive");
  });
});
