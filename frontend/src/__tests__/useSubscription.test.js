/**
 * Tests for useSubscription — subscription state derivation.
 *
 * Tests the pure logic that maps tenantConfig.subscription into
 * access flags (isActive, canWrite, isReadOnly, dunning stages, etc.).
 *
 * Mirrors the truth table in useSubscription.js header comment.
 */
import { describe, it, expect } from "vitest";

// Since useSubscription is a React hook wrapping useMemo + useData(),
// we replicate the core logic for pure unit testing (same pattern as
// sidebarSetupCard.test.js and useVisibleRoutes.test.js).

const DUNNING_GRACE_DAYS = 7;

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(date) {
  if (!date) return -1;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((targetStart - todayStart) / (1000 * 60 * 60 * 24));
}

function daysSince(date) {
  if (!date) return 0;
  return -daysUntil(date);
}

function computeSubscription(sub) {
  if (!sub || !sub.status) {
    return {
      status: "none",
      plan: null,
      isActive: false,
      isTrial: false,
      isExpired: true,
      isReadOnly: true,
      canWrite: false,
      daysLeft: 0,
      dunning: null,
      subscription: null,
    };
  }

  const status = sub.status;
  const plan = sub.plan?.toLowerCase() || null;

  if (status === "trial") {
    const trialEnd = toDate(sub.trialEnd);
    const remaining = daysUntil(trialEnd);
    const isTrialActive = remaining > 0;
    return {
      status: "trial",
      plan,
      isActive: isTrialActive,
      isTrial: isTrialActive,
      isExpired: !isTrialActive,
      isReadOnly: !isTrialActive,
      canWrite: isTrialActive,
      daysLeft: Math.max(0, remaining),
      dunning: null,
      subscription: sub,
    };
  }

  if (status === "active") {
    return {
      status: "active",
      plan,
      isActive: true,
      isTrial: false,
      isExpired: false,
      isReadOnly: false,
      canWrite: true,
      daysLeft: null,
      dunning: null,
      subscription: sub,
    };
  }

  if (status === "past_due") {
    const failedAt = toDate(sub.lastPaymentFailed);
    const daysSinceFailure = daysSince(failedAt);
    let dunningStage;
    if (daysSinceFailure <= 3) {
      dunningStage = "warning";
    } else if (daysSinceFailure <= DUNNING_GRACE_DAYS) {
      dunningStage = "urgent";
    } else {
      dunningStage = "suspended";
    }
    const isSuspended = dunningStage === "suspended";
    return {
      status: "past_due",
      plan,
      isActive: !isSuspended,
      isTrial: false,
      isExpired: false,
      isReadOnly: isSuspended,
      canWrite: !isSuspended,
      daysLeft: null,
      dunning: {
        stage: dunningStage,
        daysSinceFailure,
        daysUntilSuspension: Math.max(0, DUNNING_GRACE_DAYS - daysSinceFailure),
      },
      subscription: sub,
    };
  }

  if (status === "cancelled") {
    return {
      status: "cancelled",
      plan,
      isActive: false,
      isTrial: false,
      isExpired: false,
      isReadOnly: true,
      canWrite: false,
      daysLeft: null,
      dunning: null,
      subscription: sub,
    };
  }

  return {
    status: "unknown",
    plan,
    isActive: false,
    isTrial: false,
    isExpired: true,
    isReadOnly: true,
    canWrite: false,
    daysLeft: 0,
    dunning: null,
    subscription: sub,
  };
}

/** Helper: create a date N days from now */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Helper: create a date N days ago */
function daysAgo(n) {
  return daysFromNow(-n);
}

