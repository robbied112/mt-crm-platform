/**
 * Tests for setupAnalytics — fire-and-forget event logging.
 *
 * Key contract: logSetupEvent NEVER throws, even on Firestore errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => "mock-collection-ref"),
  addDoc: (...args) => mockAddDoc(...args),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

import { logSetupEvent } from "../services/setupAnalytics";

describe("logSetupEvent", () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockAddDoc.mockResolvedValue({ id: "mock-event-id" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("calls addDoc with correct event structure", () => {
    logSetupEvent("tenant-123", "setup_started", { role: "Winery" });

    expect(mockAddDoc).toHaveBeenCalledWith("mock-collection-ref", {
      type: "setup_started",
      properties: { role: "Winery" },
      timestamp: "mock-timestamp",
    });
  });

  it("does not throw when addDoc rejects", () => {
    mockAddDoc.mockRejectedValue(new Error("Firestore unavailable"));

    // Should not throw
    expect(() => {
      logSetupEvent("tenant-123", "guide_viewed", { distributorId: "sgws" });
    }).not.toThrow();
  });

  it("logs a warning when addDoc fails", async () => {
    mockAddDoc.mockRejectedValue(new Error("Permission denied"));

    logSetupEvent("tenant-123", "setup_completed", {});

    // Wait for the rejected promise to be caught
    await new Promise((r) => setTimeout(r, 10));

    expect(console.warn).toHaveBeenCalled();
  });

  it("does nothing when tenantId is falsy", () => {
    logSetupEvent(null, "setup_started", {});
    logSetupEvent(undefined, "setup_started", {});
    logSetupEvent("", "setup_started", {});

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("handles empty properties object", () => {
    logSetupEvent("tenant-123", "setup_dismissed", {});

    expect(mockAddDoc).toHaveBeenCalledWith("mock-collection-ref", {
      type: "setup_dismissed",
      properties: {},
      timestamp: "mock-timestamp",
    });
  });

  it("handles missing properties argument", () => {
    logSetupEvent("tenant-123", "upload_started_from_guide");

    expect(mockAddDoc).toHaveBeenCalledWith("mock-collection-ref", {
      type: "upload_started_from_guide",
      properties: {},
      timestamp: "mock-timestamp",
    });
  });
});
