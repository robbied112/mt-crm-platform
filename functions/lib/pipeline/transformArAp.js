/**
 * AR/AP Aging Transform
 *
 * Parses QuickBooks A/R and A/P Aging Summary exports into structured
 * aging summary views for the Executive Dashboard.
 *
 * Produces: arAgingSummary and apAgingSummary
 * Each contains: total outstanding, aging buckets, top accounts/vendors,
 * overdue total and percentage.
 */

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
 * Detect aging bucket columns from row keys.
 * QB Desktop uses "Current", "1 - 30", "31 - 60", "61 - 90", "> 90"
 * QB Online uses "CURRENT", "1-30", "31-60", "61-90", "OVER 90"
 */
function detectBucketColumns(headers) {
  const h = headers.map((k) => k.toLowerCase().trim());
  const buckets = { current: null, "1-30": null, "31-60": null, "61-90": null, "90+": null };

  for (let i = 0; i < headers.length; i++) {
    const lower = h[i];
    if (lower === "current") buckets.current = headers[i];
    else if (lower.includes("1") && lower.includes("30") && !lower.includes("31")) buckets["1-30"] = headers[i];
    else if (lower.includes("31") && lower.includes("60")) buckets["31-60"] = headers[i];
    else if (lower.includes("61") && lower.includes("90")) buckets["61-90"] = headers[i];
    else if (lower.includes("over 90") || lower.includes("> 90") || lower.includes("90+") || (lower.includes("over") && lower.includes("90"))) buckets["90+"] = headers[i];
  }

  return buckets;
}

/**
 * Build an aging summary from rows.
 * @param {Array} rows - Normalized rows
 * @param {Object} mapping - Column mapping
 * @param {"ar"|"ap"} type - Determines entity label (customer vs vendor)
 * @returns {Object} Aging summary
 */
function buildAgingSummary(rows, mapping, type) {
  if (!rows || rows.length === 0) {
    return {
      totalOutstanding: 0,
      buckets: { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      topEntities: [],
      overdueTotal: 0,
      overduePercent: 0,
      entityCount: 0,
    };
  }

  // Detect bucket columns from row keys
  const sampleRow = rows[0];
  const allKeys = Object.keys(sampleRow);
  const bucketCols = detectBucketColumns(allKeys);

  const entityField = type === "ar" ? "acct" : "dist";
  const entities = {};

  for (const row of rows) {
    const name = str(getMapped(row, mapping, entityField)) || str(row[allKeys[0]]) || "Unknown";
    if (!name || name.toLowerCase() === "total") continue;

    const current = bucketCols.current ? num(row[bucketCols.current]) : 0;
    const b1_30 = bucketCols["1-30"] ? num(row[bucketCols["1-30"]]) : 0;
    const b31_60 = bucketCols["31-60"] ? num(row[bucketCols["31-60"]]) : 0;
    const b61_90 = bucketCols["61-90"] ? num(row[bucketCols["61-90"]]) : 0;
    const b90plus = bucketCols["90+"] ? num(row[bucketCols["90+"]]) : 0;

    // Try balance/total column as fallback for total
    const balance = num(getMapped(row, mapping, "balance")) || num(getMapped(row, mapping, "revenue"));
    const rowTotal = current + b1_30 + b31_60 + b61_90 + b90plus;
    const total = rowTotal !== 0 ? rowTotal : balance;

    if (!entities[name]) {
      entities[name] = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 };
    }
    entities[name].current += current;
    entities[name]["1-30"] += b1_30;
    entities[name]["31-60"] += b31_60;
    entities[name]["61-90"] += b61_90;
    entities[name]["90+"] += b90plus;
    entities[name].total += total;
  }

  const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let totalOutstanding = 0;

  for (const entity of Object.values(entities)) {
    buckets.current += entity.current;
    buckets["1-30"] += entity["1-30"];
    buckets["31-60"] += entity["31-60"];
    buckets["61-90"] += entity["61-90"];
    buckets["90+"] += entity["90+"];
    totalOutstanding += entity.total;
  }

  // Round buckets
  for (const key of Object.keys(buckets)) {
    buckets[key] = Math.round(buckets[key] * 100) / 100;
  }
  totalOutstanding = Math.round(totalOutstanding * 100) / 100;

  const overdueTotal = Math.round((buckets["31-60"] + buckets["61-90"] + buckets["90+"]) * 100) / 100;
  const overduePercent = totalOutstanding > 0
    ? Math.round((overdueTotal / totalOutstanding) * 10000) / 100
    : 0;

  // Top 10 entities by total
  const topEntities = Object.entries(entities)
    .map(([name, data]) => ({
      name,
      total: Math.round(data.total * 100) / 100,
      current: Math.round(data.current * 100) / 100,
      "1-30": Math.round(data["1-30"] * 100) / 100,
      "31-60": Math.round(data["31-60"] * 100) / 100,
      "61-90": Math.round(data["61-90"] * 100) / 100,
      "90+": Math.round(data["90+"] * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalOutstanding,
    buckets,
    topEntities,
    overdueTotal,
    overduePercent,
    entityCount: Object.keys(entities).length,
  };
}

function transformArAp(rows, mapping) {
  if (!rows || rows.length === 0) {
    return {
      arAgingSummary: {},
      apAgingSummary: {},
    };
  }

  // Determine if this is AR or AP based on column signatures
  // AR has customer/account columns, AP has vendor/supplier columns
  const allKeys = Object.keys(rows[0] || {});
  const lowerKeys = allKeys.map((k) => k.toLowerCase());

  const hasVendor = lowerKeys.some((k) =>
    k.includes("vendor") || k.includes("supplier")
  );
  const hasCustomer = lowerKeys.some((k) =>
    k.includes("customer") || k.includes("account") || k.includes("name")
  );

  // If we can detect the type, build the appropriate summary
  // If ambiguous, default to AR
  const result = {
    arAgingSummary: {},
    apAgingSummary: {},
  };

  if (hasVendor && !hasCustomer) {
    result.apAgingSummary = buildAgingSummary(rows, mapping, "ap");
  } else {
    result.arAgingSummary = buildAgingSummary(rows, mapping, "ar");
  }

  return result;
}

module.exports = { transformArAp, buildAgingSummary, detectBucketColumns };
