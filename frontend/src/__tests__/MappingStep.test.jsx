/**
 * @vitest-environment jsdom
 */
/**
 * Component tests for MappingStep — the column mapping table shown during
 * file import. Pure presentational component (no context dependencies).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import MappingStep from "../components/DataImport/MappingStep";

// ─── Helpers ────────────────────────────────────────────────────

function renderMappingStep(overrides = {}) {
  cleanup();
  const props = {
    fileName: "report.xlsx",
    headers: ["Account Name", "State", "Cases", "Revenue"],
    rows: [
      { "Account Name": "Wine Cellar", State: "NY", Cases: "10", Revenue: "250" },
      { "Account Name": "Bella Italia", State: "CA", Cases: "5", Revenue: "125" },
      { "Account Name": "Cork & Bottle", State: "TX", Cases: "8", Revenue: "200" },
    ],
    mapping: {
      acct: "Account Name",
      state: "State",
      qty: "Cases",
      revenue: "Revenue",
    },
    confidence: {
      acct: 0.95,
      state: 0.90,
      qty: 0.75,
      revenue: 0.85,
    },
    uploadType: { type: "depletion" },
    onUpdateMapping: vi.fn(),
    onProceed: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  const result = render(<MappingStep {...props} />);
  return { ...result, props };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("MappingStep", () => {
  // ─── Basic Rendering ────────────────────────────────────────

  it("renders file name and row count", () => {
    renderMappingStep();
    expect(screen.getByText(/report\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();
  });

  it("renders column mapping heading", () => {
    renderMappingStep();
    const headings = screen.getAllByText("Column Mapping");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the mapping table with column headers", () => {
    renderMappingStep();
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th");
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).toContain("Internal Field");
    expect(headerTexts).toContain("Mapped To");
    expect(headerTexts).toContain("Confidence");
    expect(headerTexts).toContain("Sample Values");
  });

  // ─── Upload Type Badges ─────────────────────────────────────

  it("shows QuickBooks badge when uploadType is quickbooks", () => {
    renderMappingStep({ uploadType: { type: "quickbooks" } });
    expect(screen.getByText("QuickBooks Detected")).toBeInTheDocument();
    expect(screen.getByText(/QuickBooks format detected/)).toBeInTheDocument();
  });

  it("shows type badge for non-QB types", () => {
    renderMappingStep({ uploadType: { type: "depletion" } });
    expect(screen.getByText("depletion")).toBeInTheDocument();
  });

  it("shows no badge when uploadType.type is falsy", () => {
    renderMappingStep({ uploadType: {} });
    expect(screen.queryByText("QuickBooks Detected")).not.toBeInTheDocument();
  });

  // ─── Column Mapping Dropdowns ───────────────────────────────

  it("renders dropdown for each field definition with correct current value", () => {
    renderMappingStep();
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);

    // Find the select that currently has "Account Name" selected
    const acctSelect = selects.find((s) => s.value === "Account Name");
    expect(acctSelect).toBeDefined();
  });

  it("renders '-- Not mapped --' as the default option in each dropdown", () => {
    renderMappingStep();
    const notMappedOptions = screen.getAllByText("-- Not mapped --");
    expect(notMappedOptions.length).toBeGreaterThan(0);
  });

  it("calls onUpdateMapping when dropdown value changes", async () => {
    const user = userEvent.setup();
    const { props } = renderMappingStep();

    const selects = screen.getAllByRole("combobox");
    const acctSelect = selects.find((s) => s.value === "Account Name");

    await user.selectOptions(acctSelect, "State");
    expect(props.onUpdateMapping).toHaveBeenCalled();
  });

  // ─── Confidence Badges ──────────────────────────────────────

  it("shows confidence percentages for mapped fields", () => {
    renderMappingStep();
    // acct has 0.95 confidence → 95%
    expect(screen.getByText("95%")).toBeInTheDocument();
    // qty has 0.75 confidence → 75%
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  // ─── Sample Values ──────────────────────────────────────────

  it("displays sample values for mapped columns", () => {
    renderMappingStep();
    expect(screen.getByText(/Wine Cellar/)).toBeInTheDocument();
  });

  // ─── Navigation Buttons ─────────────────────────────────────

  it("calls onProceed when 'Preview & Import' is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderMappingStep();

    const btn = screen.getByRole("button", { name: /Preview/ });
    await user.click(btn);
    expect(props.onProceed).toHaveBeenCalledOnce();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderMappingStep();

    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(props.onBack).toHaveBeenCalledOnce();
  });
});
