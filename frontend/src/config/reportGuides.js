/**
 * Report Guide Content System — config/reportGuides.js
 *
 * Unified schema serving two consumers:
 *   1. Setup Assistant UI — human-readable steps, tips, report descriptions
 *   2. File detection — headerSignatures[] and filenamePatterns[] for matching
 *
 * DISTRIBUTOR_SYSTEMS structure:
 *   {
 *     [systemId]: {
 *       name, shortName, sourceName, category, cadence,
 *       headerSignatures: [[col1, col2], ...],   // arrays of column names that fingerprint this system
 *       filenamePatterns: [/regex/i, ...],         // filename patterns
 *       reports: {
 *         [reportType]: { title, description, steps[], tips[], expectedColumns[] }
 *       }
 *     }
 *   }
 *
 * Categories group sources in the Setup Assistant:
 *   "distributor" — Distributor portal report guides
 *   "accounting"  — Accounting software export guides
 *   "dtc"         — DTC / e-commerce platforms (future)
 *   "industry"    — Industry-specific report systems
 *
 * ROLE_RECOMMENDATIONS maps business role → ordered list of which data types to upload first.
 * ROLE_CATEGORY_ORDER maps business role → category display priority in Setup Assistant.
 */

export const ONBOARDING_STEPS = ["role", "distributors", "guides", "upload", "health"];

/**
 * Category definitions — display order and labels for the Setup Assistant.
 */
export const DATA_SOURCE_CATEGORIES = [
  { key: "distributor", label: "Distributor Portals" },
  { key: "accounting", label: "Accounting Software" },
  { key: "dtc", label: "DTC / E-Commerce" },
  { key: "industry", label: "Industry Reports" },
];

/**
 * Planned sources — shown as "Coming Soon" in the Setup Assistant.
 * These are not selectable and have no report guides yet.
 */
export const PLANNED_SOURCES = [
  { id: "shopify", name: "Shopify", category: "dtc" },
  { id: "woocommerce", name: "WooCommerce", category: "dtc" },
  { id: "xero", name: "Xero", category: "accounting" },
];

/**
 * Role-based category ordering — which categories appear first
 * based on the user's business type.
 */
export const ROLE_CATEGORY_ORDER = {
  Winery: ["distributor", "accounting", "industry", "dtc"],
  Importer: ["distributor", "accounting", "industry", "dtc"],
  Distributor: ["accounting", "distributor", "industry", "dtc"],
  Retailer: ["accounting", "dtc", "industry", "distributor"],
};

