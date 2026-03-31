/**
 * Transform Layer
 *
 * Converts raw mapped rows into all internal dashboard data structures.
 * Handles depletion, purchase/sales, inventory, pipeline, QuickBooks,
 * revenue, and AR/AP aging data.
 */

const { transformRevenue } = require("./transformRevenue");
const { transformArAp } = require("./transformArAp");

// ─── Helpers ────────────────────────────────────────────────────

function num(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

function normalizeState(v) {
  const s = str(v).toUpperCase();
  return s.length === 2 ? s : s.slice(0, 2); // best effort
}

function normalizeChannel(v) {
  if (!v) return "Off-Premise";
  const lower = v.toLowerCase().trim();
  if (lower === "on" || lower === "on-premise" || lower === "on premise") return "On-Premise";
  if (lower === "off" || lower === "off-premise" || lower === "off premise") return "Off-Premise";
  return v;
}

function normalizeDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str(v);
}

function getMapped(row, mapping, field) {
  const col = mapping[field];
  return col ? row[col] : undefined;
}

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

/**
 * Detect summary/total rows that should not be treated as real accounts.
 * These rows aggregate data across accounts within a distributor report
 * and inflate account counts when left in.
 */
const _summaryPattern = /^(total|grand total|brand total|supplier total|territory total|all accounts?)$/i;

function isSummaryRow(row) {
  if (_summaryPattern.test(row.acct)) return true;
  if (_summaryPattern.test(row.dist)) return true;
  return false;
}

// ─── Depletion Transform ────────────────────────────────────────

