/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Test that activeTab resets when blueprint changes
// This verifies the bug fix: setActiveTab(bpData.tabs[0].id) instead of
// setActiveTab((prev) => prev || bpData.tabs[0].id)

describe("BlueprintContext activeTab reset", () => {
  it("setActiveTab should be called with the first tab ID directly (not conditionally)", async () => {
    // Read the source to verify the fix is in place
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../context/BlueprintContext.jsx"),
      "utf-8",
    );

    // The bug was: setActiveTab((prev) => prev || bpData.tabs[0].id)
    // The fix is: setActiveTab(bpData.tabs[0].id)
    expect(source).toContain("setActiveTab(bpData.tabs[0].id)");
    expect(source).not.toContain("prev || bpData.tabs[0].id");
  });
});
