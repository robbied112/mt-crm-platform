/**
 * Revenue Transform
 *
 * Aggregates raw revenue import rows into 3 precomputed views:
 * - revenueByChannel: channel x month grid with actuals
 * - revenueByProduct: SKU x month with totals
 * - revenueSummary: YTD total, annual run rate, top channel, top SKU, monthly totals
 *
 * Supports QuickBooks Sales by Customer Detail, Shopify exports, and manual entry.
 * Channel assignment: QB -> Distributors, Shopify -> Website/DTC, column override if present.
 */

const CHANNELS = {
  distributors: "Distributors",
  dtc: "Website / DTC",
  offPremise: "Direct to Trade - Off Premise",
  onPremise: "Direct to Trade - On Premise",
  other: "Other",
};

const CHANNEL_VALUES = Object.values(CHANNELS);

function num(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

function getMapped(row, mapping, field) {
  const col = mapping[field];
  return col ? row[col] : undefined;
}

/**
 * Resolve a row's channel from data or source metadata.
 * Priority: explicit channel column > source-based inference > "Other"
 */
function resolveChannel(channelValue, sourceType) {
  const ch = str(channelValue).toLowerCase();

  // Exact match against known channels
  for (const [key, label] of Object.entries(CHANNELS)) {
    if (ch === label.toLowerCase() || ch === key) return label;
  }

  // Keyword matching
  if (ch.includes("distributor") || ch.includes("wholesale")) return CHANNELS.distributors;
  if (ch.includes("dtc") || ch.includes("direct to consumer") || ch.includes("website") || ch.includes("shopify") || ch.includes("woocommerce") || ch.includes("online")) return CHANNELS.dtc;
  if (ch.includes("off-premise") || ch.includes("off premise") || ch.includes("retail") || ch.includes("liquor store") || ch.includes("grocery")) return CHANNELS.offPremise;
  if (ch.includes("on-premise") || ch.includes("on premise") || ch.includes("restaurant") || ch.includes("bar") || ch.includes("hotel")) return CHANNELS.onPremise;

  // Source-based inference
  const src = str(sourceType).toLowerCase();
  if (src.includes("quickbooks") || src === "quickbooks") return CHANNELS.distributors;
  if (src.includes("shopify") || src.includes("woocommerce")) return CHANNELS.dtc;

  return CHANNELS.other;
}

function parseMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Use UTC to avoid timezone shifts on date-only strings
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed
  return { year, month, key: `${year}-${String(month + 1).padStart(2, "0")}` };
}

/**
 * Dateless fallback: aggregate revenue by channel and product without
 * monthly breakdown. Used when >80% of rows have no valid date (e.g.,
 * QB Customer Balance Summary, A/R Aging exports).
 */
function transformRevenueDateless(rows, warnings) {
  const channelTotals = {};
  const skuTotals = {};
  let grandTotal = 0;

  for (const row of rows) {
    const ch = row.channel;
    channelTotals[ch] = (channelTotals[ch] || 0) + row.amount;
    skuTotals[row.sku] = (skuTotals[row.sku] || 0) + row.amount;
    grandTotal += row.amount;
  }

  const revenueByChannel = Object.entries(channelTotals)
    .map(([channel, total]) => ({
      channel,
      months: { "all-time": Math.round(total * 100) / 100 },
      total: Math.round(total * 100) / 100,
    }))
    .filter((ch) => ch.total !== 0)
    .sort((a, b) => b.total - a.total);

  const revenueByProduct = Object.entries(skuTotals)
    .map(([sku, total]) => ({
      sku,
      months: { "all-time": Math.round(total * 100) / 100 },
      total: Math.round(total * 100) / 100,
    }))
    .filter((p) => p.total !== 0)
    .sort((a, b) => b.total - a.total);

  const topChannel = revenueByChannel[0]?.channel || "";
  const topSku = revenueByProduct[0]?.sku || "";

  const revenueSummary = {
    ytdTotal: Math.round(grandTotal * 100) / 100,
    annualRunRate: 0,
    topChannel,
    topSku,
    monthlyTotals: { "all-time": Math.round(grandTotal * 100) / 100 },
    monthKeys: ["all-time"],
    channelCount: revenueByChannel.length,
    skuCount: revenueByProduct.length,
    dateless: true,
    warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined,
  };

  return { revenueByChannel, revenueByProduct, revenueSummary };
}