function transformDepletion(rows, mapping) {
  const monthCols = mapping._monthColumns || [];
  const weekCols = mapping._weekColumns || [];
  const hasTimeSeries = monthCols.length > 0 || weekCols.length > 0;

  // Build per-row normalized data, filtering out summary/total rows
  const normalized = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")),
    dist: str(getMapped(r, mapping, "dist")),
    st: normalizeState(getMapped(r, mapping, "st")),
    ch: normalizeChannel(str(getMapped(r, mapping, "ch"))),
    sku: str(getMapped(r, mapping, "sku")),
    qty: num(getMapped(r, mapping, "qty")),
    date: normalizeDate(getMapped(r, mapping, "date")),
    revenue: num(getMapped(r, mapping, "revenue")),
    months: monthCols.map((c) => num(r[c])),
    weeks: weekCols.map((c) => num(r[c])),
  })).filter((r) => !isSummaryRow(r));

  // ── distScorecard: group by distributor+state ──
  const distGroups = groupBy(normalized, (r) => `${r.dist}||${r.st}`);
  const useMonthSums = monthCols.length > 0;
  const distScorecard = Object.entries(distGroups).map(([key, items]) => {
    const [name, st] = key.split("||");
    // When month columns exist, sum them for totalCE (more accurate than qty which
    // may point to just the first month in a pivot-period report).
    const totalCE = useMonthSums
      ? items.reduce((s, r) => s + r.months.reduce((ms, m) => ms + m, 0), 0)
      : items.reduce((s, r) => s + r.qty, 0);

    // Build weekly array from data
    let weekly = [];
    if (weekCols.length > 0) {
      weekly = Array.from({ length: Math.min(weekCols.length, 13) }, (_, i) =>
        items.reduce((s, r) => s + (r.weeks[i] || 0), 0)
      );
    } else if (monthCols.length > 0) {
      // Spread monthly across ~4 weeks each
      for (const m of items[0].months) {
        const perWeek = m / 4;
        weekly.push(perWeek, perWeek, perWeek, perWeek);
      }
      weekly = weekly.slice(0, 13);
    } else {
      weekly = Array(13).fill(Math.round(totalCE / 13));
    }

    const w4 = weekly.slice(-4).reduce((s, v) => s + v, 0);
    const firstHalf = weekly.slice(0, 6).reduce((s, v) => s + v, 0) || 1;
    const secondHalf = weekly.slice(7).reduce((s, v) => s + v, 0);
    const momPct = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
    const mean = totalCE / (weekly.length || 1);
    const variance = weekly.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (weekly.length || 1);
    const stdDev = Math.sqrt(variance);
    const con = mean > 0 ? Math.max(0, Math.min(1, 1 - stdDev / mean)) : 0;

    return {
      name: name || "Unknown",
      st: st || "--",
      ce: Math.round(totalCE),
      w4: Math.round(w4),
      momentum: `${momPct >= 0 ? "+" : ""}${momPct}%`,
      con: Math.round(con * 100) / 100,
      weekly: weekly.map(Math.round),
    };
  });

  // ── accountsTop: group by account ──
  const acctGroups = groupBy(normalized, (r) => `${r.acct}||${r.dist}||${r.st}`);
  const accountsTop = Object.entries(acctGroups)
    .map(([key, items], idx) => {
      const [acct, dist, st] = key.split("||");
      const totalCE = useMonthSums
        ? items.reduce((s, r) => s + r.months.reduce((ms, m) => ms + m, 0), 0)
        : items.reduce((s, r) => s + r.qty, 0);
      const ch = items[0]?.ch || "Off-Premise";

      // Monthly breakdown from month columns — positional (m0, m1, m2, ...)
      // Actual month names come from monthAxis metadata, not field names.
      const monthValues = {};
      if (monthCols.length > 0) {
        for (let mi = 0; mi < Math.min(monthCols.length, 12); mi++) {
          monthValues[`m${mi}`] = items.reduce((s, r) => s + (r.months[mi] || 0), 0);
        }
      } else {
        // No month columns — distribute total evenly across 4 slots
        const quarter = totalCE / 4;
        for (let mi = 0; mi < 4; mi++) {
          monthValues[`m${mi}`] = quarter;
        }
      }

      const total = Object.values(monthValues).reduce((s, v) => s + v, 0);
      const w4Items = items.slice(-Math.ceil(items.length / 3));
      const w4 = useMonthSums
        ? w4Items.reduce((s, r) => s + r.months.reduce((ms, m) => ms + m, 0), 0)
        : w4Items.reduce((s, r) => s + r.qty, 0);
      const mvKeys = Object.keys(monthValues);
      const halfIdx = Math.floor(mvKeys.length / 2);
      const earlyTotal = mvKeys.slice(0, halfIdx).reduce((s, k) => s + monthValues[k], 0) || 1;
      const lateTotal = mvKeys.slice(halfIdx).reduce((s, k) => s + monthValues[k], 0);
      const growth = ((lateTotal - earlyTotal) / earlyTotal) * 100;
      const trend = growth > 10 ? "Momentum" : growth < -10 ? "Growth Opportunity" : "Consistent";

      return {
        acct, dist, st, ch,
        ce: Math.round(totalCE),
        w4: Math.round(w4),
        ...Object.fromEntries(Object.entries(monthValues).map(([k, v]) => [k, Math.round(v)])),
        total: Math.round(total),
        trend,
        growthPotential: Math.max(0, Math.round(totalCE * 0.2)),
        rank: idx + 1,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  // ── newWins: accounts with very recent/small data ──
  const newWins = accountsTop
    .filter((a) => a.total > 0 && a.total < (accountsTop[0]?.total || 1) * 0.1)
    .slice(0, 10)
    .map((a) => ({
      acct: a.acct, dist: a.dist, st: a.st,
      ce: a.total, skus: 1,
    }));

  // ── reEngagementData & placementSummary from distributor grouping ──
  // Use groupBy for O(n) instead of O(n*d) repeated filter calls
  const distGroupsForSummary = groupBy(normalized, (r) => r.dist);
  const placementSummary = Object.entries(distGroupsForSummary).map(([name, items]) => {
    const accts = new Set(items.map((r) => r.acct));
    return {
      name,
      st: items[0]?.st || "--",
      net: accts.size,
      newA: Math.round(accts.size * 0.1),
      reEngageA: Math.round(accts.size * 0.05),
    };
  });

  const reEngagementData = Object.entries(distGroupsForSummary).map(([name, items]) => {
    return {
      name,
      st: items[0]?.st || "--",
      priorAccts: Math.round(new Set(items.map((r) => r.acct)).size * 0.15),
      priorCE: Math.round(items.reduce((s, r) => s + r.qty, 0) * 0.1),
    };
  });

  // ── skuBreakdown: aggregate by SKU across all data ──
  const skuGroups = groupBy(normalized, (r) => r.sku || "Unknown Product");
  const skuBreakdown = Object.entries(skuGroups)
    .map(([sku, items]) => {
      const ce = useMonthSums
        ? items.reduce((s, r) => s + r.months.reduce((ms, m) => ms + m, 0), 0)
        : items.reduce((s, r) => s + r.qty, 0);
      return { sku, ce: Math.round(ce) };
    })
    .filter((s) => s.ce > 0)
    .sort((a, b) => b.ce - a.ce)
    .slice(0, 25);

  // ── acctConcentration ──
  const ceValues = accountsTop.map((a) => a.total).sort((a, b) => b - a);
  const totalVol = ceValues.reduce((s, v) => s + v, 0);
  const top10Vol = ceValues.slice(0, 10).reduce((s, v) => s + v, 0);
  const acctConcentration = {
    total: accountsTop.length,
    top10: totalVol > 0 ? Math.round((top10Vol / totalVol) * 100) : 0,
    median: ceValues[Math.floor(ceValues.length / 2)] || 0,
    under1: ceValues.filter((v) => v < 1).length,
  };

  return {
    distScorecard,
    accountsTop,
    newWins,
    placementSummary,
    reEngagementData,
    acctConcentration,
    skuBreakdown,
  };
}

// ─── Purchase / Order History Transform ─────────────────────────

function transformPurchases(rows, mapping) {
  const normalized = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")),
    dist: str(getMapped(r, mapping, "dist")),
    st: normalizeState(getMapped(r, mapping, "st")),
    ch: normalizeChannel(str(getMapped(r, mapping, "ch"))),
    qty: num(getMapped(r, mapping, "qty")),
    date: normalizeDate(getMapped(r, mapping, "date")),
    sku: str(getMapped(r, mapping, "sku")),
  })).filter((r) => !isSummaryRow(r));

  const acctGroups = groupBy(normalized, (r) => `${r.acct}||${r.dist}||${r.st}`);
  const now = Date.now();

  const reorderData = Object.entries(acctGroups)
    .map(([key, items], idx) => {
      const [acct, dist, st] = key.split("||");
      const ch = items[0]?.ch || "Off-Premise";
      const totalCE = items.reduce((s, r) => s + r.qty, 0);
      const dates = items.map((r) => new Date(r.date).getTime()).filter((d) => !isNaN(d)).sort();
      const purch = dates.length;

      let cycle = 30;
      if (dates.length >= 2) {
        const span = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        cycle = Math.max(7, Math.round(span / (dates.length - 1)));
      }

      const lastDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();
      const days = Math.round((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const priority = Math.min(100, Math.round((days / Math.max(cycle, 1)) * 50));

      // SKU breakdown
      const skuGroups = groupBy(items, (r) => r.sku || "All Products");
      const skus = Object.entries(skuGroups).map(([w, skuItems]) => {
        const skuDates = skuItems.map((r) => new Date(r.date).getTime()).filter((d) => !isNaN(d)).sort();
        const skuLast = skuDates.length > 0 ? new Date(skuDates[skuDates.length - 1]) : new Date();
        return {
          w,
          ce: Math.round(skuItems.reduce((s, r) => s + r.qty, 0)),
          purch: skuDates.length,
          cycle,
          last: skuLast.toISOString().slice(0, 10),
          days: Math.round((now - skuLast.getTime()) / (1000 * 60 * 60 * 24)),
        };
      });

      return {
        rank: idx + 1,
        acct, dist, st, ch,
        ce: Math.round(totalCE),
        purch,
        cycle,
        last: lastDate.toISOString().slice(0, 10),
        days,
        priority,
        skus,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  return { reorderData };
}

// ─── Inventory Transform ────────────────────────────────────────

function transformInventory(rows, mapping) {
  const normalized = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")),
    st: normalizeState(getMapped(r, mapping, "st")),
    dist: str(getMapped(r, mapping, "dist")),
    oh: num(getMapped(r, mapping, "oh")),
    doh: num(getMapped(r, mapping, "doh")),
    sku: str(getMapped(r, mapping, "sku")),
  })).filter((r) => !isSummaryRow(r));

  // Group by distributor for inventoryData (table expects distributor-level rows)
  const invDistGroups = groupBy(normalized, (r) => r.dist || "Unknown");
  const inventoryData = Object.entries(invDistGroups).map(([dist, items]) => {
    const oh = items.reduce((s, r) => s + r.oh, 0);
    const doh = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.doh, 0) / items.length) : 0;
    const rate = doh > 0 ? oh / doh : 0;
    const dep90 = rate * 90;
    const proj = Math.max(0, dep90 - oh);
    const status = doh > 90 ? "Overstocked" : doh > 60 ? "Review Needed" : doh < 14 ? "Reorder Opportunity" : doh === 0 ? "Dead Stock" : "Healthy";
    // Pick most common state for the distributor
    const stCounts = {};
    items.forEach((r) => { if (r.st) stCounts[r.st] = (stCounts[r.st] || 0) + 1; });
    const st = Object.entries(stCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    // Build SKU breakdown
    const skuGroups = groupBy(items, (r) => r.sku || "All");
    const skus = Object.entries(skuGroups).map(([w, skuItems]) => {
      const skuOh = skuItems.reduce((s, r) => s + r.oh, 0);
      const skuDoh = skuItems.length > 0 ? Math.round(skuItems.reduce((s, r) => s + r.doh, 0) / skuItems.length) : 0;
      const skuRate = skuDoh > 0 ? skuOh / skuDoh : 0;
      const skuStatus = skuDoh > 90 ? "Overstocked" : skuDoh > 60 ? "Review Needed" : skuDoh < 14 ? "Reorder Opportunity" : skuDoh === 0 ? "Dead Stock" : "Healthy";
      return { w, oh: Math.round(skuOh), doh: skuDoh, rate: Math.round(skuRate * 100) / 100, status: skuStatus };
    });
    return {
      name: dist, st, oh: Math.round(oh), rate: Math.round(rate * 100) / 100,
      doh, dep90: Math.round(dep90), proj: Math.round(proj), status, skus,
    };
  });

  // Group by distributor for distHealth
  const distGroups = groupBy(normalized, (r) => r.dist);
  const distHealth = Object.entries(distGroups).map(([dist, items]) => {
    const totalOH = items.reduce((s, r) => s + r.oh, 0);
    const avgDOH = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.doh, 0) / items.length) : 0;
    const skuGroups = groupBy(items, (r) => r.sku || "All");
    const skus = Object.entries(skuGroups).map(([w, skuItems]) => {
      const oh = skuItems.reduce((s, r) => s + r.oh, 0);
      const doh = skuItems.length > 0 ? Math.round(skuItems.reduce((s, r) => s + r.doh, 0) / skuItems.length) : 0;
      const wkSupply = Math.round(doh / 7 * 10) / 10;
      return {
        w, sellIn: 0, sellThru: 0, ratio: 0, oh: Math.round(oh), doh,
        wkSupply,
        invAction: doh > 90 ? "Reduce" : doh < 14 ? "Reorder Now" : doh < 30 ? "Monitor" : "Healthy",
        ce: 0, days: 0, cycle: 0, purch: 0, last: "",
      };
    });

    return {
      dist: dist || "Unknown",
      totalSellIn: 0, totalSellThru: 0, totalRatio: 0,
      activeAccounts: 0, totalAccounts: 0, avgSkuBreadth: skus.length,
      established: 0, building: 0, emerging: 0, newAccts: 0, lostAccts: 0,
      nov: 0, dec: 0, jan: 0, feb: 0,
      doh: avgDOH, skus,
    };
  });

  return { inventoryData, distHealth };
}

