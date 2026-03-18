/**
 * @vitest-environment jsdom
 */
/**
 * Component tests for ProductSheetReviewStep — the product review table
 * shown during product sheet imports. Tests cover:
 *   - Rendering from rows + mapping (buildProducts path)
 *   - Rendering from preBuiltProducts (multi-sheet merge path)
 *   - Duplicate detection against existing catalog
 *   - Selection: toggle individual, toggle all, duplicates unchecked by default
 *   - Inline editing of product fields
 *   - Confirm flow: calls onConfirm with enriched products
 *   - Cancel flow: calls onCancel
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock useCrm — must be before component import
vi.mock("../context/CrmContext", () => ({
  useCrm: vi.fn(() => ({ products: [] })),
}));

import ProductSheetReviewStep from "../components/ProductSheetReviewStep";
import { useCrm } from "../context/CrmContext";

// ─── Helpers ────────────────────────────────────────────────────

function defaultMapping() {
  return {
    acct: "Account",
    sku: "SKU",
    producer: "Producer",
    category: "Category",
    region: "Region",
    unitPrice: "Price",
    size: "Cases",
  };
}

function sampleRows() {
  return [
    { Account: "White Wine", SKU: "MT-WHT-750", Producer: "Valley Wines", Category: "Chardonnay", Region: "Napa", Price: "10", Cases: "12" },
    { Account: "Red Wine", SKU: "MT-RED-750", Producer: "Valley Wines", Category: "Cabernet Sauvignon", Region: "Sonoma", Price: "15", Cases: "12" },
    { Account: "Rosé", SKU: "MT-ROS-750", Producer: "Coast Vineyards", Category: "Blend", Region: "Provence", Price: "12", Cases: "6" },
  ];
}

function samplePreBuiltProducts() {
  return [
    { name: "White Wine", sku: "MT-WHT-750", producer: "Valley Wines", vintage: "2022", varietal: "Chardonnay", region: "Napa", fobPrice: 10, caseSize: 12, bottleSize: "750ml" },
    { name: "Red Wine", sku: "MT-RED-750", producer: "Valley Wines", vintage: null, varietal: "Cabernet Sauvignon", region: "Sonoma", fobPrice: 15, caseSize: 12, bottleSize: "750ml" },
    { name: "Rosé", sku: "MT-ROS-750", producer: "Coast Vineyards", vintage: null, varietal: "Blend", region: "Provence", fobPrice: 12, caseSize: 6, bottleSize: "750ml" },
  ];
}

function renderComponent(overrides = {}) {
  cleanup();
  const props = {
    rows: sampleRows(),
    headers: ["Account", "SKU", "Producer", "Category", "Region", "Price", "Cases"],
    mapping: defaultMapping(),
    preBuiltProducts: undefined,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const result = render(<ProductSheetReviewStep {...props} />);
  return { ...result, props };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("ProductSheetReviewStep", () => {
  beforeEach(() => {
    useCrm.mockReturnValue({ products: [] });
  });

  // ─── Rendering ──────────────────────────────────────────────

  it("renders product count from rows + mapping", () => {
    renderComponent();
    const matches = screen.getAllByText(/3 products extracted/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders preBuiltProducts when provided (skips buildProducts)", () => {
    renderComponent({ preBuiltProducts: samplePreBuiltProducts(), rows: [], mapping: {} });
    const matches = screen.getAllByText(/3 products extracted/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Verify actual product data rendered
    const nameInputs = screen.getAllByDisplayValue("White Wine");
    expect(nameInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the review table with correct columns", () => {
    renderComponent();
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th");
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).toContain("Name");
    expect(headerTexts).toContain("Producer");
    expect(headerTexts).toContain("Vintage");
    expect(headerTexts).toContain("Varietal");
    expect(headerTexts).toContain("SKU");
    expect(headerTexts).toContain("FOB Price");
    expect(headerTexts).toContain("Status");
  });

  it("renders product names as editable inputs", () => {
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });
    expect(screen.getAllByDisplayValue("White Wine").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue("Red Wine").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue("Rosé").length).toBeGreaterThanOrEqual(1);
  });

  it("renders SKUs as editable inputs", () => {
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });
    expect(screen.getAllByDisplayValue("MT-WHT-750").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue("MT-RED-750").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue("MT-ROS-750").length).toBeGreaterThanOrEqual(1);
  });

  // ─── Duplicate Detection ────────────────────────────────────

  it("shows duplicate badge when products match existing catalog", () => {
    useCrm.mockReturnValue({
      products: [
        { id: "existing-1", name: "White Wine", normalizedName: "white wine" },
      ],
    });
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });
    // Should show "Duplicate" badge in the table
    const badges = screen.getAllByText("Duplicate");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("unchecks duplicates by default", () => {
    useCrm.mockReturnValue({
      products: [
        { id: "existing-1", name: "White Wine", normalizedName: "white wine" },
      ],
    });
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is the header "select all" checkbox
    // Remaining are per-product: White Wine (dup → unchecked), Red Wine (checked), Rosé (checked)
    const productCheckboxes = checkboxes.slice(1);
    expect(productCheckboxes).toHaveLength(3);

    // White Wine (duplicate) should be unchecked
    expect(productCheckboxes[0]).not.toBeChecked();
    // Red Wine and Rosé should be checked
    expect(productCheckboxes[1]).toBeChecked();
    expect(productCheckboxes[2]).toBeChecked();
  });

  it("shows correct selected count excluding duplicates", () => {
    useCrm.mockReturnValue({
      products: [
        { id: "existing-1", name: "White Wine", normalizedName: "white wine" },
      ],
    });
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    // 2 selected (Red Wine + Rosé), White Wine unchecked as duplicate
    const matches = screen.getAllByText(/2 products? selected/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Selection ──────────────────────────────────────────────

  it("toggles individual product selection", async () => {
    const user = userEvent.setup();
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    const checkboxes = screen.getAllByRole("checkbox");
    const firstProduct = checkboxes[1]; // skip header checkbox

    expect(firstProduct).toBeChecked();
    await user.click(firstProduct);
    expect(firstProduct).not.toBeChecked();
    await user.click(firstProduct);
    expect(firstProduct).toBeChecked();
  });

  it("toggle-all selects/deselects all products", async () => {
    const user = userEvent.setup();
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    const checkboxes = screen.getAllByRole("checkbox");
    const selectAll = checkboxes[0];
    const productCheckboxes = checkboxes.slice(1);

    // All should start checked (no duplicates)
    productCheckboxes.forEach((cb) => expect(cb).toBeChecked());

    // Click select-all to deselect all
    await user.click(selectAll);
    productCheckboxes.forEach((cb) => expect(cb).not.toBeChecked());

    // Click again to select all
    await user.click(selectAll);
    productCheckboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  // ─── Inline Editing ─────────────────────────────────────────

  it("allows inline editing of product name", async () => {
    const user = userEvent.setup();
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    const nameInputs = screen.getAllByDisplayValue("White Wine");
    const nameInput = nameInputs[0];
    await user.clear(nameInput);
    await user.type(nameInput, "Albariño Reserve");
    expect(nameInput).toHaveValue("Albariño Reserve");
  });

  it("allows inline editing of FOB price", async () => {
    const user = userEvent.setup();
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    const priceInputs = screen.getAllByDisplayValue("10");
    const priceInput = priceInputs[0];
    await user.clear(priceInput);
    await user.type(priceInput, "14.99");
    expect(priceInput).toHaveValue("14.99");
  });

  // ─── Confirm ────────────────────────────────────────────────

  it("calls onConfirm with selected, enriched products", async () => {
    const user = userEvent.setup();
    const { props } = renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    // Click one of the import buttons
    const importButtons = screen.getAllByRole("button", { name: /Import 3/ });
    await user.click(importButtons[0]);

    expect(props.onConfirm).toHaveBeenCalledOnce();
    const confirmed = props.onConfirm.mock.calls[0][0];
    expect(confirmed).toHaveLength(3);

    // Each product should be enriched with normalizedName
    confirmed.forEach((p) => {
      expect(p).toHaveProperty("normalizedName");
      expect(typeof p.normalizedName).toBe("string");
    });

    // fobPrice should be a number or null
    expect(confirmed[0].fobPrice).toBe(10);
    // caseSize should be a number
    expect(confirmed[0].caseSize).toBe(12);
  });

  it("excludes unchecked products from confirm", async () => {
    const user = userEvent.setup();
    useCrm.mockReturnValue({
      products: [
        { id: "existing-1", name: "White Wine", normalizedName: "white wine" },
      ],
    });
    const { props } = renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    // White Wine is unchecked (duplicate) → only 2 should be confirmed
    const importButtons = screen.getAllByRole("button", { name: /Import 2/ });
    await user.click(importButtons[0]);

    expect(props.onConfirm).toHaveBeenCalledOnce();
    const confirmed = props.onConfirm.mock.calls[0][0];
    expect(confirmed).toHaveLength(2);
    expect(confirmed.map((p) => p.name)).toEqual(["Red Wine", "Rosé"]);
  });

  it("disables import button when no products selected", async () => {
    const user = userEvent.setup();
    renderComponent({ preBuiltProducts: samplePreBuiltProducts() });

    // Deselect all via toggle-all
    const selectAll = screen.getAllByRole("checkbox")[0];
    await user.click(selectAll);

    // Both import/confirm buttons should be disabled
    const buttons = screen.getAllByRole("button");
    const importButtons = buttons.filter(
      (b) => b.textContent.includes("Import") && b.textContent !== "Back"
    );
    importButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  // ─── Cancel ─────────────────────────────────────────────────

  it("calls onCancel when Back is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    const backButtons = screen.getAllByRole("button", { name: /Back/ });
    await user.click(backButtons[0]);
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  // ─── Edge Cases ─────────────────────────────────────────────

  it("handles empty preBuiltProducts array", () => {
    renderComponent({ preBuiltProducts: [] });
    const matches = screen.getAllByText(/0 products extracted/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("filters out rows with no name via buildProducts", () => {
    const rows = [
      { Account: "", SKU: "", Producer: "Valley", Category: "", Region: "", Price: "10", Cases: "12" },
      { Account: "Wine A", SKU: "SKU-A", Producer: "Valley", Category: "", Region: "", Price: "10", Cases: "12" },
    ];
    renderComponent({ rows, preBuiltProducts: undefined });
    // First row has no name (empty Account and SKU) — should be filtered out
    const matches = screen.getAllByText(/1 products? extracted/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("detects varietal from category field", () => {
    const rows = [
      { Account: "Wine A", SKU: "SKU-A", Producer: "Valley", Category: "Pinot Noir", Region: "", Price: "10", Cases: "12" },
    ];
    renderComponent({ rows, preBuiltProducts: undefined });
    // "Pinot Noir" should be detected as a varietal (contains "pinot")
    expect(screen.getByDisplayValue("Pinot Noir")).toBeInTheDocument();
  });
});