export const DISTRIBUTOR_SYSTEMS = {
  sgws: {
    name: "Southern Glazer's Wine & Spirits",
    shortName: "SGWS",
    sourceName: "SGWS Portal / Proof",
    category: "distributor",
    cadence: "weekly",
    headerSignatures: [
      ["PREMISE TYPE", "CORP ITEM CD", "CASES"],
      ["PREMISE TYPE", "ITEM DESCRIPTION", "9L CASES"],
      ["DEPLETIONS", "CORP ITEM", "ACCOUNT NAME"],
    ],
    filenamePatterns: [/sgws/i, /southern.*glazer/i, /sg\s*ws/i, /proof.*report/i],
    reports: {
      depletion: {
        title: "Weekly Depletion Report",
        description: "Shows cases sold by your distributor to their retail/on-premise accounts each week.",
        steps: [
          "Log in to the SGWS Proof portal (proof.sgws.com)",
          "Navigate to Reports > Depletion Reports",
          "Select 'Weekly Depletion' report type",
          "Set your date range (recommend last 13 weeks for best dashboard results)",
          "Select all states/markets you want to include",
          "Click 'Export' and choose Excel (.xlsx) format",
          "Upload the downloaded file here",
        ],
        tips: [
          "13 weeks of data gives you the best trend analysis and momentum scores",
          "Include all markets — the dashboard will break them out by state automatically",
          "If you see 'PREMISE TYPE' in your columns, you have the right report",
        ],
        expectedColumns: ["CORP ITEM CD", "ITEM DESCRIPTION", "PREMISE TYPE", "CASES", "ACCOUNT NAME", "STATE"],
      },
      inventory: {
        title: "Distributor Inventory Report",
        description: "Shows current stock levels at SGWS warehouses — what they have on hand of your products.",
        steps: [
          "Log in to the SGWS Proof portal",
          "Navigate to Reports > Inventory Reports",
          "Select 'Current Inventory' or 'Inventory Status'",
          "Export as Excel (.xlsx)",
          "Upload the downloaded file here",
        ],
        tips: [
          "Run this monthly to track days-on-hand trends",
          "Combining inventory with depletion data unlocks reorder forecasting",
        ],
        expectedColumns: ["ITEM", "ON HAND", "CASES SHIPPED", "WAREHOUSE"],
      },
    },
  },

  breakthru: {
    name: "Breakthru Beverage Group",
    shortName: "Breakthru",
    sourceName: "Breakthru Encompass Portal",
    category: "distributor",
    cadence: "weekly",
    headerSignatures: [
      ["ITEM NUMBER", "BRAND FAMILY", "DEPLETION QTY"],
      ["ITEM NBR", "BRAND", "DEPL CASES"],
      ["ACCOUNT NUMBER", "ITEM NUMBER", "CASES SHIPPED"],
    ],
    filenamePatterns: [/breakthru/i, /encompass/i, /bbg/i],
    reports: {
      depletion: {
        title: "Depletion Detail Report",
        description: "Cases depleted (sold to retail) by Breakthru, broken down by account and product.",
        steps: [
          "Log in to the Breakthru Encompass portal",
          "Go to Reports > Sales Reports > Depletion Detail",
          "Set the date range (13 weeks recommended)",
          "Select your brands/items",
          "Click 'Export to Excel'",
          "Upload the downloaded file here",
        ],
        tips: [
          "Breakthru reports often use 'ITEM NUMBER' instead of SKU — the system maps this automatically",
          "If you have access to multiple markets, run a combined report for the best territory view",
        ],
        expectedColumns: ["ITEM NUMBER", "BRAND FAMILY", "ACCOUNT NAME", "DEPLETION QTY", "STATE"],
      },
      shipment: {
        title: "Shipment / Purchase Report",
        description: "What Breakthru purchased from you (sell-in). Compare with depletions to see sell-through rate.",
        steps: [
          "In Encompass, go to Reports > Purchase Reports",
          "Select 'Shipment Detail' or 'Purchase Detail'",
          "Set date range to match your depletion report",
          "Export as Excel",
          "Upload the downloaded file here",
        ],
        tips: [
          "Uploading both depletions AND shipments unlocks the Distributor Health scorecard",
          "Sell-through rate = depletions ÷ shipments — a key health indicator",
        ],
        expectedColumns: ["ITEM NUMBER", "CASES SHIPPED", "INVOICE DATE", "ACCOUNT"],
      },
    },
  },

  rndc: {
    name: "Republic National Distributing Company",
    shortName: "RNDC",
    sourceName: "RNDC iDIG Portal",
    category: "distributor",
    cadence: "weekly",
    headerSignatures: [
      ["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED"],
      ["PROD CD", "ACCT NAME", "DEPL CS"],
      ["ITEM CODE", "NET UNITS", "ACCOUNT"],
    ],
    filenamePatterns: [/rndc/i, /republic.*national/i],
    reports: {
      depletion: {
        title: "Depletion Report",
        description: "RNDC's depletion data showing cases sold to retail accounts.",
        steps: [
          "Log in to the RNDC iDIG portal (idig.rndc.com)",
          "Navigate to Reports > Depletion",
          "Choose 'Depletion Detail' for the most granular data",
          "Set your date range (13 weeks for trend data)",
          "Select your supplier code / brand family",
          "Export to Excel format",
          "Upload the downloaded file here",
        ],
        tips: [
          "iDIG uses 'PRODUCT CODE' — the system recognizes this as your SKU",
          "RNDC reports may split by division — combine into one file or upload separately",
        ],
        expectedColumns: ["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED", "ACCT NAME", "STATE"],
      },
    },
  },

  youngs: {
    name: "Young's Market Company",
    shortName: "Young's",
    sourceName: "Young's Supplier Portal",
    category: "distributor",
    cadence: "weekly",
    headerSignatures: [
      ["ITEM #", "DESCRIPTION", "CASES SOLD"],
      ["PRODUCT", "ACCOUNT", "QTY SHIPPED"],
    ],
    filenamePatterns: [/young/i, /youngs/i],
    reports: {
      depletion: {
        title: "Sales / Depletion Report",
        description: "Young's Market depletion data by account and product.",
        steps: [
          "Log in to the Young's Market supplier portal",
          "Navigate to Reports or Sales Data section",
          "Select Depletion or Sales Detail report",
          "Set your date range",
          "Export as Excel or CSV",
          "Upload the downloaded file here",
        ],
        tips: [
          "Young's reports typically cover CA, OR, WA, and HI markets",
          "Column names may vary — the AI mapper handles most variations automatically",
        ],
        expectedColumns: ["ITEM #", "DESCRIPTION", "CASES SOLD", "ACCOUNT", "STATE"],
      },
    },
  },

  quickbooks: {
    name: "QuickBooks",
    shortName: "QuickBooks",
    sourceName: "QuickBooks Online / Desktop",
    category: "accounting",
    cadence: "monthly",
    headerSignatures: [
      ["DATE", "TRANSACTION TYPE", "AMOUNT", "BALANCE"],
      ["INVOICE DATE", "CUSTOMER", "AMOUNT", "PRODUCT/SERVICE"],
      ["DATE", "NAME", "AMOUNT", "ACCOUNT"],
      ["AGING", "CURRENT", "1 - 30", "31 - 60"],
    ],
    filenamePatterns: [/quickbooks/i, /qb_/i, /qbo_/i, /intuit/i],
    reports: {
      revenue: {
        title: "Sales by Customer Summary",
        description: "Revenue broken down by customer — shows who's buying what and total sales volume.",
        steps: [
          "In QuickBooks, go to Reports",
          "Search for 'Sales by Customer Summary' or 'Sales by Product/Service'",
          "Set the date range (last 12 months recommended)",
          "Click 'Export' or 'Export to Excel'",
          "Upload the downloaded file here",
        ],
        tips: [
          "The 'Sales by Customer Summary' gives the best overview of your revenue by account",
          "For product-level detail, also export 'Sales by Product/Service Summary'",
          "Make sure the date range covers at least one full quarter for meaningful trends",
        ],
        expectedColumns: ["CUSTOMER", "TOTAL", "AMOUNT", "DATE"],
      },
      arAging: {
        title: "Accounts Receivable Aging Report",
        description: "Shows outstanding invoices and how long they've been unpaid — essential for cash flow management.",
        steps: [
          "In QuickBooks, go to Reports",
          "Search for 'A/R Aging Summary' or 'Accounts Receivable Aging'",
          "Set the 'As of' date (typically today)",
          "Click 'Export to Excel'",
          "Upload the downloaded file here",
        ],
        tips: [
          "AR Aging data unlocks the Executive Dashboard's cash flow view",
          "The standard aging buckets (Current, 1-30, 31-60, 61-90, 90+) are auto-detected",
          "Run this monthly to track collection trends over time",
        ],
        expectedColumns: ["CUSTOMER", "CURRENT", "1 - 30", "31 - 60", "61 - 90", "91 AND OVER", "TOTAL"],
      },
    },
  },

  idig: {
    name: "iDig",
    shortName: "iDig",
    sourceName: "RNDC iDIG Portal",
    category: "industry",
    cadence: "weekly",
    headerSignatures: [
      ["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED"],
      ["PROD CD", "ACCT NAME", "DEPL CS"],
    ],
    filenamePatterns: [/idig/i, /i-dig/i],
    reports: {
      depletion: {
        title: "iDig Depletion Report",
        description: "Depletion data from the iDig portal — RNDC's industry reporting system showing cases sold to retail accounts.",
        steps: [
          "Log in to iDig (idig.rndc.com)",
          "Navigate to Reports > Depletion",
          "Choose 'Depletion Detail' for account-level data",
          "Set your date range (13 weeks for trend data)",
          "Select your supplier code / brand family",
          "Export to Excel format",
          "Upload the downloaded file here",
        ],
        tips: [
          "iDig is RNDC's reporting portal — if you're an RNDC supplier, this is where your data lives",
          "Uses 'PRODUCT CODE' for SKU identification — the system maps this automatically",
          "RNDC reports may split by division — combine into one file or upload separately",
        ],
        expectedColumns: ["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED", "ACCT NAME", "STATE"],
      },
    },
  },

  generic: {
    name: "Other Distributor",
    shortName: "Other",
    sourceName: "Your Distributor Portal",
    category: "distributor",
    cadence: null,
    headerSignatures: [],
    filenamePatterns: [],
    reports: {
      depletion: {
        title: "Depletion / Sales Report",
        description: "A report showing cases or units sold by your distributor to their accounts.",
        steps: [
          "Log in to your distributor's portal or reporting system",
          "Look for a 'Depletion', 'Sales', or 'Shipment' report",
          "Export the most detailed version available (account-level, weekly if possible)",
          "Choose Excel (.xlsx) or CSV format",
          "Upload the downloaded file here",
        ],
        tips: [
          "The AI column mapper works with most report formats — it will detect your columns automatically",
          "For best results, include: product/SKU, account name, quantity/cases, and date or week",
          "Don't worry about extra columns — the system ignores what it doesn't need",
          "If the auto-mapping looks wrong, you can adjust it manually before importing",
        ],
        expectedColumns: [],
      },
      inventory: {
        title: "Inventory Report",
        description: "Current stock levels at your distributor's warehouse.",
        steps: [
          "Look for an 'Inventory', 'Stock Status', or 'On Hand' report in your portal",
          "Export the most recent snapshot",
          "Upload the file here",
        ],
        tips: [
          "Inventory data unlocks reorder forecasting — the system predicts when accounts will need to reorder",
          "Key columns: product/SKU, on-hand quantity, location/warehouse",
        ],
        expectedColumns: [],
      },
      pipeline: {
        title: "Account / Prospect List",
        description: "Your sales pipeline — accounts you're working on placing with.",
        steps: [
          "Export your prospect list from your CRM, spreadsheet, or distributor portal",
          "Include: account name, status or stage, estimated volume, and any notes",
          "Upload the file here",
        ],
        tips: [
          "Pipeline data powers the Pipeline dashboard and deal tracking",
          "If you don't have a formal pipeline, you can create accounts manually in the CRM section instead",
        ],
        expectedColumns: [],
      },
    },
  },

  genericAccounting: {
    name: "Other Accounting Software",
    shortName: "Other",
    sourceName: "Your Accounting Software",
    category: "accounting",
    cadence: null,
    headerSignatures: [],
    filenamePatterns: [],
    reports: {
      revenue: {
        title: "Revenue / Sales Export",
        description: "Revenue data exported from your accounting system — sales by customer, product, or date.",
        steps: [
          "Open your accounting software (QuickBooks, Xero, FreshBooks, Wave, etc.)",
          "Look for a 'Sales Summary', 'Revenue Report', or 'Profit & Loss' report",
          "Set the date range (at least one quarter recommended)",
          "Export as Excel (.xlsx) or CSV",
          "Upload the downloaded file here",
        ],
        tips: [
          "The AI mapper recognizes most accounting export formats automatically",
          "Key columns: customer/account name, amount/total, date, and product/service",
          "Don't worry about extra columns — the system only uses what it needs",
        ],
        expectedColumns: [],
      },
    },
  },
};