function transformRevenue(rows, mapping) {
  if (!rows || rows.length === 0) {
    return {
      revenueByChannel: [],
      revenueByProduct: [],
      revenueSummary: {},
    };
  }

  const warnings = [];
  const validRows = [];
  const datelessRows = [];

  for (const row of rows) {
    const amount = num(getMapped(row, mapping, "revenue"));
    const dateRaw = getMapped(row, mapping, "date");
    const parsed = parseMonth(dateRaw);

    const common = {
      amount,
      channel: resolveChannel(
        getMapped(row, mapping, "ch"),
        getMapped(row, mapping, "_sourceType")
      ),
      sku: str(getMapped(row, mapping, "sku")) || "Uncategorized",
      acct: str(getMapped(row, mapping, "acct")),
    };

    if (parsed) {
      validRows.push({ ...common, date: parsed });
    } else {
      datelessRows.push(common);
    }
  }

  // Dateless fallback: if >80% of rows lack valid dates, aggregate all
  // revenue into a single "all-time" period instead of monthly breakdown.
  const totalParsed = validRows.length + datelessRows.length;
  const useDatelessFallback = totalParsed > 0 && datelessRows.length > totalParsed * 0.8;

  if (useDatelessFallback) {
    return transformRevenueDateless([...validRows, ...datelessRows], warnings);
  }

  if (datelessRows.length > 0) {
    warnings.push(`${datelessRows.length} row(s) skipped: missing or invalid date`);
  }

  // Collect all months
  const monthKeys = [...new Set(validRows.map((r) => r.date.key))].sort();

  // --- revenueByChannel ---
  const channelMonthMap = {};
  for (const ch of CHANNEL_VALUES) {
    channelMonthMap[ch] = {};
  }

  for (const row of validRows) {
    if (!channelMonthMap[row.channel]) channelMonthMap[row.channel] = {};
    channelMonthMap[row.channel][row.date.key] =
      (channelMonthMap[row.channel][row.date.key] || 0) + row.amount;
  }

  const revenueByChannel = CHANNEL_VALUES
    .map((ch) => {
      const months = {};
      let total = 0;
      for (const mk of monthKeys) {
        const val = channelMonthMap[ch]?.[mk] || 0;
        months[mk] = Math.round(val * 100) / 100;
        total += val;
      }
      return { channel: ch, months, total: Math.round(total * 100) / 100 };
    })
    .filter((ch) => ch.total !== 0);

  // --- revenueByProduct ---
  const skuMonthMap = {};
  for (const row of validRows) {
    if (!skuMonthMap[row.sku]) skuMonthMap[row.sku] = {};
    skuMonthMap[row.sku][row.date.key] =
      (skuMonthMap[row.sku][row.date.key] || 0) + row.amount;
  }

  const revenueByProduct = Object.entries(skuMonthMap)
    .map(([sku, months]) => {
      const monthData = {};
      let total = 0;
      for (const mk of monthKeys) {
        const val = months[mk] || 0;
        monthData[mk] = Math.round(val * 100) / 100;
        total += val;
      }
      return { sku, months: monthData, total: Math.round(total * 100) / 100 };
    })
    .sort((a, b) => b.total - a.total);

  // --- revenueSummary ---
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-indexed
  const monthsElapsed = currentMonth + 1; // Jan = 1 month elapsed

  let ytdTotal = 0;
  const monthlyTotals = {};
  for (const row of validRows) {
    const mk = row.date.key;
    monthlyTotals[mk] = (monthlyTotals[mk] || 0) + row.amount;
    if (row.date.year === currentYear) {
      ytdTotal += row.amount;
    }
  }

  const annualRunRate = monthsElapsed > 0
    ? Math.round((ytdTotal / monthsElapsed) * 12 * 100) / 100
    : 0;

  // Top channel by total
  const channelTotals = {};
  for (const row of validRows) {
    channelTotals[row.channel] = (channelTotals[row.channel] || 0) + row.amount;
  }
  const topChannel = Object.entries(channelTotals)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "";

  // Top SKU by total
  const topSku = revenueByProduct[0]?.sku || "";

  const sortedMonthlyTotals = {};
  for (const mk of monthKeys) {
    sortedMonthlyTotals[mk] = Math.round((monthlyTotals[mk] || 0) * 100) / 100;
  }

  const revenueSummary = {
    ytdTotal: Math.round(ytdTotal * 100) / 100,
    annualRunRate,
    topChannel,
    topSku,
    monthlyTotals: sortedMonthlyTotals,
    monthKeys,
    channelCount: revenueByChannel.length,
    skuCount: revenueByProduct.length,
    warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined,
  };

  return {
    revenueByChannel,
    revenueByProduct,
    revenueSummary,
  };
}

module.exports = { transformRevenue, CHANNELS, CHANNEL_VALUES };