describe("useSubscription", () => {
  describe("no subscription data", () => {
    it("returns expired/read-only when subscription is undefined", () => {
      const result = computeSubscription(undefined);
      expect(result.status).toBe("none");
      expect(result.isActive).toBe(false);
      expect(result.isReadOnly).toBe(true);
      expect(result.canWrite).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.subscription).toBeNull();
    });

    it("returns expired/read-only when subscription is null", () => {
      const result = computeSubscription(null);
      expect(result.status).toBe("none");
      expect(result.canWrite).toBe(false);
    });

    it("returns expired/read-only when subscription is empty object", () => {
      const result = computeSubscription({});
      expect(result.status).toBe("none");
      expect(result.isReadOnly).toBe(true);
    });

    it("returns expired/read-only when status is missing", () => {
      const result = computeSubscription({ plan: "growth" });
      expect(result.status).toBe("none");
      expect(result.canWrite).toBe(false);
    });
  });

  describe("trial status", () => {
    it("active trial with days remaining", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: daysFromNow(10),
      });
      expect(result.status).toBe("trial");
      expect(result.isActive).toBe(true);
      expect(result.isTrial).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.isReadOnly).toBe(false);
      expect(result.canWrite).toBe(true);
      expect(result.daysLeft).toBe(10);
      expect(result.dunning).toBeNull();
    });

    it("expired trial (end date in the past)", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: daysAgo(2),
      });
      expect(result.status).toBe("trial");
      expect(result.isActive).toBe(false);
      expect(result.isTrial).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.isReadOnly).toBe(true);
      expect(result.canWrite).toBe(false);
      expect(result.daysLeft).toBe(0);
    });

    it("trial ending today is expired (remaining = 0, not > 0)", () => {
      // trialEnd is today at start of day — daysUntil returns 0, which is NOT > 0
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const result = computeSubscription({
        status: "trial",
        trialEnd: todayStart.toISOString(),
      });
      expect(result.isActive).toBe(false);
      expect(result.canWrite).toBe(false);
      expect(result.daysLeft).toBe(0);
    });

    it("trial with 1 day remaining", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: daysFromNow(1),
      });
      expect(result.isActive).toBe(true);
      expect(result.daysLeft).toBe(1);
    });

    it("trial with no trialEnd date defaults to expired", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: null,
      });
      expect(result.isActive).toBe(false);
      expect(result.canWrite).toBe(false);
      expect(result.daysLeft).toBe(0);
    });

    it("trial preserves plan if set", () => {
      const result = computeSubscription({
        status: "trial",
        plan: "Growth",
        trialEnd: daysFromNow(10),
      });
      expect(result.plan).toBe("growth"); // lowercased
    });
  });

  describe("active status", () => {
    it("active subscription has full access", () => {
      const result = computeSubscription({
        status: "active",
        plan: "growth",
      });
      expect(result.status).toBe("active");
      expect(result.isActive).toBe(true);
      expect(result.isTrial).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.isReadOnly).toBe(false);
      expect(result.canWrite).toBe(true);
      expect(result.daysLeft).toBeNull();
      expect(result.dunning).toBeNull();
    });

    it("active subscription lowercases plan name", () => {
      const result = computeSubscription({
        status: "active",
        plan: "STARTER",
      });
      expect(result.plan).toBe("starter");
    });
  });

  describe("past_due status — dunning stages", () => {
    it("WARNING stage: 0-3 days since failure (full access)", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "growth",
        lastPaymentFailed: daysAgo(2),
      });
      expect(result.status).toBe("past_due");
      expect(result.isActive).toBe(true);
      expect(result.canWrite).toBe(true);
      expect(result.isReadOnly).toBe(false);
      expect(result.dunning.stage).toBe("warning");
      expect(result.dunning.daysSinceFailure).toBe(2);
      expect(result.dunning.daysUntilSuspension).toBe(5);
    });

    it("URGENT stage: 4-7 days since failure (full access)", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "growth",
        lastPaymentFailed: daysAgo(5),
      });
      expect(result.isActive).toBe(true);
      expect(result.canWrite).toBe(true);
      expect(result.dunning.stage).toBe("urgent");
      expect(result.dunning.daysUntilSuspension).toBe(2);
    });

    it("SUSPENDED stage: 8+ days since failure (read-only)", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "growth",
        lastPaymentFailed: daysAgo(10),
      });
      expect(result.isActive).toBe(false);
      expect(result.canWrite).toBe(false);
      expect(result.isReadOnly).toBe(true);
      expect(result.dunning.stage).toBe("suspended");
      expect(result.dunning.daysUntilSuspension).toBe(0);
    });

    it("boundary: exactly 3 days is WARNING", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "starter",
        lastPaymentFailed: daysAgo(3),
      });
      expect(result.dunning.stage).toBe("warning");
      expect(result.isActive).toBe(true);
    });

    it("boundary: exactly 7 days is URGENT", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "starter",
        lastPaymentFailed: daysAgo(7),
      });
      expect(result.dunning.stage).toBe("urgent");
      expect(result.isActive).toBe(true);
    });

    it("boundary: exactly 8 days is SUSPENDED", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "starter",
        lastPaymentFailed: daysAgo(8),
      });
      expect(result.dunning.stage).toBe("suspended");
      expect(result.isActive).toBe(false);
    });

    it("past_due with no lastPaymentFailed date defaults to day 0 (WARNING)", () => {
      const result = computeSubscription({
        status: "past_due",
        plan: "growth",
      });
      expect(result.dunning.stage).toBe("warning");
      expect(result.dunning.daysSinceFailure).toBe(0);
    });
  });

  describe("cancelled status", () => {
    it("cancelled subscription is read-only", () => {
      const result = computeSubscription({
        status: "cancelled",
        plan: "growth",
      });
      expect(result.status).toBe("cancelled");
      expect(result.isActive).toBe(false);
      expect(result.isTrial).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.isReadOnly).toBe(true);
      expect(result.canWrite).toBe(false);
      expect(result.plan).toBe("growth");
    });
  });

  describe("unknown status", () => {
    it("unknown status defaults to expired/read-only", () => {
      const result = computeSubscription({
        status: "some_weird_status",
        plan: "growth",
      });
      expect(result.status).toBe("unknown");
      expect(result.isActive).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.isReadOnly).toBe(true);
      expect(result.canWrite).toBe(false);
    });
  });

  describe("toDate helper", () => {
    it("handles Firestore Timestamp objects", () => {
      const mockTimestamp = { toDate: () => new Date("2026-04-01") };
      const result = computeSubscription({
        status: "trial",
        trialEnd: mockTimestamp,
      });
      // Should parse without error
      expect(result.status).toBe("trial");
    });

    it("handles ISO string dates", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: "2099-12-31T00:00:00.000Z",
      });
      expect(result.isActive).toBe(true);
      expect(result.daysLeft).toBeGreaterThan(0);
    });

    it("handles invalid date gracefully", () => {
      const result = computeSubscription({
        status: "trial",
        trialEnd: "not-a-date",
      });
      // toDate returns null → daysUntil returns -1 → not active
      expect(result.isActive).toBe(false);
      expect(result.canWrite).toBe(false);
    });
  });
});

