/**
 * Tests for firestoreService — verifies the dual-path (data/ vs views/)
 * routing and import CRUD logic.
 *
 * Firestore is mocked; integration tests with the emulator are in TODO-026.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock firebase/firestore ────────────────────────────────
// We mock at the module level so firestoreService uses our fakes.

const mockDocs = new Map(); // path → data
let autoIdCounter = 0;

function pathKey(...segments) {
  return segments.join("/");
}

const mockGetDoc = vi.fn(async (ref) => {
  const data = mockDocs.get(ref._path);
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: ref._path.split("/").pop(),
    ref,
  };
});

const mockSetDoc = vi.fn(async (ref, data) => {
  // Strip serverTimestamp markers for test simplicity
  const cleaned = { ...data };
  if (cleaned.updatedAt === "SERVER_TS") cleaned.updatedAt = Date.now();
  if (cleaned.createdAt === "SERVER_TS") cleaned.createdAt = Date.now();
  mockDocs.set(ref._path, cleaned);
});

const mockDeleteDoc = vi.fn(async (ref) => {
  mockDocs.delete(ref._path);
});

const mockGetDocs = vi.fn(async (queryOrRef) => {
  const basePath = queryOrRef._path || queryOrRef._collPath;
  const docs = [];
  for (const [key, val] of mockDocs.entries()) {
    if (key.startsWith(basePath + "/") && key.split("/").length === basePath.split("/").length + 1) {
      // Apply version filter if present
      if (queryOrRef._whereVersion !== undefined && val.version !== queryOrRef._whereVersion) continue;
      docs.push({
        id: key.split("/").pop(),
        data: () => val,
        ref: { _path: key },
      });
    }
  }
  return { docs, empty: docs.length === 0 };
});

// Minimal mocks for firebase/firestore functions
vi.mock("firebase/firestore", () => ({
  doc: (...args) => {
    // doc(db, ...path) or doc(collectionRef) for auto-ID
    if (args.length === 1 && args[0]._collPath) {
      // Auto-ID: doc(collectionRef)
      const id = `auto_${++autoIdCounter}`;
      return { _path: `${args[0]._collPath}/${id}`, id };
    }
    const [, ...pathParts] = args;
    return { _path: pathKey(...pathParts), id: pathParts[pathParts.length - 1] };
  },
  collection: (...args) => {
    const [, ...pathParts] = args;
    return { _collPath: pathKey(...pathParts) };
  },
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  addDoc: vi.fn(async (collRef, data) => {
    const id = `auto_${++autoIdCounter}`;
    const path = `${collRef._collPath}/${id}`;
    mockDocs.set(path, data);
    return { id, _path: path };
  }),
  query: (collRef, ...constraints) => {
    const q = { _collPath: collRef._collPath, _path: collRef._collPath };
    for (const c of constraints) {
      if (c._type === "where" && c._field === "version") q._whereVersion = c._value;
    }
    return q;
  },
  where: (field, op, value) => ({ _type: "where", _field: field, _op: op, _value: value }),
  orderBy: () => ({ _type: "orderBy" }),
  limit: () => ({ _type: "limit" }),
  serverTimestamp: () => "SERVER_TS",
}));

vi.mock("../config/firebase", () => ({
  db: { _type: "db" },
}));

// ─── Import the module under test ───────────────────────────

const {
  loadAllData,
  loadAllViews,
  saveDataset,
  saveAllDatasets,
  saveAllViews,
  saveImport,
  loadImports,
  loadImportRows,
  deleteImport,
  deleteAllData,
  loadSummary,
  saveSummary,
} = await import("../services/firestoreService.js");

// ─── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  mockDocs.clear();
  autoIdCounter = 0;
  vi.clearAllMocks();
});

describe("loadAllData (legacy data/ path)", () => {
  it("returns EMPTY defaults when no data exists", async () => {
    const result = await loadAllData("t1");
    expect(result.distScorecard).toEqual([]);
    expect(result.pipelineMeta).toEqual({});
    expect(result.reorderData).toEqual([]);
  });

  it("reads non-chunked datasets", async () => {
    mockDocs.set("tenants/t1/data/distScorecard", {
      chunked: false,
      items: [{ name: "A", score: 90 }],
    });
    const result = await loadAllData("t1");
    expect(result.distScorecard).toEqual([{ name: "A", score: 90 }]);
  });
});

describe("loadAllViews (normalized views/ path)", () => {
  it("returns EMPTY defaults when no views exist", async () => {
    const result = await loadAllViews("t1");
    expect(result.distScorecard).toEqual([]);
    expect(result.pipelineMeta).toEqual({});
  });

  it("reads from views/ not data/", async () => {
    // Put data in views/ path
    mockDocs.set("tenants/t1/views/distScorecard", {
      chunked: false,
      items: [{ name: "B", score: 80 }],
    });
    // Put different data in data/ path
    mockDocs.set("tenants/t1/data/distScorecard", {
      chunked: false,
      items: [{ name: "A", score: 90 }],
    });

    const views = await loadAllViews("t1");
    const data = await loadAllData("t1");
    expect(views.distScorecard).toEqual([{ name: "B", score: 80 }]);
    expect(data.distScorecard).toEqual([{ name: "A", score: 90 }]);
  });
});

describe("saveAllViews", () => {
  it("writes to views/ path", async () => {
    await saveAllViews("t1", { distScorecard: [{ name: "X" }] });
    expect(mockDocs.has("tenants/t1/views/distScorecard")).toBe(true);
    expect(mockDocs.has("tenants/t1/data/distScorecard")).toBe(false);
  });
});

describe("saveAllDatasets (legacy)", () => {
  it("writes to data/ path", async () => {
    await saveAllDatasets("t1", { distScorecard: [{ name: "X" }] });
    expect(mockDocs.has("tenants/t1/data/distScorecard")).toBe(true);
    expect(mockDocs.has("tenants/t1/views/distScorecard")).toBe(false);
  });

  it("ignores unknown dataset names", async () => {
    await saveAllDatasets("t1", { unknownDataset: [1, 2, 3] });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe("saveImport", () => {
  it("saves import metadata and chunked rows", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ acct: `A${i}`, qty: i * 10 }));
    const importId = await saveImport("t1", { fileName: "test.csv", type: "depletion" }, rows);

    expect(importId).toBeTruthy();
    // Meta doc should exist
    const metaPath = `tenants/t1/imports/${importId}`;
    expect(mockDocs.has(metaPath)).toBe(true);
    const meta = mockDocs.get(metaPath);
    expect(meta.fileName).toBe("test.csv");
    expect(meta.type).toBe("depletion");
    expect(meta.rowCount).toBe(3);

    // Rows chunk should exist
    const rowPath = `tenants/t1/imports/${importId}/rows/0`;
    expect(mockDocs.has(rowPath)).toBe(true);
    const chunk = mockDocs.get(rowPath);
    expect(chunk.items).toHaveLength(3);
    expect(chunk.idx).toBe(0);
  });

  it("chunks rows when exceeding CHUNK_SIZE", async () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ acct: `A${i}` }));
    const importId = await saveImport("t1", { type: "depletion" }, rows);

    // Should have 2 chunks (0 and 1)
    expect(mockDocs.has(`tenants/t1/imports/${importId}/rows/0`)).toBe(true);
    expect(mockDocs.has(`tenants/t1/imports/${importId}/rows/1`)).toBe(true);
    const chunk0 = mockDocs.get(`tenants/t1/imports/${importId}/rows/0`);
    const chunk1 = mockDocs.get(`tenants/t1/imports/${importId}/rows/1`);
    expect(chunk0.items).toHaveLength(500);
    expect(chunk1.items).toHaveLength(100);
  });
});

describe("loadImportRows", () => {
  it("loads and concatenates chunked rows in order", async () => {
    mockDocs.set("tenants/t1/imports/imp1/rows/0", { idx: 0, items: [{ a: 1 }, { a: 2 }] });
    mockDocs.set("tenants/t1/imports/imp1/rows/1", { idx: 1, items: [{ a: 3 }] });

    const rows = await loadImportRows("t1", "imp1");
    expect(rows).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });
});

describe("deleteImport", () => {
  it("deletes the import doc and all row chunks", async () => {
    mockDocs.set("tenants/t1/imports/imp1", { fileName: "test.csv" });
    mockDocs.set("tenants/t1/imports/imp1/rows/0", { idx: 0, items: [{ a: 1 }] });
    mockDocs.set("tenants/t1/imports/imp1/rows/1", { idx: 1, items: [{ a: 2 }] });

    await deleteImport("t1", "imp1");

    expect(mockDocs.has("tenants/t1/imports/imp1")).toBe(false);
    expect(mockDocs.has("tenants/t1/imports/imp1/rows/0")).toBe(false);
    expect(mockDocs.has("tenants/t1/imports/imp1/rows/1")).toBe(false);
  });
});

describe("deleteAllData", () => {
  it("deletes all docs in chunked and flat collections", async () => {
    // Seed chunked collections (data, views, imports) with rows subcollections
    mockDocs.set("tenants/t1/data/distScorecard", { chunked: true });
    mockDocs.set("tenants/t1/data/distScorecard/rows/0", { idx: 0, items: [{ a: 1 }] });
    mockDocs.set("tenants/t1/views/accountsTop", { chunked: true });
    mockDocs.set("tenants/t1/views/accountsTop/rows/0", { idx: 0, items: [{ b: 2 }] });
    mockDocs.set("tenants/t1/views/_summary", { text: "summary" });
    mockDocs.set("tenants/t1/imports/imp1", { fileName: "test.csv" });
    mockDocs.set("tenants/t1/imports/imp1/rows/0", { idx: 0, items: [{ c: 3 }] });
    // Seed flat collections (uploads, uploadAudit, pendingMatches, pendingWineMatches)
    mockDocs.set("tenants/t1/uploads/up1", { fileName: "file.xlsx" });
    mockDocs.set("tenants/t1/uploadAudit/aud1", { action: "upload" });
    mockDocs.set("tenants/t1/pendingMatches/pm1", { status: "pending" });
    mockDocs.set("tenants/t1/pendingWineMatches/pwm1", { status: "pending" });

    await deleteAllData("t1");

    // Chunked collections and their rows should be gone
    expect(mockDocs.has("tenants/t1/data/distScorecard")).toBe(false);
    expect(mockDocs.has("tenants/t1/data/distScorecard/rows/0")).toBe(false);
    expect(mockDocs.has("tenants/t1/views/accountsTop")).toBe(false);
    expect(mockDocs.has("tenants/t1/views/accountsTop/rows/0")).toBe(false);
    expect(mockDocs.has("tenants/t1/views/_summary")).toBe(false);
    expect(mockDocs.has("tenants/t1/imports/imp1")).toBe(false);
    expect(mockDocs.has("tenants/t1/imports/imp1/rows/0")).toBe(false);
    // Flat collections should be gone
    expect(mockDocs.has("tenants/t1/uploads/up1")).toBe(false);
    expect(mockDocs.has("tenants/t1/uploadAudit/aud1")).toBe(false);
    expect(mockDocs.has("tenants/t1/pendingMatches/pm1")).toBe(false);
    expect(mockDocs.has("tenants/t1/pendingWineMatches/pwm1")).toBe(false);
  });

  it("succeeds when collections are already empty", async () => {
    await expect(deleteAllData("t1")).resolves.toBeUndefined();
  });

  it("does not delete config or other tenant collections", async () => {
    mockDocs.set("tenants/t1/config/main", { userRole: "rep" });
    mockDocs.set("tenants/t1/data/distScorecard", { chunked: false });

    await deleteAllData("t1");

    expect(mockDocs.has("tenants/t1/config/main")).toBe(true);
    expect(mockDocs.has("tenants/t1/data/distScorecard")).toBe(false);
  });
});

describe("dual-path routing (useNormalizedModel toggle)", () => {
  it("loadAllData and loadAllViews return independent datasets", async () => {
    // Seed both paths with different data
    mockDocs.set("tenants/t1/data/accountsTop", { chunked: false, items: [{ acct: "Legacy" }] });
    mockDocs.set("tenants/t1/views/accountsTop", { chunked: false, items: [{ acct: "Normalized" }] });

    const legacy = await loadAllData("t1");
    const normalized = await loadAllViews("t1");
    expect(legacy.accountsTop[0].acct).toBe("Legacy");
    expect(normalized.accountsTop[0].acct).toBe("Normalized");
  });

  it("saveAllDatasets writes to data/, saveAllViews writes to views/", async () => {
    await saveAllDatasets("t1", { accountsTop: [{ acct: "D" }] });
    await saveAllViews("t1", { accountsTop: [{ acct: "V" }] });

    expect(mockDocs.get("tenants/t1/data/accountsTop").items).toEqual([{ acct: "D" }]);
    expect(mockDocs.get("tenants/t1/views/accountsTop").items).toEqual([{ acct: "V" }]);
  });

  it("summary uses correct path per model", async () => {
    await saveSummary("t1", "Legacy summary");
    await saveSummary("t1", "Normalized summary", "views");

    expect(await loadSummary("t1")).toBe("Legacy summary");
    expect(await loadSummary("t1", "views")).toBe("Normalized summary");
  });
});

describe("loadSummary / saveSummary", () => {
  it("defaults to data/ path for legacy", async () => {
    mockDocs.set("tenants/t1/data/_summary", { text: "Legacy summary" });
    const result = await loadSummary("t1");
    expect(result).toBe("Legacy summary");
  });

  it("reads from views/ path when specified", async () => {
    mockDocs.set("tenants/t1/views/_summary", { text: "Views summary" });
    const result = await loadSummary("t1", "views");
    expect(result).toBe("Views summary");
  });

  it("saves to the specified path", async () => {
    await saveSummary("t1", "New summary", "views");
    expect(mockDocs.has("tenants/t1/views/_summary")).toBe(true);
    expect(mockDocs.get("tenants/t1/views/_summary").text).toBe("New summary");
  });
});
