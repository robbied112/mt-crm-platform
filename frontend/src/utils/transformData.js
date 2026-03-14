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
  const distNames = [...new Set(normalized.map((r) => r.dist))];
  const placementSummary = distNames.map((name) => {
    const items = normalized.filter((r) => r.dist === name);
    const accts = new Set(items.map((r) => r.acct));
    return {
      name,
      st: items[0]?.st || "--",
      net: accts.size,
      newA: Math.round(accts.size * 0.1),
      reEngageA: Math.round(accts.size * 0.05),
    };
  });

  const reEngagementData = distNames.map((name) => {
    const items = normalized.filter((r) => r.dist === name);
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
  const lowerHeaders = Object.keys(rows[0] || {});

  // Find QB-specific columns by header content
  const findCol = (patterns) => {
    return lowerHeaders.find((h) =>
      patterns.some((p) => h.toLowerCase().includes(p))
    );
  };

  const nameCol = findCol(["name", "customer"]);
  const amountCol = findCol(["amount", "debit", "total"]);
  const dateCol = findCol(["date", "txn date"]);
  const itemCol = findCol(["item", "product", "description", "memo"]);
  const qtyCol = findCol(["qty", "quantity"]);
  const balanceCol = findCol(["balance"]);

  // Build pipeline accounts from QB customer data
  const pipelineAccounts = [];
  const accountMap = {};

  for (const r of rows) {
    const name = str(r[nameCol]);
    if (!name || name.toLowerCase() === "total") continue;

    const amount = num(r[amountCol]);
    const date = normalizeDate(r[dateCol]);

    if (!accountMap[name]) {
      accountMap[name] = { total: 0, count: 0, lastDate: date, items: [] };
    }
    accountMap[name].total += amount;
    accountMap[name].count += 1;
    if (date > accountMap[name].lastDate) accountMap[name].lastDate = date;
    if (itemCol && r[itemCol]) {
      accountMap[name].items.push({
        item: str(r[itemCol]),
        qty: num(r[qtyCol]),
        amount,
      });
    }
  }

  // Convert to pipeline + accountsTop
  const accountsTop = Object.entries(accountMap)
    .map(([acct, data], idx) => ({
      acct,
      dist: "",
      st: "",
      ch: "",
      ce: data.count,
      w4: Math.round(data.count / 3),
      nov: Math.round(data.total * 0.25),
      dec: Math.round(data.total * 0.25),
      jan: Math.round(data.total * 0.25),
      feb: Math.round(data.total * 0.25),
      total: Math.round(data.total),
      trend: data.total > 1000 ? "Momentum" : "Consistent",
      growthPotential: Math.round(data.total * 0.15),
      rank: idx + 1,
    }))
    .sort((a, b) => b.total - a.total)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  for (const [acct, data] of Object.entries(accountMap)) {
    pipelineAccounts.push({
      acct,
      stage: data.total > 5000 ? "Won" : data.total > 1000 ? "Negotiation" : "Identified",
      estValue: Math.round(data.total),
      owner: "",
      state: "",
      tier: data.total > 5000 ? "Tier 1" : data.total > 1000 ? "Tier 2" : "Tier 3",
      stageDate: data.lastDate || new Date().toISOString().slice(0, 10),
      source: "QuickBooks Import",
      type: "", channel: "", nextStep: "", dueDate: "", notes: "",
    });
  }

  // QB Orders → qbDistOrders
  const qbDistOrders = {};
  for (const [acct, data] of Object.entries(accountMap)) {
    qbDistOrders[acct] = { total: Math.round(data.total) };
  }

  const acctConcentration = {
    total: accountsTop.length,
    top10: 0,
    median: 0,
    under1: 0,
  };
  const vals = accountsTop.map((a) => a.total).sort((a, b) => b - a);
  const totalVol = vals.reduce((s, v) => s + v, 0);
  if (vals.length > 0) {
    acctConcentration.top10 = totalVol > 0 ? Math.round((vals.slice(0, 10).reduce((s, v) => s + v, 0) / totalVol) * 100) : 0;
    acctConcentration.median = vals[Math.floor(vals.length / 2)] || 0;
    acctConcentration.under1 = vals.filter((v) => v < 1).length;
  }

  return {
    accountsTop,
    pipelineAccounts,
    pipelineMeta: {},
    qbDistOrders,
    acctConcentration,
  };
}

// ─── Executive Summary Generator ────────────────────────────────

export function generateSummary(dataType, datasets) {
  const parts = [];

  if (dataType === "quickbooks") {
    const acctCount = datasets.accountsTop?.length || 0;
    const totalRev = datasets.accountsTop?.reduce((s, a) => s + a.total, 0) || 0;
    const topAcct = datasets.accountsTop?.[0]?.acct || "N/A";
    parts.push(`I've processed your QuickBooks data: ${acctCount} customers with $${totalRev.toLocaleString()} in total revenue.`);
    parts.push(`Your top account is "${topAcct}".`);
    parts.push("Inventory and Reorder data is not available from QuickBooks — upload a distributor depletion report to unlock those tabs.");
  } else if (dataType === "depletion") {
    const distCount = datasets.distScorecard?.length || 0;
    const acctCount = datasets.accountsTop?.length || 0;
    const totalCE = datasets.distScorecard?.reduce((s, d) => s + d.ce, 0) || 0;
    const momentumDists = datasets.distScorecard?.filter((d) => d.momentum && !d.momentum.startsWith("-") && d.momentum !== "+0%").length || 0;
    parts.push(`I've processed your depletion data: ${distCount} distributors, ${acctCount} accounts, ${totalCE.toLocaleString()} total CE.`);
    parts.push(`${momentumDists} distributor${momentumDists !== 1 ? "s" : ""} showing positive momentum.`);
    if (!datasets.reorderData?.length) {
      parts.push("Upload purchase history with dates to unlock Reorder Forecasting.");
    } else {
      parts.push("All core tabs are populated.");
    }
  } else if (dataType === "purchases") {
    const reorderCount = datasets.reorderData?.length || 0;
    const overdueCount = datasets.reorderData?.filter((r) => r.days > r.cycle * 1.5).length || 0;
    parts.push(`I've processed your order history: ${reorderCount} accounts tracked.`);
    parts.push(`${overdueCount} account${overdueCount !== 1 ? "s" : ""} are overdue for reorder.`);
    parts.push("Upload depletion data to unlock Distributor Scorecards and Account Insights.");
  } else if (dataType === "inventory") {
    const stateCount = datasets.inventoryData?.length || 0;
    const reorderOpps = datasets.inventoryData?.filter((i) => i.status === "Reorder Opportunity").length || 0;
    parts.push(`I've processed inventory data across ${stateCount} states.`);
    parts.push(`${reorderOpps} state${reorderOpps !== 1 ? "s" : ""} flagged as reorder opportunities.`);
    parts.push("Upload depletion data to see the full picture with distributor health.");
  } else if (dataType === "pipeline") {
    const dealCount = datasets.pipelineAccounts?.length || 0;
    const totalVal = datasets.pipelineAccounts?.reduce((s, p) => s + p.estValue, 0) || 0;
    parts.push(`I've imported ${dealCount} pipeline deals worth $${totalVal.toLocaleString()}.`);
    parts.push("Your pipeline is ready for tracking on the Customer Pipeline tab.");
    parts.push("Upload depletion data to connect pipeline insights with market performance.");
  } else {
    parts.push("I've processed your data file.");
    parts.push("Some fields could not be automatically detected — check the column mapping.");
    parts.push("Upload additional data types to unlock more dashboard tabs.");
  }

  return parts.join(" ");
}

// ─── Master Transform ───────────────────────────────────────────

export function transformAll(rows, mapping, uploadType) {
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
