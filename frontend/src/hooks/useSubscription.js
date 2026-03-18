/**
 * useSubscription — single source of truth for subscription state.
 *
 * Reads tenantConfig.subscription from DataContext and derives
 * access flags used throughout the app.
 *
 * ┌──────────────────────┬────────────┬─────────┬──────────┬──────────┐
 * │ subscription         │ isActive   │ isTrial │isReadOnly│ canWrite │
 * ├──────────────────────┼────────────┼─────────┼──────────┼──────────┤
 * │ undefined / null     │ false      │ false   │ true     │ false    │
 * │ {}                   │ false      │ false   │ true     │ false    │
 * │ trial + future end   │ true       │ true    │ false    │ true     │
 * │ trial + past end     │ false      │ false   │ true     │ false    │
 * │ trial + today end    │ false      │ false   │ true     │ false    │
 * │ active               │ true       │ false   │ false    │ true     │
 * │ past_due (≤7 days)   │ true       │ false   │ false    │ true     │
 * │ past_due (>7 days)   │ false      │ false   │ true     │ false    │
 * │ cancelled            │ false      │ false   │ true     │ false    │
 * │ unknown status       │ false      │ false   │ true     │ false    │
 * └──────────────────────┴────────────┴─────────┴──────────┴──────────┘
 *
 * Dunning stages (past_due):
 *   0-3 days: WARNING — yellow banner, full access
 *   4-7 days: URGENT — red banner, full access
 *   8+ days:  SUSPENDED — read-only, upgrade CTA
 */

import { useMemo } from "react";
import { useData } from "../context/DataContext";

/** Grace period before past_due becomes suspended (days) */
const DUNNING_GRACE_DAYS = 7;

/**
 * Dunning stages based on days since payment failure.
 */
const DUNNING_STAGES = {
  WARNING: "warning",   // 0-3 days
  URGENT: "urgent",     // 4-7 days
  SUSPENDED: "suspended", // 8+ days
};

/**
 * Parse a Firestore timestamp or date-like value to a Date.
 * Handles Firestore Timestamps, ISO strings, and epoch ms.
 */
function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculate days remaining until a date (rounded down).
 * Returns negative values for past dates.
 */
function daysUntil(date) {
  if (!date) return -1;
  const now = new Date();
  // Compare at start of day to avoid timezone/time-of-day issues
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((targetStart - todayStart) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since a date.
 */
function daysSince(date) {
  if (!date) return 0;
  return -daysUntil(date);
}

export default function useSubscription() {
  const { tenantConfig } = useData();

  return useMemo(() => {
    const sub = tenantConfig?.subscription;

    // No subscription data → expired/needs upgrade
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

    // Trial
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

    // Active paid subscription
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

    // Past due — grace period with dunning
    if (status === "past_due") {
      const failedAt = toDate(sub.lastPaymentFailed);
      const daysSinceFailure = daysSince(failedAt);

      let dunningStage;
      if (daysSinceFailure <= 3) {
        dunningStage = DUNNING_STAGES.WARNING;
      } else if (daysSinceFailure <= DUNNING_GRACE_DAYS) {
        dunningStage = DUNNING_STAGES.URGENT;
      } else {
        dunningStage = DUNNING_STAGES.SUSPENDED;
      }

      const isSuspended = dunningStage === DUNNING_STAGES.SUSPENDED;

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

    // Cancelled
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

    // Unknown status → treat as expired (safe default)
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
  }, [tenantConfig?.subscription]);
}

export { DUNNING_STAGES };