/**
 * Role-based recommendations — which data to upload first, by business type.
 * Used by SetupAssistant to guide users toward their highest-value first upload.
 */
export const ROLE_RECOMMENDATIONS = {
  Winery: {
    primary: "depletion",
    primaryLabel: "Distributor Depletion Report",
    primaryWhy: "See how your wines are selling across all your distributors and markets",
    secondary: ["inventory", "pipeline"],
    secondaryLabels: {
      inventory: "Upload distributor inventory to unlock reorder forecasting",
      pipeline: "Add your prospect pipeline to track new placements",
    },
  },
  Importer: {
    primary: "depletion",
    primaryLabel: "Distributor Depletion Report",
    primaryWhy: "Track sell-through across your portfolio of producers and distributors",
    secondary: ["inventory"],
    // billback deferred — add back when billback DATA_TYPE entry exists in DataHealthCard
    secondaryLabels: {
      inventory: "Upload inventory for stock visibility across warehouses",
    },
  },
  Distributor: {
    primary: "depletion",
    primaryLabel: "Sales / Depletion Export",
    primaryWhy: "Analyze your sales performance by account, rep, and product",
    secondary: ["inventory"],
    secondaryLabels: {
      inventory: "Upload warehouse inventory for days-on-hand analysis",
    },
  },
  Retailer: {
    primary: "inventory",
    primaryLabel: "Inventory / POS Export",
    primaryWhy: "Track what's selling and what needs reordering",
    secondary: ["depletion"],
    secondaryLabels: {
      depletion: "Upload purchase history for trend analysis",
    },
  },
};

