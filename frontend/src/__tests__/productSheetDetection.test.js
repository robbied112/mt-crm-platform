/**
 * Tests for product_sheet detection in semanticMapper — verifying that
 * detectUploadType correctly identifies product catalog sheets vs
 * transaction data.
 */
import { describe, it, expect } from "vitest";
import {
  autoDetectMapping,
  detectUploadType,
} from "../../../packages/pipeline/src/semanticMapper";

// ---------------------------------------------------------------------------
// Helpers — build minimal row fixtures from header arrays
// ---------------------------------------------------------------------------

function makeRows(headers, count = 3) {
  return Array.from({ length: count }, () =>
    Object.fromEntries(headers.map((h) => [h, "sample"]))
  );
}

// ---------------------------------------------------------------------------
// detectUploadType — product_sheet detection
// ---------------------------------------------------------------------------

describe("detectUploadType — product_sheet detection", () => {
  it("detects product sheet with product-descriptive headers", () => {
    const headers = [
      "Product Name",
      "Producer",
      "Vintage",
      "Varietal",
      "Region",
      "Appellation",
    ];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    expect(result.type).toBe("product_sheet");
  });

  it("does NOT detect product_sheet for transaction data", () => {
    const headers = ["Account", "Date", "Qty", "Revenue"];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    expect(result.type).not.toBe("product_sheet");
  });

  it("detects product sheet with mostly product columns and no qty/date", () => {
    const headers = ["Name", "Producer", "Varietal", "Vintage", "Price"];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    expect(result.type).toBe("product_sheet");
  });

  it("does NOT detect product_sheet when transaction columns dominate", () => {
    // Has some product headers but also qty + date → should be a transaction type
    const headers = [
      "Product",
      "Varietal",
      "Account",
      "Qty",
      "Date",
      "Revenue",
    ];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    expect(result.type).not.toBe("product_sheet");
  });

  it("returns 'unknown' for empty headers", () => {
    const result = detectUploadType([], [], {});
    expect(result.type).toBe("unknown");
  });

  it("detects product sheet with SKU, category, and bottle size", () => {
    const headers = ["SKU", "Category", "Bottle Size", "Producer", "Country"];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    expect(result.type).toBe("product_sheet");
  });

  it("does NOT detect product_sheet for inventory data", () => {
    const headers = ["Product", "On Hand", "Producer", "Varietal"];
    const rows = makeRows(headers);
    const { mapping } = autoDetectMapping(headers, rows);
    const result = detectUploadType(headers, rows, mapping);
    // inventory check runs before product_sheet
    expect(result.type).toBe("inventory");
  });
});
