/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock dependencies
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../context/BriefingContext", () => ({
  useBriefing: vi.fn(),
}));

vi.mock("../context/DataContext", () => ({
  useData: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ currentUser: { email: "test@test.com" }, tenantId: "t1" })),
}));

vi.mock("../components/EmptyState", () => ({
  WelcomeState: () => <div data-testid="welcome-state">Welcome</div>,
}));

import AIBriefing from "../components/AIBriefing/AIBriefing";
import { useBriefing } from "../context/BriefingContext";
import { useData } from "../context/DataContext";

function setup({ briefingOverrides = {}, dataOverrides = {} } = {}) {
  cleanup();

  useBriefing.mockReturnValue({
    briefing: null,
    briefingLoading: false,
    briefingError: null,
    submitFeedback: vi.fn(),
    saveScrollPosition: vi.fn(),
    restoreScrollPosition: vi.fn(() => 0),
    ...briefingOverrides,
  });

  useData.mockReturnValue({
    availability: { hasAnyData: true },
    tenantConfig: { subscription: { plan: "pro" } },
    ...dataOverrides,
  });

  return render(<AIBriefing />);
}

describe("AIBriefing", () => {
  it("shows WelcomeState when no data", () => {
    setup({ dataOverrides: { availability: { hasAnyData: false } } });
    expect(screen.getByTestId("welcome-state")).toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    setup({ briefingOverrides: { briefingLoading: true } });
    expect(screen.getByText("Analyzing your data...")).toBeInTheDocument();
  });

  it("shows skeleton when generating (no briefing yet)", () => {
    setup({ briefingOverrides: { briefing: null, briefingLoading: false } });
    expect(screen.getByText("Analyzing your data...")).toBeInTheDocument();
  });

  it("shows starter upgrade view for starter tier", () => {
    setup({
      dataOverrides: {
        availability: { hasAnyData: true },
        tenantConfig: { subscription: { plan: "starter", aiCalls: false } },
      },
    });
    expect(screen.getByText("Unlock your AI briefing")).toBeInTheDocument();
    expect(screen.getByText("Upgrade Plan")).toBeInTheDocument();
  });

  it("renders briefing with narrative and changes", () => {
    const briefing = {
      id: "123",
      narrativeSegments: [
        { type: "text", content: "Your California market is on fire." },
        { type: "text", content: "Volume is up across the board." },
      ],
      changes: [
        { direction: "up", title: "Depletions up 12%", detail: "800 vs 714 cases", evidence: { tab: "depletions" }, impact: "high" },
      ],
      risks: [
        { type: "inventory", title: "2 SKUs low stock", detail: "Cab 2021, Chard 2022", quantifiedImpact: "Stockout in 10 days" },
      ],
      actions: [
        { text: "Call Total Wine Pasadena", priority: 1, relatedAccount: "Total Wine" },
      ],
      drillDownStats: [
        { tab: "depletions", headline: "Total Cases", value: "800", trend: "up 12%" },
      ],
      suggestedQuestions: ["Which accounts grew most?"],
      feedback: null,
      createdAt: { toMillis: () => Date.now() - 86400000 }, // 1 day ago
    };

    setup({ briefingOverrides: { briefing } });

    expect(screen.getByText("Your California market is on fire.")).toBeInTheDocument();
    expect(screen.getByText("Volume is up across the board.")).toBeInTheDocument();
    expect(screen.getByText("Depletions up 12%")).toBeInTheDocument();
    expect(screen.getByText("2 SKUs low stock")).toBeInTheDocument();
    expect(screen.getByText("Call Total Wine Pasadena")).toBeInTheDocument();
    expect(screen.getByText("Which accounts grew most?")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("shows stale warning when briefing is >7 days old", () => {
    const briefing = {
      id: "123",
      narrativeSegments: [{ type: "text", content: "Old briefing." }],
      changes: [],
      risks: [],
      actions: [],
      drillDownStats: [],
      suggestedQuestions: [],
      feedback: null,
      createdAt: { toMillis: () => Date.now() - 10 * 86400000 }, // 10 days ago
    };

    setup({ briefingOverrides: { briefing } });
    expect(screen.getByText(/days old/)).toBeInTheDocument();
    expect(screen.getByText(/Upload fresh data/)).toBeInTheDocument();
  });

  it("renders sparkline placeholder for sparkline segments", () => {
    const briefing = {
      id: "123",
      narrativeSegments: [
        { type: "text", content: "Sales are trending." },
        { type: "sparkline", metric: "depletions", dataset: "distScorecard", field: "totalQty", label: "Depletions trend" },
      ],
      changes: [],
      risks: [],
      actions: [],
      drillDownStats: [],
      suggestedQuestions: [],
      feedback: null,
      createdAt: { toMillis: () => Date.now() },
    };

    setup({ briefingOverrides: { briefing } });
    expect(screen.getByLabelText("Depletions trend")).toBeInTheDocument();
  });

  it("shows evidence KPIs in the rail", () => {
    const briefing = {
      id: "123",
      narrativeSegments: [{ type: "text", content: "Test." }],
      changes: [],
      risks: [],
      actions: [],
      drillDownStats: [
        { tab: "depletions", headline: "Total Cases", value: "800", trend: "" },
        { tab: "inventory", headline: "Avg DOH", value: "45", trend: "" },
      ],
      suggestedQuestions: [],
      feedback: null,
      createdAt: { toMillis: () => Date.now() },
    };

    setup({ briefingOverrides: { briefing } });
    expect(screen.getByText("Total Cases")).toBeInTheDocument();
    expect(screen.getByText("Avg DOH")).toBeInTheDocument();
  });
});
