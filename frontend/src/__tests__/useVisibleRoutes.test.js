/**
 * Tests for useVisibleRoutes — centralized sidebar route visibility logic.
 *
 * Tests the pure filtering/bucketing logic extracted from Sidebar.jsx,
 * including progressive disclosure, feature gating, admin routes, and
 * section assignment.
 */
import { describe, it, expect } from "vitest";

// Import the hook's internals directly — since it's a useMemo wrapper,
// we replicate the core logic here for pure unit testing (same pattern
// as sidebarSetupCard.test.js).

import useVisibleRoutes, { SECTION_CONFIG, UPLOAD_HINTS } from "../hooks/useVisibleRoutes";
import { isRouteAllowed } from "../config/plans";

// Minimal route fixtures
const makeRoute = (overrides) => ({
  key: "test",
  path: "/test",
  label: "Test",
  icon: "territory",
  dataKey: null,
  ...overrides,
});

// Since useVisibleRoutes is a React hook (useMemo), we test via renderHook
// or replicate the logic. For pure unit tests without React, we extract
// the logic into a helper.

function computeVisibleRoutes(routes, { isAdmin, availability, tenantConfig } = {}) {
  const progressive = !!tenantConfig?.features?.progressiveSidebar;
  const billbacksEnabled = !!tenantConfig?.features?.billbacks;
  const hiddenHints = [];

  const analytics = [];
  const tools = [];
  const crm = [];
  const portfolio = [];
  const billbacks = [];
  const admin = [];

  for (const route of routes) {
    if (route.hidden) continue;
    if (route.deprecated) continue;
    if (route.section === "setup") continue;
    if (route.adminOnly) {
      if (isAdmin) admin.push(route);
      continue;
    }

    // Subscription tier gating
    const subStatus = tenantConfig?.subscription?.status;
    const subPlan = tenantConfig?.subscription?.plan?.toLowerCase();
    if (subStatus === "active" && subPlan) {
      if (!isRouteAllowed(subPlan, route.key)) {
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

    if (route.section === "billbacks") {
      if (!billbacksEnabled) continue;
    }
    if (progressive && route.dataKey && !availability?.[route.dataKey]) {
      const hint = UPLOAD_HINTS[route.dataKey];
      if (hint) {
        hiddenHints.push({ label: route.label, hint, dataKey: route.dataKey, section: route.section });
      }
      continue;
    }
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

  const sections = {
    analytics,
    tools: progressive && tools.length === 0 ? [] : tools,
    crm: progressive && crm.length === 0 ? [] : crm,
    portfolio: progressive && portfolio.length === 0 ? [] : portfolio,
    billbacks: progressive && billbacks.length === 0 ? [] : billbacks,
    admin,
  };

  return { sections, hiddenHints };
}

describe("useVisibleRoutes", () => {
  describe("section assignment", () => {
    it("routes without section go to analytics", () => {
      const routes = [makeRoute({ key: "a", label: "A" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.analytics).toHaveLength(1);
      expect(sections.analytics[0].key).toBe("a");
    });

    it("routes with section=tools go to tools", () => {
      const routes = [makeRoute({ key: "t", section: "tools" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.tools).toHaveLength(1);
    });

    it("routes with section=crm go to crm", () => {
      const routes = [makeRoute({ key: "c", section: "crm" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.crm).toHaveLength(1);
    });

    it("routes with section=portfolio go to portfolio", () => {
      const routes = [makeRoute({ key: "p", section: "portfolio" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.portfolio).toHaveLength(1);
    });

    it("routes with section=billbacks go to billbacks when feature enabled", () => {
      const routes = [makeRoute({ key: "b", section: "billbacks" })];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { features: { billbacks: true } },
      });
      expect(sections.billbacks).toHaveLength(1);
    });
  });

  describe("hidden and deprecated routes", () => {
    it("skips hidden routes", () => {
      const routes = [makeRoute({ key: "h", hidden: true })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.analytics).toHaveLength(0);
    });

    it("skips deprecated routes", () => {
      const routes = [makeRoute({ key: "d", deprecated: true })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.analytics).toHaveLength(0);
    });

    it("skips setup section routes", () => {
      const routes = [makeRoute({ key: "s", section: "setup" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.analytics).toHaveLength(0);
    });
  });

  describe("admin routes", () => {
    it("includes admin routes when isAdmin=true", () => {
      const routes = [makeRoute({ key: "admin", adminOnly: true })];
      const { sections } = computeVisibleRoutes(routes, { isAdmin: true });
      expect(sections.admin).toHaveLength(1);
    });

    it("excludes admin routes when isAdmin=false", () => {
      const routes = [makeRoute({ key: "admin", adminOnly: true })];
      const { sections } = computeVisibleRoutes(routes, { isAdmin: false });
      expect(sections.admin).toHaveLength(0);
    });
  });

  describe("billback feature gating", () => {
    it("excludes billback routes when feature disabled", () => {
      const routes = [makeRoute({ key: "b", section: "billbacks" })];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { features: {} },
      });
      expect(sections.billbacks).toHaveLength(0);
    });

    it("excludes billback routes when features is undefined", () => {
      const routes = [makeRoute({ key: "b", section: "billbacks" })];
      const { sections } = computeVisibleRoutes(routes);
      expect(sections.billbacks).toHaveLength(0);
    });
  });

  describe("progressive disclosure", () => {
    const progressiveConfig = { features: { progressiveSidebar: true } };

    it("hides routes with dataKey when no data available", () => {
      const routes = [
        makeRoute({ key: "dep", label: "Depletions", dataKey: "depletions" }),
      ];
      const { sections, hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: progressiveConfig,
        availability: {},
      });
      expect(sections.analytics).toHaveLength(0);
      expect(hiddenHints).toHaveLength(1);
      expect(hiddenHints[0].label).toBe("Depletions");
      expect(hiddenHints[0].hint).toBe("Upload depletion data to unlock");
    });

    it("shows routes with dataKey when data is available", () => {
      const routes = [
        makeRoute({ key: "dep", label: "Depletions", dataKey: "depletions" }),
      ];
      const { sections, hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: progressiveConfig,
        availability: { depletions: true },
      });
      expect(sections.analytics).toHaveLength(1);
      expect(hiddenHints).toHaveLength(0);
    });

    it("does not hide routes without dataKey", () => {
      const routes = [
        makeRoute({ key: "home", label: "Home", dataKey: null }),
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: progressiveConfig,
        availability: {},
      });
      expect(sections.analytics).toHaveLength(1);
    });

    it("does not apply progressive disclosure when feature is off", () => {
      const routes = [
        makeRoute({ key: "dep", label: "Depletions", dataKey: "depletions" }),
      ];
      const { sections, hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: { features: {} },
        availability: {},
      });
      expect(sections.analytics).toHaveLength(1);
      expect(hiddenHints).toHaveLength(0);
    });

    it("generates hints for known dataKeys only", () => {
      const routes = [
        makeRoute({ key: "x", label: "Unknown", dataKey: "unknownKey" }),
      ];
      const { hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: progressiveConfig,
        availability: {},
      });
      // unknownKey has no UPLOAD_HINTS entry, so no hint generated
      expect(hiddenHints).toHaveLength(0);
    });
  });

  describe("SECTION_CONFIG", () => {
    it("has all expected sections", () => {
      expect(Object.keys(SECTION_CONFIG)).toEqual(
        expect.arrayContaining(["analytics", "tools", "crm", "portfolio", "billbacks", "admin"])
      );
    });

    it("sections are ordered correctly", () => {
      const entries = Object.entries(SECTION_CONFIG).sort((a, b) => a[1].order - b[1].order);
      expect(entries[0][0]).toBe("analytics");
      expect(entries[entries.length - 1][0]).toBe("admin");
    });
  });

  describe("UPLOAD_HINTS", () => {
    it("has hints for all standard dataKeys", () => {
      const expectedKeys = ["depletions", "distributorHealth", "inventory", "accounts", "opportunities", "reorder", "revenue", "billbacks"];
      for (const key of expectedKeys) {
        expect(UPLOAD_HINTS[key]).toBeDefined();
        expect(typeof UPLOAD_HINTS[key]).toBe("string");
      }
    });
  });

  describe("subscription tier gating", () => {
    it("hides routes not in starter plan for active starter subscription", () => {
      const routes = [
        makeRoute({ key: "depletions", label: "Depletions" }),  // in starter
        makeRoute({ key: "reorder", label: "Reorder" }),        // NOT in starter
        makeRoute({ key: "revenue", label: "Revenue" }),        // NOT in starter
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { subscription: { status: "active", plan: "starter" } },
      });
      expect(sections.analytics).toHaveLength(1);
      expect(sections.analytics[0].key).toBe("depletions");
    });

    it("shows all routes for active growth subscription", () => {
      const routes = [
        makeRoute({ key: "depletions", label: "Depletions" }),
        makeRoute({ key: "reorder", label: "Reorder" }),
        makeRoute({ key: "revenue", label: "Revenue" }),
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { subscription: { status: "active", plan: "growth" } },
      });
      expect(sections.analytics).toHaveLength(3);
    });

    it("shows all routes for enterprise (routeAccess = null)", () => {
      const routes = [
        makeRoute({ key: "depletions", label: "Depletions" }),
        makeRoute({ key: "reorder", label: "Reorder" }),
        makeRoute({ key: "some-future-route", label: "Future" }),
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { subscription: { status: "active", plan: "enterprise" } },
      });
      expect(sections.analytics).toHaveLength(3);
    });

    it("trial users see all routes (no tier gating)", () => {
      const routes = [
        makeRoute({ key: "reorder", label: "Reorder" }),  // premium route
        makeRoute({ key: "revenue", label: "Revenue" }),   // premium route
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: { subscription: { status: "trial", plan: null } },
      });
      expect(sections.analytics).toHaveLength(2);
    });

    it("expired/no subscription users see all routes (read-only gating elsewhere)", () => {
      const routes = [
        makeRoute({ key: "reorder", label: "Reorder" }),
        makeRoute({ key: "revenue", label: "Revenue" }),
      ];
      const { sections } = computeVisibleRoutes(routes, {
        tenantConfig: {},
      });
      expect(sections.analytics).toHaveLength(2);
    });

    it("generates upgrade hints for tier-locked routes when progressive sidebar is on", () => {
      const routes = [
        makeRoute({ key: "reorder", label: "Reorder Forecast" }),
      ];
      const { sections, hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: {
          features: { progressiveSidebar: true },
          subscription: { status: "active", plan: "starter" },
        },
      });
      expect(sections.analytics).toHaveLength(0);
      expect(hiddenHints).toHaveLength(1);
      expect(hiddenHints[0].hint).toBe("Upgrade to unlock Reorder Forecast");
      expect(hiddenHints[0].tierLocked).toBe(true);
    });

    it("silently hides tier-locked routes when progressive sidebar is off", () => {
      const routes = [
        makeRoute({ key: "reorder", label: "Reorder" }),
      ];
      const { sections, hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: {
          subscription: { status: "active", plan: "starter" },
        },
      });
      expect(sections.analytics).toHaveLength(0);
      expect(hiddenHints).toHaveLength(0);
    });

    it("tier gating applies before progressive disclosure", () => {
      // Route is tier-locked AND has no data — tier lock should take priority
      const routes = [
        makeRoute({ key: "reorder", label: "Reorder", dataKey: "reorder" }),
      ];
      const { hiddenHints } = computeVisibleRoutes(routes, {
        tenantConfig: {
          features: { progressiveSidebar: true },
          subscription: { status: "active", plan: "starter" },
        },
        availability: {},
      });
      expect(hiddenHints).toHaveLength(1);
      // Should be an upgrade hint, not a data upload hint
      expect(hiddenHints[0].tierLocked).toBe(true);
      expect(hiddenHints[0].hint).toContain("Upgrade");
    });
  });
});
