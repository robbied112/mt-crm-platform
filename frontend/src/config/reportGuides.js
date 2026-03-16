/**
 * Report Guide Content System — config/reportGuides.js
 *
 * Unified schema serving two consumers:
 *   1. Setup Assistant UI — human-readable steps, tips, report descriptions
 *   2. File detection (TODO-053) — headerSignatures[] and filenamePatterns[] for matching
 *
 * DISTRIBUTOR_SYSTEMS structure:
 *   {
 *     [systemId]: {
 *       name, shortName, portalName,
 *       headerSignatures: [[col1, col2], ...],   // arrays of column names that fingerprint this system
 *       filenamePatterns: [/regex/i, ...],         // filename patterns
 *       reports: {
 *         [reportType]: { title, description, steps[], tips[], expectedColumns[] }
 *       }
 *     }
 *   }
 *
 * ROLE_RECOMMENDATIONS maps business role → ordered list of which data types to upload first.
 */

export const ONBOARDING_STEPS = ["role", "distributors", "guides", "upload", "health"];

export const DISTRIBUTOR_SYSTEMS = {
  sgws: {
    name: "Southern Glazer's Wine & Spirits",
    shortName: "SGWS",
    portalName: "SGWS Portal / Proof",
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
    portalName: "Breakthru Encompass Portal",
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
    portalName: "iDIG Portal",
    headerSignatures: [
      ["PRODUCT CODE", "PRODUCT DESCRIPTION", "CASES DEPLETED"],
      ["PROD CD", "ACCT NAME", "DEPL CS"],
      ["ITEM CODE", "NET UNITS", "ACCOUNT"],
    ],
    filenamePatterns: [/rndc/i, /republic.*national/i, /idig/i],
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
    portalName: "Young's Supplier Portal",
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

  generic: {
    name: "Other Distributor",
    shortName: "Other",
    portalName: "Your Distributor Portal",
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
 * Match uploaded file headers against distributor system signatures.
 * Returns { systemId, systemName } or null if no match.
 */
export function matchDistributorByHeaders(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  const upperHeaders = headers.map((h) => String(h).toUpperCase().trim());

  for (const [systemId, system] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
    if (systemId === "generic") continue;
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
 * Match uploaded filename against distributor system patterns.
 * Returns { systemId, systemName } or null if no match.
 */
export function matchDistributorByFilename(filename) {
  if (!filename) return null;

  for (const [systemId, system] of Object.entries(DISTRIBUTOR_SYSTEMS)) {
    if (systemId === "generic") continue;
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
 * Get all available system IDs (excluding generic).
 */
export function getDistributorSystemIds() {
  return Object.keys(DISTRIBUTOR_SYSTEMS).filter((id) => id !== "generic");
}
