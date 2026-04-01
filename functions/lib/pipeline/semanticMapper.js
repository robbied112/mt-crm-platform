/**
 * Semantic Column Mapper — "Data Detective"
 *
 * Analyzes column headers AND sample values to intelligently
 * guess the mapping between uploaded data and internal fields.
 */

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const CHANNEL_VALUES = new Set([
  "on-premise", "off-premise", "on premise", "off premise",
  "on", "off", "retail", "bar", "restaurant", "grocery", "liquor store",
]);

const PIPELINE_STAGES = new Set([
  "lead", "contacted", "proposal", "negotiation", "won", "lost",
  "identified", "outreach sent", "meeting set", "rfp", "closed won", "closed lost",
]);

/**
 * Internal field definitions with header aliases and value testers.
 * Priority order matters — first match wins for ambiguous columns.
 * Use getFieldDefs(userRole) for role-aware labels and aliases.
 */

const ACCT_ALIASES_COMMON = ["account", "account name", "customer", "outlet", "retailer", "location", "store", "buyer", "customer name", "name", "customer:job", "ship to name", "bill to name", "sold to", "customer full name", "customer company", "acct name", "account number", "acct", "retail accounts", "retail account"];
const DIST_ALIASES_COMMON = ["distributor", "wholesaler", "dist", "dist name", "supplier", "vendor", "distributor name", "wholesale", "supplier name", "wholesaler name"];

/**
 * Role-specific field overrides.
 *
 *  ROLE      ACCOUNT=     DIST=         PRIMARY VIEWS
 *  winery    Retailer     Distributor   Depletions, Pipeline
 *  importer  Distributor  (self)        Orders, Inventory
 *  distrib   Retailer     Supplier      Sell-through, Inventory
 *  retailer  (self)       Supplier      Purchases, Inventory
 *
 * Legacy "supplier" maps to "winery" for backward compatibility.
 */
const ROLE_FIELD_OVERRIDES = {
  supplier: {
    acct: { label: "Account Name", extraAliases: [] },
    dist: { label: "Distributor", extraAliases: [] },
  },
  winery: {
    acct: { label: "Retailer / Account", extraAliases: ["retailer", "on-premise", "off-premise"] },
    dist: { label: "Distributor", extraAliases: [] },
  },
  importer: {
    acct: { label: "Distributor / Account", extraAliases: ["wholesale buyer", "partner"] },
    dist: { label: "Distributor", extraAliases: [] },
  },
  distributor: {
    acct: { label: "Store / Location", extraAliases: ["warehouse", "branch", "site", "depot"] },
    dist: { label: "Supplier / Vendor", extraAliases: ["brand", "brand house", "manufacturer", "producer", "winery", "brewery", "distillery"] },
  },
  retailer: {
    acct: { label: "Store / Location", extraAliases: ["shelf", "department"] },
    dist: { label: "Supplier / Vendor", extraAliases: ["brand", "brand house", "manufacturer", "producer", "winery", "brewery", "distillery", "importer"] },
  },
};

/**
 * Get field definitions for a specific user role.
 * @param {"supplier"|"distributor"} userRole
 * @returns {Array}
 */
function getFieldDefs(userRole) {
  if (userRole === undefined) userRole = "supplier";
  const overrides = ROLE_FIELD_OVERRIDES[userRole] || ROLE_FIELD_OVERRIDES.supplier;
  return buildFieldDefs(overrides);
}

