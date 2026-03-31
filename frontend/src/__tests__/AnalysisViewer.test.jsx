/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock dependencies
vi.mock("../context/BlueprintContext", () => ({
  useBlueprint: vi.fn(),
}));

vi.mock("../context/DataContext", () => ({
  useData: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ currentUser: { email: "test@test.com" }, tenantId: "t1" })),
}));

vi.mock("../context/CrmContext", () => ({
  useCrm: vi.fn(() => ({ createTask: vi.fn() })),
}));

vi.mock("../utils/parseFile", () => ({
  default: vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock BlueprintRenderer to keep tests focused on AnalysisViewer logic
vi.mock("../components/reports/BlueprintRenderer", () => ({
  default: () => <div data-testid="blueprint-renderer">Dashboard</div>,
}));

import AnalysisViewer from "../components/AnalysisViewer";
import { useBlueprint } from "../context/BlueprintContext";
import { useData } from "../context/DataContext";

function setup({ blueprintOverrides = {}, dataOverrides = {} } = {}) {
  cleanup();

  useBlueprint.mockReturnValue({
    blueprint: null,
    hasBlueprint: false,
    loading: false,
    activeTab: null,
    setActiveTab: vi.fn(),
    filters: {},
    setFilters: vi.fn(),
    getFilteredData: vi.fn(() => []),
    computedData: {},
    ...blueprintOverrides,
  });

  useData.mockReturnValue({
    importDatasets: vi.fn(),
    tenantConfig: { features: { aiAnalyst: true } },
    ...dataOverrides,
  });

  return render(<AnalysisViewer />);
}

describe("AnalysisViewer", () => {
  it("shows empty state when no blueprint exists", () => {
    setup();
    expect(screen.getByText("Your AI Wine Analyst")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your AI Wine Analyst");
  });

  it("shows skeleton when loading", () => {
    setup({ blueprintOverrides: { loading: true } });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders narrative section when blueprint has narrative", () => {
    setup({
      blueprintOverrides: {
        hasBlueprint: true,
        blueprint: {
          tabs: [{ id: "t1", label: "Overview", sections: [] }],
          narrative: {
            segments: [
              { type: "text", content: "California depletions surged this quarter." },
              { type: "text", content: "Total Wine remains your largest account." },
            ],
            suggestedQuestions: ["Which accounts are declining?", "Best SKU?"],
            actions: [
              { text: "Call Total Wine buyer", priority: 1, relatedAccount: "Total Wine" },
            ],
          },
          dataSources: [{ fileName: "idig_ca.xlsx", fileType: "depletion" }],
        },
      },
    });

    // Narrative hook line
    expect(screen.getByText(/California depletions surged this quarter/)).toBeInTheDocument();
    expect(screen.getByText("Total Wine remains your largest account.")).toBeInTheDocument();

    // Suggested questions (now buttons)
    expect(screen.getByRole("button", { name: /Which accounts are declining/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Best SKU/ })).toBeInTheDocument();

    // Actions
    expect(screen.getByText("Call Total Wine buyer")).toBeInTheDocument();

    // Data sources
    expect(screen.getByText("idig_ca.xlsx")).toBeInTheDocument();

    // Dashboard renderer
    expect(screen.getByTestId("blueprint-renderer")).toBeInTheDocument();
  });

  it("shows compact upload strip when blueprint exists", () => {
    setup({
      blueprintOverrides: {
        hasBlueprint: true,
        blueprint: {
          tabs: [],
          narrative: {
            segments: [{ type: "text", content: "Analysis." }],
            suggestedQuestions: [],
            actions: [],
          },
          dataSources: [],
        },
      },
    });

    expect(screen.getByText("Add more reports")).toBeInTheDocument();
  });

  it("shows empty-state upload strip when no blueprint", () => {
    setup();
    expect(screen.getByText("Drop your first reports here")).toBeInTheDocument();
  });

  it("renders without narrative gracefully", () => {
    setup({
      blueprintOverrides: {
        hasBlueprint: true,
        blueprint: {
          tabs: [{ id: "t1", label: "Overview", sections: [] }],
          dataSources: [],
        },
      },
    });

    expect(screen.getByTestId("blueprint-renderer")).toBeInTheDocument();
  });
});
