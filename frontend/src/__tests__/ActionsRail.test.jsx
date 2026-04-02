/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("../context/CrmContext", () => ({
  useCrm: vi.fn(() => ({ createTask: vi.fn() })),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ currentUser: { email: "test@test.com", displayName: "Test User" } })),
}));

import ActionsRail from "../components/reports/analysis/ActionsRail";

describe("ActionsRail", () => {
  afterEach(() => cleanup());

  const baseActions = [
    { text: "Call Total Wine buyer", priority: 1, relatedAccount: "Total Wine", accountId: "acc123" },
    { text: "Check SGWS inventory", priority: 2, relatedAccount: "SGWS" },
    { text: "Review pricing strategy", priority: 3 },
  ];

  it("renders numbered priority badges", () => {
    render(<ActionsRail actions={baseActions} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 'Create Task' button for all actions", () => {
    render(<ActionsRail actions={baseActions} />);
    const createButtons = screen.getAllByRole("button", { name: /Create Task/ });
    expect(createButtons).toHaveLength(3);
  });

  it("shows 'View Account' button only when accountId exists", () => {
    render(<ActionsRail actions={baseActions} />);
    const viewButtons = screen.getAllByRole("button", { name: /View Account/ });
    // Only the first action has accountId
    expect(viewButtons).toHaveLength(1);
  });

  it("hides 'View Account' when no accountId", () => {
    const noIdActions = [
      { text: "Do something", priority: 1, relatedAccount: "Some Account" },
    ];
    render(<ActionsRail actions={noIdActions} />);
    expect(screen.queryByRole("button", { name: /View Account/ })).not.toBeInTheDocument();
  });

  it("clicking 'Create Task' opens modal", () => {
    render(<ActionsRail actions={[baseActions[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: /Create Task/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders empty state for empty actions", () => {
    render(<ActionsRail actions={[]} />);
    expect(screen.getByText(/Upload more data/)).toBeInTheDocument();
  });

  it("renders empty state for null actions", () => {
    render(<ActionsRail actions={null} />);
    expect(screen.getByText(/Upload more data/)).toBeInTheDocument();
  });
});