/**
 * Match uploaded file headers against system signatures.
 * Returns { systemId, systemName, shortName } or null if no match.
 */
export function matchDistributorByHeaders(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  const upperHeaders = headers.map((h) => String(h).toUpperCase().trim());

  for (const [systemId, system] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
    if (systemId === "generic" || systemId === "genericAccounting") continue;
    for (const signature of system.headerSignatures) {
      const matches = signature.every((sigCol) =>
        upperHeaders.some((h) => h.includes(sigCol.toUpperCase()))
      );
      if (matches) {
        return { systemId, systemName: system.name, shortName: system.shortName };
      }
    }
  }
  return null;
}

/**
 * Match uploaded filename against system patterns.
 * Returns { systemId, systemName, shortName } or null if no match.
 */
export function matchDistributorByFilename(filename) {
  if (!filename) return null;

  for (const [systemId, system] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
    if (systemId === "generic" || systemId === "genericAccounting") continue;
    for (const pattern of system.filenamePatterns) {
      if (pattern.test(filename)) {
        return { systemId, systemName: system.name, shortName: system.shortName };
      }
    }
  }
  return null;
}

/**
 * Get report guide for a given system and report type.
 * Falls back to generic guide if system or report type not found.
 */
export function getReportGuide(systemId, reportType = "depletion") {
  const system = DISTRIBUTOR_SYSTEMS[systemId] || DISTRIBUTOR_SYSTEMS.generic;
  const report = system.reports[reportType] || system.reports.depletion || Object.values(system.reports)[0];
  return { system, report };
}

/**
 * Get distributor-category system IDs (excluding generics).
 * Used by DataImport for file detection.
 */
export function getDistributorSystemIds() {
  return Object.keys(DISTRIBUTOR_SYSTEMS).filter((id) => id !== "generic" && id !== "genericAccounting");
}

/**
 * Get all selectable source IDs (excluding generics).
 * Used by SetupAssistant for the source picker.
 */
export function getAllSourceIds() {
  return Object.keys(DISTRIBUTOR_SYSTEMS).filter(
    (id) => id !== "generic" && id !== "genericAccounting"
  );
}

/**
 * Group systems by category.
 * Returns { distributor: [systemId, ...], accounting: [...], ... }
 * Only includes categories that have at least one real (non-generic) entry.
 */
export function getSystemsByCategory() {
  const result = {};
  for (const [id, system] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
    if (id === "generic" || id === "genericAccounting") continue;
    const cat = system.category || "distributor";
    if (!result[cat]) result[cat] = [];
    result[cat].push(id);
  }
  return result;
}

/**
 * Get category display order for a given role.
 * Falls back to default Winery order for unknown roles.
 */
export function getCategoryOrder(role) {
  return ROLE_CATEGORY_ORDER[role] || ROLE_CATEGORY_ORDER.Winery;
}
