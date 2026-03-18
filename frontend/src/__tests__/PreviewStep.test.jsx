/**
 * @vitest-environment jsdom
 */
/**
 * Component tests for PreviewStep — the final review before import.
 * Pure presentational component (no context dependencies).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import PreviewStep from "../components/DataImport/PreviewStep";

// ─── Helpers ────────────────────────────────────────────────────

function renderPreviewStep(overrides = {}) {
  cleanup();
  const props = {
    summary: "Wine Cellar and Bella Italia showed strong Q4 depletion growth in the NY market.",
    preview: {
      depletionByAccount: [
        { account: "Wine Cellar", state: "NY", totalCases: 65 },
        { account: "Bella Italia", state: "NY", totalCases: 36 },
        { account: "Cork & Bottle", state: "CA", totalCases: 95 },
      ],
      depletionByState: {
        NY: { totalCases: 101 },
        CA: { totalCases: 95 },
      },
    },
    uploadType: { type: "depletion" },
    saving: false,
    onConfirm: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  const result = render(<PreviewStep {...props} />);
  return { ...result, props };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("PreviewStep", () => {
  // ─── Basic Rendering ────────────────────────────────────────

  it("renders the heading", () => {
    renderPreviewStep();
    expect(screen.getByText("Preview Import")).toBeInTheDocument();
  });

  it("renders the executive summary", () => {
    renderPreviewStep();
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText(/Wine Cellar and Bella Italia showed strong Q4/)).toBeInTheDocument();
  });

  // ─── Dataset Cards ──────────────────────────────────────────

  it("shows dataset count cards for non-empty datasets", () => {
    renderPreviewStep();
    // depletionByAccount has 3 rows
    expect(screen.getByText("3")).toBeInTheDocument();
    // depletionByState has 2 keys
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows dataset names in readable format", () => {
    renderPreviewStep();
    // "depletionByAccount" → "depletion By Account"
    expect(screen.getByText(/depletion By Account/)).toBeInTheDocument();
  });

  it("does not show empty datasets", () => {
    renderPreviewStep({
      preview: {
        depletionByAccount: [{ account: "Test", totalCases: 10 }],
        emptyArray: [],
        emptyObj: {},
      },
    });
    // Only depletionByAccount card should render (count = 1)
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  // ─── Sample Table ───────────────────────────────────────────

  it("renders sample rows from the first dataset", () => {
    renderPreviewStep();
    expect(screen.getByText(/Sample: depletionByAccount/)).toBeInTheDocument();
    // Should show column headers
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("state")).toBeInTheDocument();
    // Should show data values
    expect(screen.getByText("Wine Cellar")).toBeInTheDocument();
    expect(screen.getByText("Bella Italia")).toBeInTheDocument();
  });

  // ─── Buttons ────────────────────────────────────────────────

  it("calls onConfirm when 'Confirm & Import' is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderPreviewStep();

    await user.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderPreviewStep();

    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  // ─── Saving State ──────────────────────────────────────────

  it("shows 'Saving...' and disables buttons when saving", () => {
    renderPreviewStep({ saving: true });
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Saving/ });
    expect(confirmBtn).toBeDisabled();

    const backBtn = screen.getByRole("button", { name: /Back/ });
    expect(backBtn).toBeDisabled();
  });

  it("does not call onConfirm when saving", async () => {
    const user = userEvent.setup();
    const { props } = renderPreviewStep({ saving: true });

    const savingBtn = screen.getByRole("button", { name: /Saving/ });
    await user.click(savingBtn);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  // ─── Edge Cases ─────────────────────────────────────────────

  it("handles preview with only object datasets (no array)", () => {
    renderPreviewStep({
      preview: {
        depletionByState: { NY: { totalCases: 101 }, CA: { totalCases: 95 } },
      },
    });
    // Should show count 2 for the object dataset
    expect(screen.getByText("2")).toBeInTheDocument();
    // No sample table (first dataset is not an array)
    expect(screen.queryByText(/Sample:/)).not.toBeInTheDocument();
  });

  it("handles empty preview gracefully", () => {
    renderPreviewStep({ preview: {} });
    expect(screen.getByText("Preview Import")).toBeInTheDocument();
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
  });
});
