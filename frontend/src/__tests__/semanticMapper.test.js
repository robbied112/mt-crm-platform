/**
 * Tests for semanticMapper — column auto-detection, upload type detection,
 * and QuickBooks format detection.
 */
import { describe, it, expect } from "vitest";
import {
  autoDetectMapping,
  detectUploadType,
  detectQuickBooksFormat,
} from "../utils/semanticMapper";
import {
  DEPLETION_HEADERS, DEPLETION_ROWS,
  PURCHASE_HEADERS, PURCHASE_ROWS,
  INVENTORY_HEADERS, INVENTORY_ROWS,
  PIPELINE_HEADERS, PIPELINE_ROWS,
  UNICODE_ROWS,
} from "./fixtures/sampleData";

describe("autoDetectMapping", () => {
  it("maps depletion report columns correctly", () => {
    const { mapping, confidence } = autoDetectMapping(DEPLETION_HEADERS, DEPLETION_ROWS);

    expect(mapping.acct).toBe("Account Name");
    expect(mapping.dist).toBe("Distributor");
    expect(mapping.st).toBe("State");
    expect(mapping.ch).toBe("Channel");
    expect(mapping.sku).toBe("Product");
    // Monthly columns should be detected
    expect(mapping._monthColumns).toEqual(["Nov", "Dec", "Jan", "Feb"]);

    // Confidence should be high for exact header matches
    expect(confidence.acct).toBeGreaterThanOrEqual(0.7);
    expect(confidence.dist).toBeGreaterThanOrEqual(0.7);
  });

  it("maps purchase history columns correctly", () => {
    const { mapping } = autoDetectMapping(PURCHASE_HEADERS, PURCHASE_ROWS);

    expect(mapping.acct).toBe("Customer");
    expect(mapping.dist).toBe("Distributor");
    expect(mapping.st).toBe("State");
    expect(mapping.qty).toBe("Qty");
    expect(mapping.date).toBe("Order Date");
  });

  it("maps inventory report columns correctly", () => {
    const { mapping } = autoDetectMapping(INVENTORY_HEADERS, INVENTORY_ROWS);

    expect(mapping.st).toBe("State");
    expect(mapping.dist).toBe("Distributor");
    expect(mapping.sku).toBe("Product");
    expect(mapping.oh).toBe("On Hand");
    expect(mapping.doh).toBe("Days on Hand");
  });

  it("maps pipeline data correctly", () => {
    const { mapping } = autoDetectMapping(PIPELINE_HEADERS, PIPELINE_ROWS);

    expect(mapping.acct).toBe("Account");
    expect(mapping.stage).toBe("Stage");
    expect(mapping.estValue).toBe("Est Value");
    expect(mapping.owner).toBe("Owner");
    expect(mapping.st).toBe("State");
  });

  it("handles unicode characters in data values", () => {
    const headers = ["Account Name", "Distributor", "State", "Channel", "Product", "Nov", "Dec", "Jan", "Feb"];
    const { mapping } = autoDetectMapping(headers, UNICODE_ROWS);

    expect(mapping.acct).toBe("Account Name");
    // Should not crash on unicode
  });

  it("does not map same column to multiple fields", () => {
    const { mapping } = autoDetectMapping(DEPLETION_HEADERS, DEPLETION_ROWS);

    const usedColumns = Object.values(mapping).filter((v) => typeof v === "string");
    const unique = new Set(usedColumns);
    expect(usedColumns.length).toBe(unique.size);
  });

  it("supports distributor role", () => {
    const { mapping } = autoDetectMapping(DEPLETION_HEADERS, DEPLETION_ROWS, "distributor");

    // Should still find mappings — role changes labels not detection
    expect(mapping.acct).toBeTruthy();
    expect(mapping.dist).toBeTruthy();
  });
});

describe("detectQuickBooksFormat", () => {
  it("detects QB Transaction Detail headers", () => {
    const headers = ["Date", "Num", "Name", "Memo", "Account", "Debit", "Credit"];
    const result = detectQuickBooksFormat(headers);
    expect(result.isQuickBooks).toBe(true);
    expect(result.format).toBe("transaction_detail");
  });

  it("detects QB Sales by Item headers", () => {
    const headers = ["Item", "Qty", "Amount", "Balance"];
    const result = detectQuickBooksFormat(headers);
    expect(result.isQuickBooks).toBe(true);
  });

  it("detects QB Customer report headers", () => {
    const headers = ["Customer", "Invoice", "Amount", "Balance"];
    const result = detectQuickBooksFormat(headers);
    expect(result.isQuickBooks).toBe(true);
  });

  it("returns false for non-QB headers", () => {
    const result = detectQuickBooksFormat(DEPLETION_HEADERS);
    expect(result.isQuickBooks).toBe(false);
  });

  it("is case-insensitive", () => {
    const headers = ["DATE", "NUM", "NAME", "MEMO", "ACCOUNT", "DEBIT", "CREDIT"];
    const result = detectQuickBooksFormat(headers);
    expect(result.isQuickBooks).toBe(true);
  });
});

describe("detectUploadType", () => {
  it("detects depletion data from mapped fields", () => {
    const { mapping } = autoDetectMapping(DEPLETION_HEADERS, DEPLETION_ROWS);
    const result = detectUploadType(DEPLETION_HEADERS, DEPLETION_ROWS, mapping);
    expect(result.type).toBe("depletion");
  });

  it("detects purchase data from mapped fields", () => {
    const { mapping } = autoDetectMapping(PURCHASE_HEADERS, PURCHASE_ROWS);
    const result = detectUploadType(PURCHASE_HEADERS, PURCHASE_ROWS, mapping);
    expect(["purchases", "depletion"]).toContain(result.type);
  });

  it("detects inventory data from mapped fields", () => {
    const { mapping } = autoDetectMapping(INVENTORY_HEADERS, INVENTORY_ROWS);
    const result = detectUploadType(INVENTORY_HEADERS, INVENTORY_ROWS, mapping);
    expect(result.type).toBe("inventory");
  });

  it("detects pipeline data from mapped fields", () => {
    const { mapping } = autoDetectMapping(PIPELINE_HEADERS, PIPELINE_ROWS);
    const result = detectUploadType(PIPELINE_HEADERS, PIPELINE_ROWS, mapping);
    expect(result.type).toBe("pipeline");
  });

  it("detects QuickBooks format from headers", () => {
    const qbHeaders = ["Date", "Num", "Name", "Memo", "Account", "Debit", "Credit"];
    const qbRows = [{ Date: "01/15/2026", Num: "1001", Name: "Test", Memo: "", Account: "Sales", Debit: "", Credit: "100" }];
    const result = detectUploadType(qbHeaders, qbRows, {});
    expect(result.type).toBe("quickbooks");
  });
});
