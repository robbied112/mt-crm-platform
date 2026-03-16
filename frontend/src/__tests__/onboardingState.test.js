/**
 * Tests for onboarding state machine transitions.
 *
 * The onboarding state is a plain object on tenantConfig.onboarding.
 * State transitions: undefined → fresh → in-progress → complete
 */
import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS } from "../config/reportGuides";

function getOnboardingStatus(onboarding) {
  if (!onboarding) return "fresh";
  if (onboarding.dismissedAt) return "dismissed";
  const completed = onboarding.completedSteps || [];
  if (completed.length === 0) return "fresh";
  if (completed.length >= ONBOARDING_STEPS.length) return "complete";
  return "in-progress";
}

function getCurrentStep(onboarding) {
  const completed = (onboarding?.completedSteps) || [];
  for (const step of ONBOARDING_STEPS) {
    if (!completed.includes(step)) return step;
  }
  return "health"; // all done
}

function getProgress(onboarding) {
  if (!onboarding) return { completed: 0, total: ONBOARDING_STEPS.length };
  const completed = (onboarding.completedSteps || []).length;
  return { completed, total: ONBOARDING_STEPS.length };
}

describe("onboarding state machine", () => {
  it("returns 'fresh' for undefined onboarding", () => {
    expect(getOnboardingStatus(undefined)).toBe("fresh");
    expect(getOnboardingStatus(null)).toBe("fresh");
  });

  it("returns 'fresh' for empty completedSteps", () => {
    expect(getOnboardingStatus({ completedSteps: [] })).toBe("fresh");
  });

  it("returns 'in-progress' for partial completion", () => {
    expect(getOnboardingStatus({ completedSteps: ["role"] })).toBe("in-progress");
    expect(getOnboardingStatus({ completedSteps: ["role", "distributors"] })).toBe("in-progress");
    expect(getOnboardingStatus({ completedSteps: ["role", "distributors", "guides", "upload"] })).toBe("in-progress");
  });

  it("returns 'complete' when all steps are done", () => {
    expect(getOnboardingStatus({
      completedSteps: ["role", "distributors", "guides", "upload", "health"],
    })).toBe("complete");
  });

  it("returns 'dismissed' when dismissedAt is set, regardless of progress", () => {
    expect(getOnboardingStatus({
      completedSteps: ["role"],
      dismissedAt: "2026-03-16T12:00:00Z",
    })).toBe("dismissed");
  });

  it("returns 'dismissed' even with full completion if dismissedAt set", () => {
    expect(getOnboardingStatus({
      completedSteps: ONBOARDING_STEPS,
      dismissedAt: "2026-03-16T12:00:00Z",
    })).toBe("dismissed");
  });
});

describe("getCurrentStep", () => {
  it("returns 'role' for fresh onboarding", () => {
    expect(getCurrentStep(undefined)).toBe("role");
    expect(getCurrentStep(null)).toBe("role");
    expect(getCurrentStep({ completedSteps: [] })).toBe("role");
  });

  it("returns next incomplete step", () => {
    expect(getCurrentStep({ completedSteps: ["role"] })).toBe("distributors");
    expect(getCurrentStep({ completedSteps: ["role", "distributors"] })).toBe("guides");
    expect(getCurrentStep({ completedSteps: ["role", "distributors", "guides"] })).toBe("upload");
    expect(getCurrentStep({ completedSteps: ["role", "distributors", "guides", "upload"] })).toBe("health");
  });

  it("returns 'health' when all steps complete", () => {
    expect(getCurrentStep({ completedSteps: ONBOARDING_STEPS })).toBe("health");
  });

  it("handles out-of-order completion", () => {
    // If only "guides" is done, role is still the first missing step
    expect(getCurrentStep({ completedSteps: ["guides"] })).toBe("role");
  });
});

describe("getProgress", () => {
  it("returns 0/5 for undefined onboarding", () => {
    const result = getProgress(undefined);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(5);
  });

  it("returns correct progress for partial completion", () => {
    const result = getProgress({ completedSteps: ["role", "distributors"] });
    expect(result.completed).toBe(2);
    expect(result.total).toBe(5);
  });

  it("returns 5/5 for full completion", () => {
    const result = getProgress({ completedSteps: ONBOARDING_STEPS });
    expect(result.completed).toBe(5);
    expect(result.total).toBe(5);
  });
});