function buildFieldDefs(overrides) {
  return [
  {
    field: "acct",
    label: overrides.acct.label,
    headerAliases: [...ACCT_ALIASES_COMMON, ...overrides.acct.extraAliases],
    testValues: (vals) => {
      const businessWords = /\b(bar|grill|tavern|restaurant|store|liquor|market|pub|cafe|lounge|bistro|inn|hotel|club|wine|beer|pizza|bbq|brew|tap|bottle)\b/i;
      const matchCount = vals.filter((v) => typeof v === "string" && businessWords.test(v)).length;
      return matchCount >= 2 ? 0.9 : 0;
    },
  },
  {
    field: "dist",
    label: overrides.dist.label,
    headerAliases: [...DIST_ALIASES_COMMON, ...overrides.dist.extraAliases],
    testValues: (vals) => {
      const distWords = /\b(distribut|wholesale|beverage|wine.*spirit|republic|breakthru|southern|rndc|johnson|young|martignetti|empire|charmer)\b/i;
      const matchCount = vals.filter((v) => typeof v === "string" && distWords.test(v)).length;
      return matchCount >= 1 ? 0.85 : 0;
    },
  },
  {
    field: "st",
    label: "State",
    headerAliases: ["state", "st", "market", "region", "state code"],
    testValues: (vals) => {
      const stateMatches = vals.filter((v) => {
        const clean = String(v).trim().toUpperCase();
        return US_STATES.has(clean) || clean.length > 3; // Full state names
      });
      return stateMatches.length >= 3 ? 0.95 : 0;
    },
  },
  {
    field: "ch",
    label: "Channel",
    headerAliases: ["channel", "trade channel", "premise", "segment", "class of trade", "class", "customer type", "type", "onoff premises", "on/off premise", "on off premise", "premise type"],
    testValues: (vals) => {
      const matches = vals.filter((v) => CHANNEL_VALUES.has(String(v).toLowerCase().trim()));
      return matches.length >= 2 ? 0.9 : 0;
    },
  },
  {
    field: "sku",
    label: "Product / SKU",
    headerAliases: ["product", "sku", "item", "item name", "item names", "brand", "product name", "description", "item description", "upc", "product/service full name", "product/service", "memo/description", "prod cd", "product code", "prod desc", "product description", "item code", "item number", "item nbr", "item #", "corp item cd", "corp item"],
    testValues: () => 0,
  },
  {
    field: "qty",
    label: "Quantity / Volume",
    headerAliases: ["qty", "quantity", "cases", "volume", "ce", "units", "amount sold", "total cases", "case equiv", "case equivs", "case equivalents", "unit cases", "9le", "9l equiv", "9l cases", "units sold", "physical cases", "shipped qty", "ordered qty", "depletion qty", "depl cases", "depl cs", "cases depleted", "cases sold", "cases shipped", "net units"],
    testValues: (vals) => {
      const nums = vals.filter((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0);
      return nums.length >= 4 ? 0.5 : 0;
    },
  },
  {
    field: "date",
    label: "Date / Period",
    headerAliases: ["date", "period", "week", "month", "invoice date", "order date", "ship date", "transaction date", "txn date", "create date", "due date", "posting date", "transaction date"],
    testValues: (vals) => {
      const datePattern = /^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$|^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
      const matches = vals.filter((v) => datePattern.test(String(v).trim()));
      return matches.length >= 3 ? 0.9 : 0;
    },
  },
  {
    field: "revenue",
    label: "Revenue / Total Amount",
    headerAliases: ["revenue", "amount", "total", "sales", "ext price", "extended price", "dollars", "net amount", "line total", "total amount", "total sales", "total revenue", "net sales", "gross amount", "ext amount", "extended amount", "sales amount"],
    testValues: (vals) => {
      const dollarPattern = /^\$?[\d,]+\.?\d*$/;
      const nums = vals.filter((v) => dollarPattern.test(String(v).trim().replace(/[()]/g, "")));
      if (nums.length < 3) return 0;
      // Prefer columns with larger values (totals, not unit prices)
      const avg = nums.reduce((s, v) => s + parseFloat(String(v).replace(/[$,()]/g, "")), 0) / nums.length;
      return avg > 50 ? 0.75 : 0.55;
    },
  },
  {
    field: "unitPrice",
    label: "Unit Price",
    headerAliases: ["price", "unit price", "bottle price", "avg price", "sales price", "cost", "unit cost", "rate", "each", "price each", "case price", "msrp", "wholesale price", "retail price", "list price"],
    testValues: (vals) => {
      const dollarPattern = /^\$?[\d,]+\.?\d*$/;
      const nums = vals.filter((v) => dollarPattern.test(String(v).trim().replace(/[()]/g, "")));
      if (nums.length < 3) return 0;
      // Prefer columns with smaller values (unit prices)
      const avg = nums.reduce((s, v) => s + parseFloat(String(v).replace(/[$,()]/g, "")), 0) / nums.length;
      return avg <= 50 ? 0.7 : 0.45;
    },
  },
  {
    field: "stage",
    label: "Pipeline Stage",
    headerAliases: ["stage", "status", "pipeline stage", "deal stage", "opportunity stage"],
    testValues: (vals) => {
      const matches = vals.filter((v) => PIPELINE_STAGES.has(String(v).toLowerCase().trim()));
      return matches.length >= 2 ? 0.9 : 0;
    },
  },
  {
    field: "owner",
    label: "Owner / Rep",
    headerAliases: ["owner", "rep", "sales rep", "assigned to", "salesperson", "representative", "rep name"],
    testValues: () => 0,
  },
  {
    field: "estValue",
    label: "Deal Value",
    headerAliases: ["deal value", "est value", "estimated value", "opportunity value", "value", "deal size"],
    testValues: () => 0,
  },
  {
    field: "oh",
    label: "On Hand (Inventory)",
    headerAliases: ["on hand", "oh", "inventory", "qty on hand", "stock", "in stock", "available"],
    testValues: () => 0,
  },
  {
    field: "doh",
    label: "Days on Hand",
    headerAliases: ["days on hand", "doh", "dos", "days of supply", "days supply"],
    testValues: () => 0,
  },
  {
    field: "lastOrder",
    label: "Last Order Date",
    headerAliases: ["last order", "last order date", "last purchase", "last sold", "last invoice"],
    testValues: () => 0,
  },
  {
    field: "orderCycle",
    label: "Order Cycle (days)",
    headerAliases: ["cycle", "order cycle", "avg cycle", "reorder cycle", "frequency"],
    testValues: () => 0,
  },
  {
    field: "invoiceNo",
    label: "Invoice / Order Number",
    headerAliases: ["invoice", "invoice number", "invoice no", "inv", "order number", "order no", "po", "po number", "num", "ref", "reference", "transaction number", "txn no", "document number", "doc no", "confirmation"],
    testValues: () => 0,
  },
  {
    field: "category",
    label: "Category / Varietal",
    headerAliases: ["category", "varietal", "grape", "type", "wine type", "spirit type", "class", "subclass", "sub-category", "product type", "product category", "vintage", "appellation", "region of origin", "country"],
    testValues: () => 0,
  },
  {
    field: "size",
    label: "Pack / Bottle Size",
    headerAliases: ["size", "pack size", "bottle size", "pack", "bottles per case", "btl size", "format", "container size", "ml", "uom", "unit of measure", "pack type"],
    testValues: () => 0,
  },
  {
    field: "city",
    label: "City",
    headerAliases: ["city", "ship to city", "bill to city", "town", "municipality"],
    testValues: () => 0,
  },
  {
    field: "zip",
    label: "Zip / Postal Code",
    headerAliases: ["zip", "zip code", "postal code", "postal", "ship to zip", "bill to zip"],
    testValues: (vals) => {
      const zipPattern = /^\d{5}(-\d{4})?$/;
      const matches = vals.filter((v) => zipPattern.test(String(v).trim()));
      return matches.length >= 3 ? 0.95 : 0;
    },
  },
  {
    field: "contact",
    label: "Contact Name",
    headerAliases: ["contact", "contact name", "buyer name", "buyer", "attention", "attn"],
    testValues: () => 0,
  },
  {
    field: "discount",
    label: "Discount",
    headerAliases: ["discount", "discount %", "disc", "discount amount", "promo", "promotion", "allowance", "rebate"],
    testValues: () => 0,
  },
  {
    field: "debit",
    label: "Debit",
    headerAliases: ["debit", "debit amount", "dr"],
    testValues: () => 0,
  },
  {
    field: "credit",
    label: "Credit",
    headerAliases: ["credit", "credit amount", "cr", "payment"],
    testValues: () => 0,
  },
  {
    field: "balance",
    label: "Balance",
    headerAliases: ["balance", "open balance", "balance due", "outstanding", "amount due", "remaining"],
    testValues: () => 0,
  },
  {
    field: "notes",
    label: "Notes / Memo",
    headerAliases: ["notes", "memo", "comments", "description", "remark", "memo/description", "note"],
    testValues: () => 0,
  },
];
}

// Default FIELD_DEFS for backward compatibility (supplier role)
const FIELD_DEFS = getFieldDefs("supplier");

/**
 * Score how well a header matches a field definition.
 * Returns 0-1 confidence.
 */
function scoreHeaderMatch(header, aliases) {
  const h = header.toLowerCase().trim();
  if (aliases.includes(h)) return 1.0;
  for (const alias of aliases) {
    if (h.includes(alias) || alias.includes(h)) return 0.7;
  }
  return 0;
}

/**
 * Sample the first N rows of data and auto-detect column mappings.
 *
 * @param {string[]} headers - Column headers from the file
 * @param {object[]} rows - Parsed rows (first 5 used for sampling)
 * @param {string} [userRole="supplier"] - User role for field definitions
 * @returns {{ mapping: object, confidence: object, unmapped: string[] }}
 */
function autoDetectMapping(headers, rows, userRole) {
  if (userRole === undefined) userRole = "supplier";
  const fieldDefs = getFieldDefs(userRole);
  const sampleRows = rows.slice(0, 5);
  const mapping = {};
  const confidence = {};
  const usedColumns = new Set();

  // Score every (field, column) pair
  const scores = [];
  for (const def of fieldDefs) {
    for (const col of headers) {
      const headerScore = scoreHeaderMatch(col, def.headerAliases);
      const sampleValues = sampleRows.map((r) => r[col]).filter((v) => v !== "" && v != null);
      const valueScore = def.testValues(sampleValues);
      const combined = Math.max(headerScore, valueScore);
      if (combined > 0) {
        scores.push({ field: def.field, column: col, score: combined });
      }
    }
  }

  // Sort by score descending, then assign greedily
  scores.sort((a, b) => b.score - a.score);
  for (const { field, column, score } of scores) {
    if (mapping[field] || usedColumns.has(column)) continue;
    mapping[field] = column;
    confidence[field] = score;
    usedColumns.add(column);
  }

  // Detect monthly columns by name pattern
  const monthPattern = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\-_]?\d{0,4}$/i;
  // Pivot period-labeled columns: only single-month periods like "Case Equivs [1M Dec 2025]"
  // Exclude multi-month totals (4M, 12M) and non-quantity metrics (Net Price, Placements, etc.)
  const singleMonthPeriodPattern = /\[1M\s+[A-Za-z]/;
  const qtyDef = fieldDefs.find((d) => d.field === "qty");
  const qtyAliases = qtyDef ? qtyDef.headerAliases : [];
  const monthColumns = headers.filter((h) => {
    if (monthPattern.test(h.trim())) return true;
    if (!singleMonthPeriodPattern.test(h)) return false;
    // Only include if the base column name (before [1M...]) matches a qty alias
    const baseName = h.replace(/\s*\[.*$/, "").trim().toLowerCase();
    return qtyAliases.includes(baseName);
  });
  // Also include the qty-mapped column if it's a period-0 duplicate of the monthly series
  if (monthColumns.length > 0 && mapping.qty && !monthColumns.includes(mapping.qty)) {
    const qtyBase = mapping.qty.replace(/\s*\[.*$/, "").trim().toLowerCase();
    const monthBase = monthColumns[0].replace(/\s*\[.*$/, "").trim().toLowerCase();
    if (qtyBase === monthBase) {
      monthColumns.unshift(mapping.qty);
    }
  }
  if (monthColumns.length > 0) {
    mapping._monthColumns = monthColumns;
    confidence._monthColumns = 0.85;
  }

  // Weekly columns
  const weekPattern = /^(w|week|wk)\s?\d+$/i;
  const weekColumns = headers.filter((h) => weekPattern.test(h.trim()));
  if (weekColumns.length > 0) {
    mapping._weekColumns = weekColumns;
    confidence._weekColumns = 0.85;
  }

  const unmapped = headers.filter((h) => !usedColumns.has(h) && !monthColumns.includes(h) && !weekColumns.includes(h));

  return { mapping, confidence, unmapped };
}

/**
 * Detect if the file is a QuickBooks export.
 */
function detectQuickBooksFormat(headers) {
  const qbSignatures = [
    ["date", "num", "name", "memo", "account", "debit", "credit"],
    ["item", "qty", "amount", "balance"],
    ["customer", "invoice", "amount", "balance"],
    ["customer:job", "amount"],
    ["date", "invoice", "name", "amount", "balance"],
    ["account", "total"],
    ["date", "num", "customer", "amount"],
    ["type", "date", "name", "amount"],
    ["date", "name", "amount", "open balance"],
  ];

  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const sig of qbSignatures) {
    const matchCount = sig.filter((s) => lowerHeaders.some((h) => h.includes(s))).length;
    if (matchCount >= sig.length * 0.7) {
      return {
        isQuickBooks: true,
        format: sig.includes("debit") ? "transaction_detail" :
                sig.includes("item") ? "sales_by_item" :
                sig.includes("invoice") ? "customer_report" : "profit_loss",
      };
    }
  }

  return { isQuickBooks: false, format: null };
}

/**
 * Detect the overall data type of the upload.
 */
function detectUploadType(headers, rows, mapping) {
  const qb = detectQuickBooksFormat(headers);
  if (qb.isQuickBooks) {
    // Map QuickBooks subtypes to specific types that normalizeSourceType recognizes
    const qbTypeMap = {
      transaction_detail: "quickbooks_revenue",
      sales_by_item: "quickbooks_revenue",
      customer_report: "ar_aging",
      profit_loss: "quickbooks_revenue",
    };
    return { type: qbTypeMap[qb.format] || "quickbooks_revenue", subtype: qb.format };
  }

  const hasAcct = !!mapping.acct;
  const hasDist = !!mapping.dist;
  const hasSt = !!mapping.st;
  const hasQty = !!mapping.qty;
  const hasDate = !!mapping.date;
  const hasOH = !!mapping.oh;
  const hasStage = !!mapping.stage;
  const hasMonths = !!mapping._monthColumns;
  const hasWeeks = !!mapping._weekColumns;

  // AR/AP Aging detection: aging bucket columns
  const headerLowerAll = headers.map((h) => (h || "").toLowerCase().trim());
  const hasAgingBuckets = headerLowerAll.some((h) => h === "current" || h.includes("1 - 30") || h.includes("1-30")) &&
    headerLowerAll.some((h) => h.includes("31") && h.includes("60"));
  if (hasAgingBuckets) {
    const hasVendor = headerLowerAll.some((h) => h.includes("vendor") || h.includes("supplier"));
    return { type: hasVendor ? "ap_aging" : "ar_aging" };
  }

  if (hasOH || mapping.doh) return { type: "inventory" };
  if (hasStage || mapping.estValue) return { type: "pipeline" };

  // Product sheet detection: many product-descriptive columns, few transaction columns.
  // Check early, before lenient depletion fallbacks, because product sheets
  // can accidentally match "acct" via the "name" alias in autoDetectMapping.
  const productCols = ["sku", "category", "size"].filter((f) => !!mapping[f]).length;
  const headerLower = headers.map((h) => (h || "").toLowerCase().trim());
  const productHeaders = ["varietal", "grape", "appellation", "vintage", "region", "country",
    "producer", "winery", "estate", "domaine", "chateau", "case size", "bottle size",
    "upc", "abv", "alcohol", "tasting notes", "fob"];
  const productHeaderCount = productHeaders.filter((ph) => headerLower.some((h) => h.includes(ph))).length;
  const transactionCols = ["qty", "date", "revenue", "oh", "stage"].filter((f) => !!mapping[f]).length;
  if ((productCols + productHeaderCount) >= 3 && transactionCols < 2) {
    return { type: "product_sheet" };
  }

  // Depletion: acct+dist+qty is ideal, but acct+qty with months/weeks is also depletion
  if (hasAcct && hasDist && (hasQty || hasMonths || hasWeeks)) return { type: "depletion" };
  if (hasAcct && (hasMonths || hasWeeks)) return { type: "depletion" };
  if (hasDist && (hasQty || hasMonths || hasWeeks)) return { type: "depletion" };
  if (hasAcct && hasDate && hasQty) return { type: "purchases" };
  if (hasAcct && (hasQty || mapping.revenue)) return { type: "sales" };
  // Fallback: if we have quantity data with any dimension, treat as depletion
  if (hasQty && (hasAcct || hasDist || hasSt)) return { type: "depletion" };

  return { type: "unknown" };
}

module.exports = {
  FIELD_DEFS,
  ROLE_FIELD_OVERRIDES,
  getFieldDefs,
  autoDetectMapping,
  detectQuickBooksFormat,
  detectUploadType,
};