// ─── Pipeline Transform ─────────────────────────────────────────

function transformPipeline(rows, mapping) {
  const pipelineAccounts = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")) || str(getMapped(r, mapping, "dist")) || "Unknown",
    stage: str(getMapped(r, mapping, "stage")) || "Identified",
    estValue: num(getMapped(r, mapping, "estValue")) || num(getMapped(r, mapping, "revenue")) || 0,
    owner: str(getMapped(r, mapping, "owner")) || "",
    state: normalizeState(getMapped(r, mapping, "st")),
    tier: "Regional",
    stageDate: normalizeDate(getMapped(r, mapping, "date")) || new Date().toISOString().slice(0, 10),
    source: "",
    type: "",
    channel: str(getMapped(r, mapping, "ch")) || "",
    nextStep: "",
    dueDate: "",
    notes: "",
  }));

  return { pipelineAccounts, pipelineMeta: {} };
}

// ─── QuickBooks Transform ───────────────────────────────────────

function transformQuickBooks(rows, mapping, qbFormat) {
  const headers = Object.keys(rows[0] || {});

  const findCol = (mappedField, patterns) => {
    if (mapping[mappedField]) return mapping[mappedField];
    return headers.find((h) =>
      patterns.some((p) => h.toLowerCase().includes(p))
    );
  };

  const nameCol = findCol("acct", ["customer full name", "customer", "name"]);
  const amountCol = findCol("revenue", ["amount", "total", "net amount", "ext price", "extended price", "sales price", "line total", "sales amount", "gross amount"]);
  const dateCol = findCol("date", ["transaction date", "date"]);
  const itemCol = findCol("sku", ["product/service", "item", "memo/description", "description"]);
  const qtyCol = findCol("qty", ["quantity"]);
  const channelCol = findCol("ch", ["customer type", "type"]);

  // Debit/Credit handling for QB Transaction Detail format
  const debitCol = !amountCol && headers.find((h) => h.toLowerCase().includes("debit"));
  const creditCol = !amountCol && headers.find((h) => h.toLowerCase().includes("credit"));
  const useDebitCredit = !amountCol && !!debitCol && !!creditCol;

  const getAmount = (r) => {
    if (useDebitCredit) return num(r[creditCol]) - num(r[debitCol]);
    return num(r[amountCol]);
  };

  // Filter out tax line items and non-product rows
  const isProductRow = (r) => {
    const item = str(r[itemCol]).toLowerCase();
    const qty = num(r[qtyCol]);
    if (item.includes("tax item") || item.includes("shipping") || item.includes("discount")) return false;
    if (qty === 0 && !item) return false;
    return true;
  };

  // Accounting line items that should not become products in the portfolio
  const _accountingPatterns = [
    "tax item", "sales tax", "shipping", "discount", "adjustment",
    "refund", "fee", "surcharge", "service charge", "finance charge",
    "crv", "deposit", "redemption", "collection", "credit memo",
    "payment", "write-off", "write off", "bad debt", "rounding",
    "freight", "handling", "delivery charge", "convenience fee",
    "processing fee", "restocking", "sales item",
  ];
  const _isAccountingItem = (name) => {
    const lower = name.toLowerCase();
    return _accountingPatterns.some(p => lower.includes(p));
  };

  const productRows = rows.filter(isProductRow);

  // Build account data from product rows
  const accountMap = {};

  for (const r of productRows) {
    const name = str(r[nameCol]) || str(r[headers[0]]) || str(r["Customer"]);
    if (!name || _summaryPattern.test(name)) continue;

    const amount = getAmount(r);
    const qty = num(r[qtyCol]);
    const date = normalizeDate(r[dateCol]);
    const channel = str(r[channelCol]);

    if (!accountMap[name]) {
      accountMap[name] = { revenue: 0, qty: 0, count: 0, lastDate: date, firstDate: date, channel, items: {} };
    }
    accountMap[name].revenue += amount;
    accountMap[name].qty += qty;
    accountMap[name].count += 1;
    if (date && date > accountMap[name].lastDate) accountMap[name].lastDate = date;
    if (date && date < accountMap[name].firstDate) accountMap[name].firstDate = date;
    if (!accountMap[name].channel && channel) accountMap[name].channel = channel;

    // Track per-item breakdown
    const itemName = str(r[itemCol]) || "Other";
    if (!accountMap[name].items[itemName]) {
      accountMap[name].items[itemName] = { qty: 0, revenue: 0 };
    }
    accountMap[name].items[itemName].qty += qty;
    accountMap[name].items[itemName].revenue += amount;
  }

  // Build synthetic revenue rows for revenue transform
  const syntheticRows = productRows.map(r => {
    const obj = {};
    obj['_amount'] = getAmount(r);
    obj[dateCol || 'Date'] = r[dateCol];
    obj[itemCol || 'Product'] = r[itemCol];
    obj[channelCol || 'Channel'] = r[channelCol];
    obj[nameCol || 'Customer'] = r[nameCol];
    obj['_sourceType'] = 'quickbooks';
    return obj;
  });

  const revMapping = {
    revenue: '_amount',
    date: dateCol || 'Date',
    sku: itemCol || 'Product',
    ch: channelCol || 'Channel',
    acct: nameCol || 'Customer',
    _sourceType: '_sourceType',
  };

  const revenueResult = transformRevenue(syntheticRows, revMapping);

  // Extract unique product names for portfolio auto-creation
  // Filter out QB accounting line items (adjustments, fees, CRV, etc.)
  const productNames = [...new Set(
    productRows
      .map(r => str(r[itemCol]))
      .filter(name => name && name.toLowerCase() !== 'other' && !_isAccountingItem(name))
  )];

  // Calculate date range for monthly distribution
  const allDates = Object.values(accountMap).flatMap((a) => [a.firstDate, a.lastDate]).filter(Boolean).sort();
  const dateSpanMonths = Math.max(1, allDates.length >= 2
    ? Math.ceil((new Date(allDates[allDates.length - 1]) - new Date(allDates[0])) / (1000 * 60 * 60 * 24 * 30))
    : 3);

  // Convert to accountsTop
  const accountsTop = Object.entries(accountMap)
    .map(([acct, data], idx) => {
      const perMonth = data.revenue / Math.max(dateSpanMonths, 1);

      return {
        acct,
        dist: "",
        st: "",
        ch: data.channel || "",
        ce: Math.round(data.qty),
        w4: Math.round(data.qty / Math.max(dateSpanMonths, 1)),
        nov: Math.round(perMonth),
        dec: Math.round(perMonth),
        jan: Math.round(perMonth),
        feb: Math.round(perMonth),
        total: Math.round(data.revenue),
        trend: data.count > 5 ? "Momentum" : data.count > 2 ? "Consistent" : "Growth Opportunity",
        growthPotential: Math.round(data.revenue * 0.15),
        rank: idx + 1,
      };
    })
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  // Build pipeline accounts
  const pipelineAccounts = Object.entries(accountMap)
    .filter(([, data]) => data.revenue > 0)
    .map(([acct, data]) => ({
      acct,
      stage: data.revenue > 5000 ? "Won" : data.revenue > 1000 ? "Negotiation" : "Identified",
      estValue: Math.round(data.revenue),
      owner: "",
      state: "",
      tier: data.revenue > 5000 ? "Tier 1" : data.revenue > 1000 ? "Tier 2" : "Tier 3",
      stageDate: data.lastDate || new Date().toISOString().slice(0, 10),
      source: "QuickBooks Import",
      type: "",
      channel: data.channel || "",
      nextStep: "",
      dueDate: "",
      notes: `${Object.keys(data.items).length} products, ${data.count} transactions`,
    }));

  // Build reorder data from purchase history
  const now = Date.now();
  const reorderData = Object.entries(accountMap)
    .filter(([, data]) => data.revenue > 0)
    .map(([acct, data], idx) => {
      const lastDate = new Date(data.lastDate);
      const firstDate = new Date(data.firstDate);
      const days = Math.round((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const spanDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const cycle = data.count > 1 ? Math.round(spanDays / (data.count - 1)) : 30;
      const priority = Math.min(100, Math.round((days / Math.max(cycle, 1)) * 50));

      return {
        rank: idx + 1,
        acct,
        dist: "",
        st: "",
        ch: data.channel || "",
        ce: Math.round(data.qty),
        purch: data.count,
        cycle,
        last: data.lastDate,
        days,
        priority,
        skus: Object.entries(data.items).map(([w, d]) => ({
          w, ce: Math.round(d.qty), purch: 1, cycle, last: data.lastDate, days,
        })),
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  // QB Orders
  const qbDistOrders = {};
  for (const [acct, data] of Object.entries(accountMap)) {
    if (data.revenue > 0) {
      qbDistOrders[acct] = { total: Math.round(data.revenue) };
    }
  }

  // Concentration
  const vals = accountsTop.map((a) => a.total).sort((a, b) => b - a);
  const totalVol = vals.reduce((s, v) => s + v, 0);
  const acctConcentration = {
    total: accountsTop.length,
    top10: totalVol > 0 ? Math.round((vals.slice(0, 10).reduce((s, v) => s + v, 0) / totalVol) * 100) : 0,
    median: vals[Math.floor(vals.length / 2)] || 0,
    under1: vals.filter((v) => v < 1).length,
  };

  return {
    accountsTop,
    pipelineAccounts,
    pipelineMeta: {},
    qbDistOrders,
    acctConcentration,
    reorderData,
    // Revenue views derived from QB data
    ...revenueResult,
    // Product names for portfolio auto-creation
    productNames,
  };
}

// ─── Executive Summary Generator ────────────────────────────────

function generateSummary(dataType, datasets, userRole) {
  if (userRole === undefined) userRole = "supplier";
  const parts = [];
  const isDistributor = userRole === "distributor";
  const entityName = isDistributor ? "supplier" : "distributor";
  const acctName = isDistributor ? "store" : "customer";
  const dataLabel = isDistributor ? "sell-through" : "depletion";

  if (dataType === "quickbooks") {
    const acctCount = datasets.accountsTop?.length || 0;
    const totalRev = datasets.accountsTop?.reduce((s, a) => s + a.total, 0) || 0;
    const topAcct = datasets.accountsTop?.[0]?.acct || "N/A";
    parts.push(`I've processed your QuickBooks data: ${acctCount} ${acctName}s with $${totalRev.toLocaleString()} in total revenue.`);
    parts.push(`Your top ${acctName} is "${topAcct}".`);
    parts.push(`Inventory and Reorder data is not available from QuickBooks — upload a ${entityName} ${dataLabel} report to unlock those tabs.`);
    if (datasets.revenueSummary?.ytdTotal) {
      parts.push(`Revenue data is ready — $${datasets.revenueSummary.ytdTotal.toLocaleString()} YTD across ${datasets.revenueSummary.channelCount || 1} channel(s).`);
    }
  } else if (dataType === "depletion") {
    const distCount = datasets.distScorecard?.length || 0;
    const acctCount = datasets.accountsTop?.length || 0;
    const totalCE = datasets.distScorecard?.reduce((s, d) => s + d.ce, 0) || 0;
    const momentumCount = datasets.distScorecard?.filter((d) => d.momentum && !d.momentum.startsWith("-") && d.momentum !== "+0%").length || 0;
    parts.push(`I've processed your ${dataLabel} data: ${distCount} ${entityName}s, ${acctCount} ${acctName}s, ${totalCE.toLocaleString()} total CE.`);
    parts.push(`${momentumCount} ${entityName}${momentumCount !== 1 ? "s" : ""} showing positive momentum.`);
    if (!datasets.reorderData?.length) {
      parts.push("Upload purchase history with dates to unlock Reorder Forecasting.");
    } else {
      parts.push("All core tabs are populated.");
    }
  } else if (dataType === "purchases") {
    const reorderCount = datasets.reorderData?.length || 0;
    const overdueCount = datasets.reorderData?.filter((r) => r.days > r.cycle * 1.5).length || 0;
    parts.push(`I've processed your order history: ${reorderCount} ${acctName}s tracked.`);
    parts.push(`${overdueCount} ${acctName}${overdueCount !== 1 ? "s" : ""} are overdue for reorder.`);
    parts.push(`Upload ${dataLabel} data to unlock ${isDistributor ? "Supplier" : "Distributor"} Scorecards and ${isDistributor ? "Store" : "Account"} Insights.`);
  } else if (dataType === "inventory") {
    const stateCount = datasets.inventoryData?.length || 0;
    const reorderOpps = datasets.inventoryData?.filter((i) => i.status === "Reorder Opportunity").length || 0;
    parts.push(`I've processed inventory data across ${stateCount} states.`);
    parts.push(`${reorderOpps} state${reorderOpps !== 1 ? "s" : ""} flagged as reorder opportunities.`);
    parts.push(`Upload ${dataLabel} data to see the full picture with ${entityName} health.`);
  } else if (dataType === "pipeline") {
    const dealCount = datasets.pipelineAccounts?.length || 0;
    const totalVal = datasets.pipelineAccounts?.reduce((s, p) => s + p.estValue, 0) || 0;
    parts.push(`I've imported ${dealCount} pipeline deals worth $${totalVal.toLocaleString()}.`);
    parts.push("Your pipeline is ready for tracking on the Customer Pipeline tab.");
    parts.push(`Upload ${dataLabel} data to connect pipeline insights with market performance.`);
  } else {
    parts.push("I've processed your data file.");
    parts.push("Some fields could not be automatically detected — check the column mapping.");
    parts.push("Upload additional data types to unlock more dashboard tabs.");
  }

  return parts.join(" ");
}

// ─── Master Transform ───────────────────────────────────────────

function transformAll(rows, mapping, uploadType, userRole) {
  if (userRole === undefined) userRole = "supplier";
  // uploadType can be a string or an object with .type
  const type = typeof uploadType === "object" ? uploadType.type : uploadType;
  const subtype = typeof uploadType === "object" ? uploadType.subtype : undefined;

  if (type === "quickbooks") {
    return { type: "quickbooks", ...transformQuickBooks(rows, mapping, subtype) };
  }
  if (type === "depletion" || type === "sales") {
    return { type: "depletion", ...transformDepletion(rows, mapping) };
  }
  if (type === "purchases") {
    return { type: "purchases", ...transformPurchases(rows, mapping) };
  }
  if (type === "inventory") {
    return { type: "inventory", ...transformInventory(rows, mapping) };
  }
  if (type === "pipeline") {
    return { type: "pipeline", ...transformPipeline(rows, mapping) };
  }

  if (type === "revenue") {
    return { type: "revenue", ...transformRevenue(rows, mapping) };
  }
  if (type === "ar_aging" || type === "ap_aging") {
    return { type, ...transformArAp(rows, mapping) };
  }

  // Fallback: try depletion if we have account + qty
  if (mapping.acct && mapping.qty) {
    return { type: "depletion", ...transformDepletion(rows, mapping) };
  }

  // Last resort: treat as pipeline
  return { type: "pipeline", ...transformPipeline(rows, mapping) };
}

module.exports = {
  transformDepletion,
  transformPurchases,
  transformInventory,
  transformPipeline,
  transformQuickBooks,
  generateSummary,
  transformAll,
};