describe("plans config", () => {
  // Import plans config for integration-style tests
  const { PLANS, PLAN_IDS, isRouteAllowed, getUpgradePlanForRoute, PLANS_DISPLAY } = require("../config/plans");

  describe("isRouteAllowed", () => {
    it("starter includes core analytics routes", () => {
      expect(isRouteAllowed("starter", "depletions")).toBe(true);
      expect(isRouteAllowed("starter", "inventory")).toBe(true);
      expect(isRouteAllowed("starter", "pipeline")).toBe(true);
    });

    it("starter excludes premium routes", () => {
      expect(isRouteAllowed("starter", "reorder")).toBe(false);
      expect(isRouteAllowed("starter", "revenue")).toBe(false);
      expect(isRouteAllowed("starter", "executive")).toBe(false);
      expect(isRouteAllowed("starter", "portfolio")).toBe(false);
    });

    it("growth includes all starter routes plus premium", () => {
      expect(isRouteAllowed("growth", "depletions")).toBe(true);
      expect(isRouteAllowed("growth", "reorder")).toBe(true);
      expect(isRouteAllowed("growth", "revenue")).toBe(true);
      expect(isRouteAllowed("growth", "executive")).toBe(true);
      expect(isRouteAllowed("growth", "portfolio")).toBe(true);
    });

    it("enterprise allows all routes (routeAccess = null)", () => {
      expect(isRouteAllowed("enterprise", "depletions")).toBe(true);
      expect(isRouteAllowed("enterprise", "revenue")).toBe(true);
      expect(isRouteAllowed("enterprise", "any-future-route")).toBe(true);
    });

    it("returns false for null planId", () => {
      expect(isRouteAllowed(null, "depletions")).toBe(false);
    });

    it("returns false for unknown plan", () => {
      expect(isRouteAllowed("ultra", "depletions")).toBe(false);
    });
  });

  describe("getUpgradePlanForRoute", () => {
    it("returns starter for routes in starter tier", () => {
      const result = getUpgradePlanForRoute("depletions");
      expect(result.planId).toBe("starter");
    });

    it("returns growth for premium routes not in starter", () => {
      const result = getUpgradePlanForRoute("reorder");
      expect(result.planId).toBe("growth");
    });

    it("returns null for completely unknown route", () => {
      // All plans either include it or have routeAccess=null (enterprise)
      // So enterprise will match any route — this should return enterprise
      const result = getUpgradePlanForRoute("some-nonexistent-route");
      expect(result.planId).toBe("enterprise");
    });
  });

  describe("PLANS_DISPLAY", () => {
    it("has 3 plans in display order", () => {
      expect(PLANS_DISPLAY).toHaveLength(3);
      expect(PLANS_DISPLAY[0].id).toBe("starter");
      expect(PLANS_DISPLAY[1].id).toBe("growth");
      expect(PLANS_DISPLAY[2].id).toBe("enterprise");
    });

    it("growth plan is marked as popular", () => {
      expect(PLANS_DISPLAY[1].popular).toBe(true);
    });

    it("enterprise has contact CTA", () => {
      expect(PLANS_DISPLAY[2].cta).toBe("contact");
    });
  });
});
