/**
 * Tests for services/teamService.js — invite creation and team member listing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...path) => path.join("/")),
  doc: vi.fn((_db, ...path) => path.join("/")),
  addDoc: (...args) => mockAddDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  query: vi.fn((...args) => args),
  where: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));

vi.mock("../config/firebase", () => ({
  db: {},
}));

const { createInvite, listInvites, deleteInvite, listTeamMembers } = await import(
  "../services/teamService"
);

describe("teamService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomUUID
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-1234");
  });

  describe("createInvite", () => {
    it("creates an invite with correct data", async () => {
      mockAddDoc.mockResolvedValue({ id: "invite-123" });

      const result = await createInvite("tenant-1", {
        role: "rep",
        territory: "Southeast",
        maxUses: 5,
        createdBy: "admin-uid",
      });

      expect(result).toEqual({ id: "invite-123", code: "test-uuid-1234" });
      expect(mockAddDoc).toHaveBeenCalledOnce();

      const [, data] = mockAddDoc.mock.calls[0];
      expect(data.code).toBe("test-uuid-1234");
      expect(data.tenantId).toBe("tenant-1");
      expect(data.role).toBe("rep");
      expect(data.territory).toBe("Southeast");
      expect(data.maxUses).toBe(5);
      expect(data.usedCount).toBe(0);
      expect(data.createdBy).toBe("admin-uid");
      expect(data.expiresAt).toBeTruthy();
    });

    it("defaults to role=rep, territory=all, maxUses=1, expiryDays=7", async () => {
      mockAddDoc.mockResolvedValue({ id: "inv-2" });

      await createInvite("t1", { createdBy: "uid" });

      const [, data] = mockAddDoc.mock.calls[0];
      expect(data.role).toBe("rep");
      expect(data.territory).toBe("all");
      expect(data.maxUses).toBe(1);

      // Expiry should be ~7 days from now
      const expiry = new Date(data.expiresAt);
      const now = new Date();
      const daysDiff = (expiry - now) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);
    });
  });

  describe("listInvites", () => {
    it("returns mapped invite documents", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "inv-1", data: () => ({ code: "abc", role: "rep" }) },
          { id: "inv-2", data: () => ({ code: "def", role: "admin" }) },
        ],
      });

      const result = await listInvites("tenant-1");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "inv-1", code: "abc", role: "rep" });
      expect(result[1]).toEqual({ id: "inv-2", code: "def", role: "admin" });
    });
  });

  describe("deleteInvite", () => {
    it("calls deleteDoc with correct path", async () => {
      mockDeleteDoc.mockResolvedValue();
      await deleteInvite("tenant-1", "inv-1");
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe("listTeamMembers", () => {
    it("returns mapped user documents with uid", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: "uid-1", data: () => ({ email: "a@b.com", role: "admin" }) },
          { id: "uid-2", data: () => ({ email: "c@d.com", role: "rep" }) },
        ],
      });

      const result = await listTeamMembers("tenant-1");
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe("uid-1");
      expect(result[0].email).toBe("a@b.com");
      expect(result[1].uid).toBe("uid-2");
      expect(result[1].role).toBe("rep");
    });
  });
});
