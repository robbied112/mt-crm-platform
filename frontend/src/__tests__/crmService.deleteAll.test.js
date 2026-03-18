/**
 * Tests for crmService.deleteAllCrmData — verifies that all CRM
 * collections (including notes subcollections) are fully drained.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Firestore ─────────────────────────────────────────

const mockDocs = new Map();

function pathKey(...segments) {
  return segments.join("/");
}

const mockDeleteDoc = vi.fn(async (ref) => {
  mockDocs.delete(ref._path);
});

const mockGetDocs = vi.fn(async (ref) => {
  const basePath = ref._collPath || ref._path;
  const docs = [];
  for (const [key, val] of mockDocs.entries()) {
    if (
      key.startsWith(basePath + "/") &&
      key.split("/").length === basePath.split("/").length + 1
    ) {
      docs.push({
        id: key.split("/").pop(),
        data: () => val,
        ref: { _path: key },
      });
    }
  }
  return { docs, empty: docs.length === 0 };
});

vi.mock("firebase/firestore", () => ({
  doc: (...args) => {
    const [, ...pathParts] = args;
    return { _path: pathKey(...pathParts), id: pathParts[pathParts.length - 1] };
  },
  collection: (...args) => {
    const [, ...pathParts] = args;
    return { _collPath: pathKey(...pathParts) };
  },
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  addDoc: vi.fn(),
  query: (collRef) => ({ _collPath: collRef._collPath, _path: collRef._collPath }),
  where: () => ({ _type: "where" }),
  orderBy: () => ({ _type: "orderBy" }),
  limit: () => ({ _type: "limit" }),
  serverTimestamp: () => "SERVER_TS",
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("../config/firebase", () => ({
  db: { _type: "db" },
}));

vi.mock("../utils/productNormalize", () => ({
  buildNormalizedName: (name) => name?.toLowerCase() || "",
}));

const { deleteAllCrmData } = await import("../services/crmService.js");

// ─── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  mockDocs.clear();
  vi.clearAllMocks();
});

describe("deleteAllCrmData", () => {
  it("deletes all CRM entities across all collections", async () => {
    mockDocs.set("tenants/t1/accounts/a1", { name: "Acme" });
    mockDocs.set("tenants/t1/accounts/a2", { name: "Beta" });
    mockDocs.set("tenants/t1/contacts/c1", { lastName: "Smith" });
    mockDocs.set("tenants/t1/activityLog/act1", { type: "call" });
    mockDocs.set("tenants/t1/tasks/tk1", { title: "Follow up" });
    mockDocs.set("tenants/t1/opportunities/opp1", { title: "Deal" });
    mockDocs.set("tenants/t1/products/p1", { name: "Wine A" });

    await deleteAllCrmData("t1");

    expect(mockDocs.has("tenants/t1/accounts/a1")).toBe(false);
    expect(mockDocs.has("tenants/t1/accounts/a2")).toBe(false);
    expect(mockDocs.has("tenants/t1/contacts/c1")).toBe(false);
    expect(mockDocs.has("tenants/t1/activityLog/act1")).toBe(false);
    expect(mockDocs.has("tenants/t1/tasks/tk1")).toBe(false);
    expect(mockDocs.has("tenants/t1/opportunities/opp1")).toBe(false);
    expect(mockDocs.has("tenants/t1/products/p1")).toBe(false);
  });

  it("deletes notes subcollections before deleting accounts", async () => {
    mockDocs.set("tenants/t1/accounts/a1", { name: "Acme" });
    mockDocs.set("tenants/t1/accounts/a1/notes/n1", { text: "Note 1" });
    mockDocs.set("tenants/t1/accounts/a1/notes/n2", { text: "Note 2" });
    mockDocs.set("tenants/t1/accounts/a2", { name: "Beta" });
    mockDocs.set("tenants/t1/accounts/a2/notes/n3", { text: "Note 3" });

    await deleteAllCrmData("t1");

    expect(mockDocs.has("tenants/t1/accounts/a1/notes/n1")).toBe(false);
    expect(mockDocs.has("tenants/t1/accounts/a1/notes/n2")).toBe(false);
    expect(mockDocs.has("tenants/t1/accounts/a2/notes/n3")).toBe(false);
    expect(mockDocs.has("tenants/t1/accounts/a1")).toBe(false);
    expect(mockDocs.has("tenants/t1/accounts/a2")).toBe(false);
  });

  it("succeeds when all collections are empty", async () => {
    await expect(deleteAllCrmData("t1")).resolves.toBeUndefined();
  });

  it("does not touch non-CRM collections", async () => {
    mockDocs.set("tenants/t1/config/main", { userRole: "rep" });
    mockDocs.set("tenants/t1/accounts/a1", { name: "Acme" });

    await deleteAllCrmData("t1");

    expect(mockDocs.has("tenants/t1/config/main")).toBe(true);
    expect(mockDocs.has("tenants/t1/accounts/a1")).toBe(false);
  });
});
