/**
 * Vitest setup file — conditionally loads jest-dom matchers for jsdom tests.
 * Safe to load in node environment (no-ops when no DOM is available).
 */
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}
