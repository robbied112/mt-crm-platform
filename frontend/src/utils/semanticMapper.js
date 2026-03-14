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
 */
const FIELD_DEFS = [
  {
    field: "acct",
    label: "Account Name",
    headerAliases: ["account", "account name", "customer", "outlet", "retailer", "location", "store", "buyer", "customer name", "name"],
    testValues: (vals) => {
      // Account names: mostly strings, many unique, often contain business words
      const businessWords = /\b(bar|grill|tavern|restaurant|store|liquor|market|pub|cafe|lounge|bistro|inn|hotel|club|wine|beer|pizza|bbq|brew|tap|bottle)\b/i;
      const matchCount = vals.filter((v) => typeof v === "string" && businessWords.test(v)).length;
      return matchCount >= 2 ? 0.9 : 0;
    },
  },
  {
    field: "dist",
    label: "Distributor",
    headerAliases: ["distributor", "wholesaler", "dist", "dist name", "supplier", "vendor", "distributor name", "wholesale"],
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
    headerAliases: ["channel", "trade channel", "premise", "segment", "class of trade", "class"],
    testValues: (vals) => {
      const matches = vals.filter((v) => CHANNEL_VALUES.has(String(v).toLowerCase().trim()));
      return matches.length >= 2 ? 0.9 : 0;
    },
  },
  {
    field: "sku",
    label: "Product / SKU",
    headerAliases: ["product", "sku", "item", "item name", "brand", "product name", "description", "item description", "upc"],
    testValues: () => 0, // Rely on header matching
  },
  {
    field: "qty",
    label: "Quantity / Volume",
    headerAliases: ["qty", "quantity", "cases", "volume", "ce", "units", "amount sold", "total cases", "case equiv", "9le", "9l equiv", "units sold", "physical cases"],
    testValues: (vals) => {
      const nums = vals.filter((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0);
      return nums.length >= 4 ? 0.5 : 0; // Low confidence — many columns are numeric
    },
  },
  {
    field: "date",
    label: "Date / Period",
    headerAliases: ["date", "period", "week", "month", "invoice date", "order date", "ship date", "transaction date", "txn date"],
    testValues: (vals) => {
      const datePattern = /^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$|^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
      const matches = vals.filter((v) => datePattern.test(String(v).trim()));
      return matches.length >= 3 ? 0.9 : 0;
    },
  },
  {
    field: "revenue",
    label: "Revenue / Dollar Amount",
    headerAliases: ["revenue", "sales", "amount", "total", "price", "ext price", "extended price", "dollars", "debit", "credit", "balance", "net amount"],
    testValues: (vals) => {
      const dollarPattern = /^\$?[\d,]+\.?\d*$/;
      const matches = vals.filter((v) => dollarPattern.test(String(v).trim().replace(/[()]/g, "")));
      return matches.length >= 3 ? 0.6 : 0;
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
];

/**
 * Score how well a header matches a field definition.
 * Returns 0-1 confidence.
 */
function scoreHeaderMatch(header, aliases) {
  const h = header.toLowerCase().trim();
  // Exact match
  if (aliases.includes(h)) return 1.0;
  // Partial / contains match
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
 * @returns {{ mapping: object, confidence: object, unmapped: string[] }}
 */
export function autoDetectMapping(headers, rows) {
  const sampleRows = rows.slice(0, 5);
  const mapping = {};       // { internalField: csvColumn }
  const confidence = {};    // { internalField: 0-1 }
  const usedColumns = new Set();

  // Score every (field, column) pair
  const scores = [];
  for (const def of FIELD_DEFS) {
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

  // Sort by score descending, then assign greedily (each column used only once)
  scores.sort((a, b) => b.score - a.score);
  for (const { field, column, score } of scores) {
    if (mapping[field] || usedColumns.has(column)) continue;
    mapping[field] = column;
    confidence[field] = score;
    usedColumns.add(column);
  }

  // Detect monthly columns by name pattern (Nov, Dec, Jan, Feb, etc.)
  const monthPattern = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\-_]?\d{0,4}$/i;
  const monthColumns = headers.filter((h) => monthPattern.test(h.trim()));
  if (monthColumns.length > 0) {
    mapping._monthColumns = monthColumns;
    confidence._monthColumns = 0.85;
  }

  // Weekly columns (Week 1, W1, etc.)
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
export function detectQuickBooksFormat(headers) {
  const qbSignatures = [
    // QB Transaction Detail
    ["date", "num", "name", "memo", "account", "debit", "credit"],
    // QB Sales by Item
    ["item", "qty", "amount", "balance"],
    // QB Customer report
    ["customer", "invoice", "amount", "balance"],
    // QB Profit & Loss
    ["account", "total"],
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
export function detectUploadType(headers, rows, mapping) {
  const qb = detectQuickBooksFormat(headers);
  if (qb.isQuickBooks) return { type: "quickbooks", subtype: qb.format };

  // Check what fields we were able to map
  const hasAcct = !!mapping.acct;
  const hasDist = !!mapping.dist;
  const hasSt = !!mapping.st;
  const hasQty = !!mapping.qty;
  const hasDate = !!mapping.date;
  const hasOH = !!mapping.oh;
  const hasStage = !!mapping.stage;
  const hasMonths = !!mapping._monthColumns;
  const hasWeeks = !!mapping._weekColumns;

  if (hasOH || mapping.doh) return { type: "inventory" };
  if (hasStage || mapping.estValue) return { type: "pipeline" };
  if (hasAcct && hasDist && (hasQty || hasMonths || hasWeeks)) return { type: "depletion" };
  if (hasAcct && hasDate && hasQty) return { type: "purchases" };
  if (hasAcct && (hasQty || mapping.revenue)) return { type: "sales" };

  return { type: "unknown" };
}

export { FIELD_DEFS };
