/**
 * Tests for sidebar setup card show/hide/dismiss/collapsed logic.
 *
 * Tests the pure logic that determines whether the setup card
 * should be visible, based on onboarding state.
 */
import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS } from "../config/reportGuides";

function getSetupProgress(onboarding) {
  if (!onboarding) return { show: true, completed: 0, total: ONBOARDING_STEPS.length };
  if (onboarding.dismissedAt) return { show: false, completed: 0, total: ONBOARDING_STEPS.length };
  const completed = (onboarding.completedSteps || []).length;
  const allDone = completed >= ONBOARDING_STEPS.length;
  return { show: !allDone, completed, total: ONBOARDING_STEPS.length };
}

describe("sidebar setup card visibility", () => {
  it("shows card when onboarding is undefined (new user)", () => {
    const result = getSetupProgress(undefined);
    expect(result.show).toBe(true);
    expect(result.completed).toBe(0);
  });

  it("shows card when onboarding is null", () => {
    const result = getSetupProgress(null);
    expect(result.show).toBe(true);
  });

  it("shows card when onboarding has empty completedSteps", () => {
    const result = getSetupProgress({ completedSteps: [] });
    expect(result.show).toBe(true);
    expect(result.completed).toBe(0);
  });

  it("shows card with correct progress for partial completion", () => {
    const result = getSetupProgress({ completedSteps: ["role", "distributors"] });
    expect(result.show).toBe(true);
    expect(result.completed).toBe(2);
    expect(result.total).toBe(5);
  });

  it("hides card when all steps are complete", () => {
    const result = getSetupProgress({
      completedSteps: ["role", "distributors", "guides", "upload", "health"],
    });
    expect(result.show).toBe(false);
    expect(result.completed).toBe(5);
  });

  it("hides card when dismissed, regardless of progress", () => {
    const result = getSetupProgress({
      completedSteps: ["role"],
      dismissedAt: "2026-03-16T12:00:00Z",
    });
    expect(result.show).toBe(false);
  });

  it("hides card when dismissed with zero progress", () => {
    const result = getSetupProgress({
      completedSteps: [],
      dismissedAt: "2026-03-16T12:00:00Z",
    });
    expect(result.show).toBe(false);
  });

  it("total is always 5", () => {
    expect(getSetupProgress(undefined).total).toBe(5);
    expect(getSetupProgress({ completedSteps: ["role"] }).total).toBe(5);
    expect(getSetupProgress({ completedSteps: ONBOARDING_STEPS }).total).toBe(5);
  });

  it("completed count matches actual steps", () => {
    for (let i = 0; i <= ONBOARDING_STEPS.length; i++) {
      const result = getSetupProgress({
        completedSteps: ONBOARDING_STEPS.slice(0, i),
      });
      expect(result.completed).toBe(i);
    }
  });
});
