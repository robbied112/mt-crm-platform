/**
 * Regression: blank screen when provider crashes during startup.
 * Found by /qa on 2026-03-18 — direct URL navigation to /settings rendered
 * a completely blank page (root had 0 children) because no ErrorBoundary
 * wrapped the provider tree.
 *
 * Report: .gstack/qa-reports/qa-report-crufolio-com-2026-03-18.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ErrorBoundary is a class component — we test the logic directly
// by simulating what React does: call getDerivedStateFromError + render.

import ErrorBoundary from "../components/ErrorBoundary";

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("getDerivedStateFromError returns error state", () => {
    const error = new Error("Provider init failed");
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state).toEqual({ hasError: true, error });
  });

  it("initial state has no error", () => {
    const boundary = new ErrorBoundary({});
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBe(null);
  });

  it("renders children when no error", () => {
    const boundary = new ErrorBoundary({ children: "hello" });
    boundary.state = { hasError: false, error: null };
    const result = boundary.render();
    expect(result).toBe("hello");
  });

  it("renders fallback UI when error is set", () => {
    const boundary = new ErrorBoundary({});
    boundary.state = { hasError: true, error: new Error("crash") };
    const result = boundary.render();
    // Should return JSX with error message, not children
    expect(result).not.toBe(undefined);
    expect(result).not.toBe(null);
    // The fallback contains the error message
    expect(JSON.stringify(result)).toContain("crash");
  });

  it("componentDidCatch logs to console.error", () => {
    const boundary = new ErrorBoundary({});
    const error = new Error("test error");
    const info = { componentStack: "at App" };
    boundary.componentDidCatch(error, info);
    expect(console.error).toHaveBeenCalledWith(
      "ErrorBoundary caught:",
      error,
      info,
    );
  });
});
