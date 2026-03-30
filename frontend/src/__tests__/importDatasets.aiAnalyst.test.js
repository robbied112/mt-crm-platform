/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";

// Track which Cloud Functions get called
const calledFunctions = [];
const mockHttpsCallable = vi.fn((fns, name) => {
  return vi.fn(async (data) => {
    calledFunctions.push({ name, data });
    return { data: { status: "success" } };
  });
});

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // returns unsubscribe
}));

vi.mock("../config/firebase", () => ({
  db: {},
}));

// Mock firestoreService
const mockSaveImport = vi.fn(async () => "import-123");
vi.mock("../services/firestoreService", () => ({
  loadAllData: vi.fn(async () => ({})),
  loadAllViews: vi.fn(async () => ({})),
  saveAllDatasets: vi.fn(async () => {}),
  saveImport: (...args) => mockSaveImport(...args),
  loadSummary: vi.fn(async () => ({ text: "", monthAxis: [] })),
  saveSummary: vi.fn(async () => {}),
  loadTenantConfig: vi.fn(async () => ({ useNormalizedModel: true, features: {} })),
  saveTenantConfig: vi.fn(async () => {}),
  loadBudget: vi.fn(async () => null),
  saveBudget: vi.fn(async () => {}),
}));

vi.mock("../utils/normalize.js", () => ({
  normalizeRows: vi.fn((rows) => rows),
}));

vi.mock("../config/tenant", () => ({
  default: { useNormalizedModel: true, features: {} },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ currentUser: { uid: "u1", email: "test@test.com" }, tenantId: "t1" })),
}));

// Import after mocks
import DataProvider, { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";

function wrapper({ children }) {
  return createElement(DataProvider, null, children);
}

describe("importDatasets aiAnalyst conditional", () => {
  beforeEach(() => {
    calledFunctions.length = 0;
    mockSaveImport.mockClear();
    mockHttpsCallable.mockClear();

    // Re-mock useAuth for each test
    useAuth.mockReturnValue({
      currentUser: { uid: "u1", email: "test@test.com" },
      tenantId: "t1",
    });
  });

  it("calls rebuildViews when aiAnalyst is false (default behavior)", async () => {
    const { result } = renderHook(() => useData(), { wrapper });

    // Wait for initial load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Call importDatasets with normalized rows
    await act(async () => {
      await result.current.importDatasets(
        {},
        "",
        { fileName: "test.csv", type: "depletion", normalizedRows: [{ acct: "A", qty: 1 }] },
        { skipRebuild: false }
      );
    });

    // Should have called rebuildViews
    const rebuildCalls = calledFunctions.filter((c) => c.name === "rebuildViews");
    expect(rebuildCalls.length).toBe(1);

    // Should NOT have called analyzeUpload
    const analyzeCalls = calledFunctions.filter((c) => c.name === "analyzeUpload");
    expect(analyzeCalls.length).toBe(0);
  });

  it("saves rawRows when rawRows parameter is provided", async () => {
    const { result } = renderHook(() => useData(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const rawRows = [
      { "Account Name": "Total Wine", "Cases Sold": 100 },
      { "Account Name": "BevMo", "Cases Sold": 75 },
    ];

    await act(async () => {
      await result.current.importDatasets(
        {},
        "",
        { fileName: "idig.xlsx", type: "depletion", originalHeaders: ["Account Name", "Cases Sold"] },
        { skipRebuild: true, skipAnalysis: true, rawRows }
      );
    });

    // saveImport should have been called with the raw rows
    expect(mockSaveImport).toHaveBeenCalled();
    const savedRows = mockSaveImport.mock.calls[0][2]; // third arg = rows
    expect(savedRows).toEqual(rawRows);
    expect(savedRows[0]["Account Name"]).toBe("Total Wine");
  });

  it("analyzeAndRefresh calls analyzeUpload Cloud Function", async () => {
    const { result } = renderHook(() => useData(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      await result.current.analyzeAndRefresh();
    });

    const analyzeCalls = calledFunctions.filter((c) => c.name === "analyzeUpload");
    expect(analyzeCalls.length).toBe(1);
    expect(analyzeCalls[0].data).toEqual({ tenantId: "t1" });
  });
});
