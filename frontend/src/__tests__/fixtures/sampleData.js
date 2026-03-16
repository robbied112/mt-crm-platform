/**
 * Realistic synthetic test fixtures for data pipeline tests.
 * Mimics real QuickBooks, distributor depletion, purchase history,
 * and inventory report formats with fake company names.
 */

// ─── QuickBooks Sales by Customer Detail (grouped format) ────
// Raw 2D array as PapaParse would return with header:false
export const QB_GROUPED_CSV_ROWS = [
  ["", "", "", "", "", ""],
  ["Vineyard Valley Wines", "", "", "", "", ""],
  ["Sales by Customer Detail", "", "", "", "", ""],
  ["October 2025 through February 2026", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["", "Type", "Date", "Num", "Product/Service", "Quantity", "Amount"],
  ["Coastal Wine Bar", "", "", "", "", "", ""],
  ["", "Invoice", "10/15/2025", "1001", "Pinot Noir Reserve", "5", "150.00"],
  ["", "Invoice", "11/20/2025", "1015", "Chardonnay Estate", "3", "75.00"],
  ["", "Invoice", "01/10/2026", "1042", "Pinot Noir Reserve", "8", "240.00"],
  ["Total for Coastal Wine Bar", "", "", "", "", "", "465.00"],
  ["Harbor Restaurant Group", "", "", "", "", "", ""],
  ["", "Invoice", "10/22/2025", "1005", "Sauvignon Blanc", "10", "200.00"],
  ["", "Invoice", "12/05/2025", "1028", "Pinot Noir Reserve", "6", "180.00"],
  ["", "Invoice", "01/15/2026", "1045", "Sauvignon Blanc", "12", "240.00"],
  ["", "Invoice", "02/01/2026", "1060", "Chardonnay Estate", "4", "100.00"],
  ["Total for Harbor Restaurant Group", "", "", "", "", "", "720.00"],
  ["Sunset Liquors", "", "", "", "", "", ""],
  ["", "Invoice", "11/01/2025", "1008", "Pinot Noir Reserve", "2", "60.00"],
  ["Total for Sunset Liquors", "", "", "", "", "", "60.00"],
  ["TOTAL", "", "", "", "", "", "1,245.00"],
];

// ─── Standard Depletion Report (flat CSV) ────────────────────
export const DEPLETION_HEADERS = [
  "Account Name", "Distributor", "State", "Channel",
  "Product", "Nov", "Dec", "Jan", "Feb",
];

export const DEPLETION_ROWS = [
  { "Account Name": "The Wine Cellar", "Distributor": "Breakthru Beverage NY", "State": "NY", "Channel": "Off-Premise", "Product": "Pinot Noir Reserve", "Nov": "12", "Dec": "18", "Jan": "15", "Feb": "20" },
  { "Account Name": "The Wine Cellar", "Distributor": "Breakthru Beverage NY", "State": "NY", "Channel": "Off-Premise", "Product": "Chardonnay Estate", "Nov": "8", "Dec": "10", "Jan": "6", "Feb": "9" },
  { "Account Name": "Bella Italia", "Distributor": "Breakthru Beverage NY", "State": "NY", "Channel": "On-Premise", "Product": "Pinot Noir Reserve", "Nov": "6", "Dec": "8", "Jan": "10", "Feb": "12" },
  { "Account Name": "Cork & Bottle", "Distributor": "Southern Glazer CA", "State": "CA", "Channel": "Off-Premise", "Product": "Sauvignon Blanc", "Nov": "20", "Dec": "25", "Jan": "22", "Feb": "28" },
  { "Account Name": "Cork & Bottle", "Distributor": "Southern Glazer CA", "State": "CA", "Channel": "Off-Premise", "Product": "Pinot Noir Reserve", "Nov": "5", "Dec": "7", "Jan": "6", "Feb": "8" },
  { "Account Name": "Vino Lounge", "Distributor": "Southern Glazer CA", "State": "CA", "Channel": "On-Premise", "Product": "Chardonnay Estate", "Nov": "3", "Dec": "4", "Jan": "5", "Feb": "6" },
  { "Account Name": "Mountain View Wines", "Distributor": "Republic National CO", "State": "CO", "Channel": "Off-Premise", "Product": "Pinot Noir Reserve", "Nov": "2", "Dec": "3", "Jan": "1", "Feb": "2" },
];

// ─── Purchase History Report ─────────────────────────────────
export const PURCHASE_HEADERS = [
  "Customer", "Distributor", "State", "Channel", "SKU", "Qty", "Order Date",
];

export const PURCHASE_ROWS = [
  { "Customer": "The Wine Cellar", "Distributor": "Breakthru NY", "State": "NY", "Channel": "Off-Premise", "SKU": "Pinot Noir", "Qty": "10", "Order Date": "2025-09-15" },
  { "Customer": "The Wine Cellar", "Distributor": "Breakthru NY", "State": "NY", "Channel": "Off-Premise", "SKU": "Pinot Noir", "Qty": "12", "Order Date": "2025-10-20" },
  { "Customer": "The Wine Cellar", "Distributor": "Breakthru NY", "State": "NY", "Channel": "Off-Premise", "SKU": "Pinot Noir", "Qty": "15", "Order Date": "2025-11-25" },
  { "Customer": "Bella Italia", "Distributor": "Breakthru NY", "State": "NY", "Channel": "On-Premise", "SKU": "Chardonnay", "Qty": "5", "Order Date": "2025-10-01" },
  { "Customer": "Bella Italia", "Distributor": "Breakthru NY", "State": "NY", "Channel": "On-Premise", "SKU": "Chardonnay", "Qty": "8", "Order Date": "2025-12-15" },
  { "Customer": "Cork & Bottle", "Distributor": "Southern CA", "State": "CA", "Channel": "Off-Premise", "SKU": "Sauvignon Blanc", "Qty": "20", "Order Date": "2025-11-01" },
];

// ─── Inventory Report ────────────────────────────────────────
export const INVENTORY_HEADERS = [
  "State", "Distributor", "Product", "On Hand", "Days on Hand",
];

export const INVENTORY_ROWS = [
  { "State": "NY", "Distributor": "Breakthru Beverage NY", "Product": "Pinot Noir Reserve", "On Hand": "150", "Days on Hand": "45" },
  { "State": "NY", "Distributor": "Breakthru Beverage NY", "Product": "Chardonnay Estate", "On Hand": "80", "Days on Hand": "30" },
  { "State": "CA", "Distributor": "Southern Glazer CA", "Product": "Sauvignon Blanc", "On Hand": "200", "Days on Hand": "60" },
  { "State": "CA", "Distributor": "Southern Glazer CA", "Product": "Pinot Noir Reserve", "On Hand": "10", "Days on Hand": "7" },
  { "State": "CO", "Distributor": "Republic National CO", "Product": "Pinot Noir Reserve", "On Hand": "5", "Days on Hand": "120" },
];

// ─── Pipeline Data ───────────────────────────────────────────
export const PIPELINE_HEADERS = [
  "Account", "Stage", "Est Value", "Owner", "State", "Date",
];

export const PIPELINE_ROWS = [
  { "Account": "Grand Hotel Wine Program", "Stage": "Proposal", "Est Value": "15000", "Owner": "Jane Smith", "State": "NY", "Date": "2026-01-15" },
  { "Account": "Metro Wine & Spirits", "Stage": "Negotiation", "Est Value": "8000", "Owner": "Jane Smith", "State": "NY", "Date": "2026-02-01" },
  { "Account": "Pacific Coast Imports", "Stage": "Identified", "Est Value": "25000", "Owner": "Bob Jones", "State": "CA", "Date": "2026-02-15" },
];

// ─── Edge Cases ──────────────────────────────────────────────

// CSV with metadata rows before header (common in QuickBooks/VIP)
export const CSV_WITH_METADATA_ROWS = [
  ["Vineyard Valley Wines"],
  ["Generated: 03/15/2026"],
  ["Accrual Basis"],
  [""],
  ["Account", "State", "Qty", "Amount"],
  ["The Wine Cellar", "NY", "10", "250.00"],
  ["Bella Italia", "NY", "5", "125.00"],
];

// Empty/minimal data
export const EMPTY_ROWS = [];

// Unicode in account names
export const UNICODE_ROWS = [
  { "Account Name": "Caf\u00e9 du Vin", "Distributor": "Breakthru NY", "State": "NY", "Channel": "On-Premise", "Product": "Ros\u00e9 Reserve", "Nov": "4", "Dec": "6", "Jan": "5", "Feb": "7" },
  { "Account Name": "Jos\u00e9's Taquer\u00eda", "Distributor": "Southern CA", "State": "CA", "Channel": "On-Premise", "Product": "Sauvignon Blanc", "Nov": "2", "Dec": "3", "Jan": "2", "Feb": "4" },
];
