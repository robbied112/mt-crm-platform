/**
 * Transform Layer
 *
 * Converts raw mapped rows into all internal dashboard data structures.
 * Handles depletion, purchase/sales, inventory, pipeline, and QuickBooks data.
 */

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

// ─── Depletion Transform ────────────────────────────────────────

export function transformDepletion(rows, mapping) {
  const monthCols = mapping._monthColumns || [];
  const weekCols = mapping._weekColumns || [];
  const hasTimeSeries = monthCols.length > 0 || weekCols.length > 0;

  // Build per-row normalized data
  const normalized = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")),
    dist: str(getMapped(r, mapping, "dist")),
    st: normalizeState(getMapped(r, mapping, "st")),
    ch: str(getMapped(r, mapping, "ch")) || "Off-Premise",
    sku: str(getMapped(r, mapping, "sku")),
    qty: num(getMapped(r, mapping, "qty")),
    date: normalizeDate(getMapped(r, mapping, "date")),
    revenue: num(getMapped(r, mapping, "revenue")),
    months: monthCols.map((c) => num(r[c])),
    weeks: weekCols.map((c) => num(r[c])),
  }));

  // ── distScorecard: group by distributor+state ──
  const distGroups = groupBy(normalized, (r) => `${r.dist}||${r.st}`);
  const distScorecard = Object.entries(distGroups).map(([key, items]) => {
    const [name, st] = key.split("||");
    const totalCE = items.reduce((s, r) => s + r.qty, 0);

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
      const totalCE = items.reduce((s, r) => s + r.qty, 0);
      const ch = items[0]?.ch || "Off-Premise";

      // Monthly breakdown from month columns if available
      let nov = 0, dec = 0, jan = 0, feb = 0;
      if (monthCols.length >= 4) {
        nov = items.reduce((s, r) => s + (r.months[0] || 0), 0);
        dec = items.reduce((s, r) => s + (r.months[1] || 0), 0);
        jan = items.reduce((s, r) => s + (r.months[2] || 0), 0);
        feb = items.reduce((s, r) => s + (r.months[3] || 0), 0);
      } else {
        const quarter = totalCE / 4;
        nov = quarter; dec = quarter; jan = quarter; feb = quarter;
      }

      const total = nov + dec + jan + feb;
      const w4Items = items.slice(-Math.ceil(items.length / 3));
      const w4 = w4Items.reduce((s, r) => s + r.qty, 0);
      const earlyTotal = nov + dec || 1;
      const lateTotal = jan + feb;
      const growth = ((lateTotal - earlyTotal) / earlyTotal) * 100;
      const trend = growth > 10 ? "Momentum" : growth < -10 ? "Growth Opportunity" : "Consistent";

      return {
        acct, dist, st, ch,
        ce: Math.round(totalCE),
        w4: Math.round(w4),
        nov: Math.round(nov), dec: Math.round(dec),
        jan: Math.round(jan), feb: Math.round(feb),
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
  };
}

// ─── Purchase / Order History Transform ─────────────────────────

export function transformPurchases(rows, mapping) {
  const normalized = rows.map((r) => ({
    acct: str(getMapped(r, mapping, "acct")),
    dist: str(getMapped(r, mapping, "dist")),
    st: normalizeState(getMapped(r, mapping, "st")),
    ch: str(getMapped(r, mapping, "ch")) || "Off-Premise",
    qty: num(getMapped(r, mapping, "qty")),
    date: normalizeDate(getMapped(r, mapping, "date")),
    sku: str(getMapped(r, mapping, "sku")),
  }));

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

export function transformInventory(rows, mapping) {
  const normalized = rows.map((r) => ({
    st: normalizeState(getMapped(r, mapping, "st")),
    dist: str(getMapped(r, mapping, "dist")),
    oh: num(getMapped(r, mapping, "oh")),
    doh: num(getMapped(r, mapping, "doh")),
    sku: str(getMapped(r, mapping, "sku")),
  }));

  // Group by state for inventoryData
  const stateGroups = groupBy(normalized, (r) => r.st);
  const inventoryData = Object.entries(stateGroups).map(([st, items]) => {
    const oh = items.reduce((s, r) => s + r.oh, 0);
    const doh = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.doh, 0) / items.length) : 0;
    const status = doh > 90 ? "Overstocked" : doh > 60 ? "Review Needed" : doh < 14 ? "Reorder Opportunity" : doh === 0 ? "Dead Stock" : "Healthy";
    return { st, oh: Math.round(oh), doh, status };
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

export function transformPipeline(rows, mapping) {
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

export function transformQuickBooks(rows, mapping, qbFormat) {
  const headers = Object.keys(rows[0] || {});

  // Find columns using the mapping first, then fallback to header search
  const findCol = (mappedField, patterns) => {
    if (mapping[mappedField]) return mapping[mappedField];
    return headers.find((h) =>
      patterns.some((p) => h.toLowerCase().includes(p))
    );
  };

  const nameCol = findCol("acct", ["customer full name", "customer", "name"]);
  const amountCol = findCol("revenue", ["amount"]);
  const dateCol = findCol("date", ["transaction date", "date"]);
  const itemCol = findCol("sku", ["product/service", "item", "memo/description", "description"]);
  const qtyCol = findCol("qty", ["quantity"]);
  const channelCol = findCol("ch", ["customer type", "type"]);
  const salesPriceCol = headers.find((h) => h.toLowerCase().includes("sales price"));

  // Filter out tax line items and non-product rows
  const isProductRow = (r) => {
    const item = str(r[itemCol]).toLowerCase();
    const qty = num(r[qtyCol]);
    // Skip tax items, shipping, and rows with no quantity
    if (item.includes("tax item") || item.includes("shipping") || item.includes("discount")) return false;
    if (qty === 0 && !item) return false;
    return true;
  };

  const productRows = rows.filter(isProductRow);

  // Build account data from product rows
  const accountMap = {};

  for (const r of productRows) {
    // Use mapped customer column, or the first column (which parseFile labels "Customer")
    const name = str(r[nameCol]) || str(r[headers[0]]) || str(r["Customer"]);
    if (!name || name.toLowerCase() === "total") continue;

    const amount = num(r[amountCol]);
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

  // Calculate date range for monthly distribution
  const allDates = Object.values(accountMap).flatMap((a) => [a.firstDate, a.lastDate]).filter(Boolean).sort();
  const dateSpanMonths = Math.max(1, allDates.length >= 2
    ? Math.ceil((new Date(allDates[allDates.length - 1]) - new Date(allDates[0])) / (1000 * 60 * 60 * 24 * 30))
    : 3);

  // Convert to accountsTop
  const accountsTop = Object.entries(accountMap)
    .map(([acct, data], idx) => {
      const monthlyAvg = data.revenue / dateSpanMonths;
      const skuCount = Object.keys(data.items).length;
      // Distribute revenue across months proportionally
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
  };
}

// ─── Executive Summary Generator ────────────────────────────────

export function generateSummary(dataType, datasets, userRole = "supplier") {
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

export function transformAll(rows, mapping, uploadType, userRole = "supplier") {
  if (uploadType.type === "quickbooks") {
    return { type: "quickbooks", ...transformQuickBooks(rows, mapping, uploadType.subtype) };
  }
  if (uploadType.type === "depletion" || uploadType.type === "sales") {
    return { type: "depletion", ...transformDepletion(rows, mapping) };
  }
  if (uploadType.type === "purchases") {
    return { type: "purchases", ...transformPurchases(rows, mapping) };
  }
  if (uploadType.type === "inventory") {
    return { type: "inventory", ...transformInventory(rows, mapping) };
  }
  if (uploadType.type === "pipeline") {
    return { type: "pipeline", ...transformPipeline(rows, mapping) };
  }

  // Fallback: try depletion if we have account + qty
  if (mapping.acct && mapping.qty) {
    return { type: "depletion", ...transformDepletion(rows, mapping) };
  }

  // Last resort: treat as pipeline
  return { type: "pipeline", ...transformPipeline(rows, mapping) };
}
