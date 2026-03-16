/**
 * Billback Transform — converts normalized billback rows into spend dashboards.
 *
 * Produces: spendByWine, spendByDistributor, billbackSummary
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

function normalizeDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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

// ─── Billback Transform ─────────────────────────────────────────

function transformBillback(rows, mapping) {
  // Normalize rows
  const normalized = rows
    .map((r) => ({
      wine: str(getMapped(r, mapping, "wine")),
      producer: str(getMapped(r, mapping, "producer")),
      dist: str(getMapped(r, mapping, "dist")),
      amount: num(getMapped(r, mapping, "amount")),
      qty: num(getMapped(r, mapping, "qty")),
      date: normalizeDate(getMapped(r, mapping, "date")),
      type: str(getMapped(r, mapping, "type")) || "other",
      invoiceNo: str(getMapped(r, mapping, "invoiceNo")),
    }))
    .filter((r) => r.wine); // Skip rows with no wine name

  // ── spendByWine: group by wine name ──
  const wineGroups = groupBy(normalized, (r) => r.wine);
  const spendByWine = Object.entries(wineGroups)
    .map(([wine, items]) => {
      const totalSpend = items.reduce((s, r) => s + r.amount, 0);
      const totalQty = items.reduce((s, r) => s + r.qty, 0);

      // Most common producer
      const producerCounts = {};
      for (const item of items) {
        if (item.producer) {
          producerCounts[item.producer] = (producerCounts[item.producer] || 0) + 1;
        }
      }
      const producer = Object.entries(producerCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      const dates = items.map((r) => r.date).filter(Boolean).sort();

      return {
        wine,
        producer,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalQty: Math.round(totalQty * 100) / 100,
        spendPerCase: totalQty > 0 ? Math.round((totalSpend / totalQty) * 100) / 100 : 0,
        billbackCount: items.length,
        distributors: [...new Set(items.map((r) => r.dist).filter(Boolean))],
        types: [...new Set(items.map((r) => r.type).filter(Boolean))],
        lastDate: dates[dates.length - 1] || "",
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  // ── spendByDistributor: group by distributor ──
  const distGroups = groupBy(normalized, (r) => r.dist || "Unknown");
  const spendByDistributor = Object.entries(distGroups)
    .map(([dist, items]) => {
      const totalSpend = items.reduce((s, r) => s + r.amount, 0);
      const totalQty = items.reduce((s, r) => s + r.qty, 0);
      const dates = items.map((r) => r.date).filter(Boolean).sort();
      const allWines = [...new Set(items.map((r) => r.wine).filter(Boolean))];

      return {
        dist,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalQty: Math.round(totalQty * 100) / 100,
        spendPerCase: totalQty > 0 ? Math.round((totalSpend / totalQty) * 100) / 100 : 0,
        billbackCount: items.length,
        wines: allWines.slice(0, 10),
        types: [...new Set(items.map((r) => r.type).filter(Boolean))],
        lastDate: dates[dates.length - 1] || "",
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  // ── billbackSummary: aggregate KPIs ──
  const totalSpend = normalized.reduce((s, r) => s + r.amount, 0);
  const totalQty = normalized.reduce((s, r) => s + r.qty, 0);
  const allDates = normalized.map((r) => r.date).filter(Boolean).sort();

  const byType = {};
  for (const r of normalized) {
    byType[r.type] = (byType[r.type] || 0) + r.amount;
  }
  // Round byType values
  for (const key of Object.keys(byType)) {
    byType[key] = Math.round(byType[key] * 100) / 100;
  }

  const billbackSummary = {
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalBillbacks: normalized.length,
    totalWines: new Set(normalized.map((r) => r.wine)).size,
    totalDistributors: new Set(normalized.map((r) => r.dist).filter(Boolean)).size,
    avgSpendPerCase: totalQty > 0 ? Math.round((totalSpend / totalQty) * 100) / 100 : 0,
    byType,
    dateRange: {
      earliest: allDates[0] || "",
      latest: allDates[allDates.length - 1] || "",
    },
  };

  return { spendByWine, spendByDistributor, billbackSummary };
}

module.exports = { transformBillback };
