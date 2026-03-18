/**
 * Revenue & Sales Tab
 *
 * KPI cards, revenue by channel table (actual vs budget), revenue mix chart,
 * revenue by SKU chart, and inline budget editor.
 */

import { useState, useMemo, useCallback } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";

const CHART_COLORS = ["#6B1E1E", "#8B6A4C", "#F8992D", "#1F865A", "#B87333", "#C07B01"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(v) {
  if (v == null || isNaN(v)) return "$0";
  return "$" + Math.round(v).toLocaleString();
}

function pct(v) {
  if (v == null || isNaN(v)) return "0%";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

export default function RevenueSales({
  revenueByChannel = [],
  revenueByProduct = [],
  revenueSummary = {},
  budget = null,
  onUpdateBudget,
}) {
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const monthKeys = revenueSummary.monthKeys || [];
  const hasBudget = budget && budget.annualTotal > 0;

  // Compute total budget YTD
  const now = new Date();
  const currentMonth = now.getMonth();
  const budgetYtd = useMemo(() => {
    if (!budget?.channels) return 0;
    let total = 0;
    for (const monthValues of Object.values(budget.channels)) {
      if (Array.isArray(monthValues)) {
        for (let i = 0; i <= currentMonth; i++) {
          total += monthValues[i] || 0;
        }
      }
    }
    return total;
  }, [budget, currentMonth]);

  const ytd = revenueSummary.ytdTotal || 0;
  const annualBudget = budget?.annualTotal || 0;
  const varianceAmt = hasBudget ? ytd - budgetYtd : 0;
  const variancePct = budgetYtd > 0 ? ((ytd - budgetYtd) / budgetYtd) * 100 : 0;
  const pctOfAnnual = annualBudget > 0 ? (ytd / annualBudget) * 100 : 0;

  // --- Charts ---
  const channelMixConfig = useMemo(() => {
    if (revenueByChannel.length === 0) return null;
    return {
      type: "doughnut",
      data: {
        labels: revenueByChannel.map((c) => c.channel),
        datasets: [{
          data: revenueByChannel.map((c) => c.total),
          backgroundColor: CHART_COLORS.slice(0, revenueByChannel.length),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    };
  }, [revenueByChannel]);

  const skuBarConfig = useMemo(() => {
    const top10 = revenueByProduct.slice(0, 10);
    if (top10.length === 0) return null;
    return {
      type: "bar",
      data: {
        labels: top10.map((p) => p.sku.length > 20 ? p.sku.slice(0, 20) + "..." : p.sku),
        datasets: [{
          label: "Revenue",
          data: top10.map((p) => p.total),
          backgroundColor: "#6B1E1E",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: (v) => "$" + (v / 1000).toFixed(0) + "k" } } },
      },
    };
  }, [revenueByProduct]);

  const monthlyLineConfig = useMemo(() => {
    if (monthKeys.length === 0) return null;
    const labels = monthKeys.map((mk) => {
      const [, m] = mk.split("-");
      return MONTH_LABELS[parseInt(m, 10) - 1] || mk;
    });
    return {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Revenue",
          data: monthKeys.map((mk) => revenueSummary.monthlyTotals?.[mk] || 0),
          borderColor: "#6B1E1E",
          backgroundColor: "rgba(107, 30, 30, 0.1)",
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => "$" + (v / 1000).toFixed(0) + "k" } } },
      },
    };
  }, [monthKeys, revenueSummary]);

  // --- Budget Editor ---
  const openBudgetEditor = useCallback(() => {
    const currentYear = new Date().getFullYear();
    if (budget) {
      setBudgetDraft({ ...budget });
    } else {
      const emptyChannels = {};
      for (const ch of revenueByChannel.map((c) => c.channel).concat(["Distributors", "Website / DTC", "Direct to Trade - Off Premise", "Direct to Trade - On Premise"])) {
        if (!emptyChannels[ch]) emptyChannels[ch] = Array(12).fill(0);
      }
      setBudgetDraft({ annualTotal: 0, year: currentYear, channels: emptyChannels });
    }
    setShowBudgetEditor(true);
  }, [budget, revenueByChannel]);

  const handleAnnualChange = useCallback((val) => {
    const total = Math.max(0, parseFloat(val) || 0);
    setBudgetDraft((prev) => {
      const channels = { ...prev.channels };
      const channelKeys = Object.keys(channels);
      const perChannel = channelKeys.length > 0 ? total / channelKeys.length : 0;
      const perMonth = perChannel / 12;
      for (const ch of channelKeys) {
        channels[ch] = Array(12).fill(Math.round(perMonth * 100) / 100);
      }
      return { ...prev, annualTotal: total, channels };
    });
  }, []);

  const handleCellChange = useCallback((channel, monthIdx, val) => {
    const amount = Math.max(0, parseFloat(val) || 0);
    setBudgetDraft((prev) => {
      const channels = { ...prev.channels };
      channels[channel] = [...(channels[channel] || Array(12).fill(0))];
      channels[channel][monthIdx] = amount;
      // Recompute annual total
      let total = 0;
      for (const monthVals of Object.values(channels)) {
        total += monthVals.reduce((s, v) => s + v, 0);
      }
      return { ...prev, channels, annualTotal: Math.round(total * 100) / 100 };
    });
  }, []);

  const saveBudget = useCallback(async () => {
    if (!onUpdateBudget || !budgetDraft) return;
    setSaving(true);
    try {
      await onUpdateBudget(budgetDraft);
      setShowBudgetEditor(false);
    } catch (err) {
      console.error("Failed to save budget:", err);
    } finally {
      setSaving(false);
    }
  }, [onUpdateBudget, budgetDraft]);

  return (
    <div className="revenue-sales">
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label="YTD Revenue" value={fmt(ytd)} />
        {hasBudget && <KpiCard label="YTD Budget" value={fmt(budgetYtd)} />}
        {hasBudget && (
          <KpiCard
            label="YTD vs Budget"
            value={pct(variancePct)}
            subtext={`${varianceAmt >= 0 ? "+" : ""}${fmt(varianceAmt)} variance`}
          />
        )}
        {hasBudget && <KpiCard label="% of Annual Budget" value={pctOfAnnual.toFixed(1) + "%"} />}
        {!hasBudget && (
          <KpiCard label="Annual Run Rate" value={fmt(revenueSummary.annualRunRate)} />
        )}
        <KpiCard label="Top Channel" value={revenueSummary.topChannel || "--"} />
      </div>

      {/* Budget CTA / Gear */}
      <div className="revenue-sales__toolbar">
        <button
          className="btn btn-secondary btn-sm"
          onClick={openBudgetEditor}
        >
          {hasBudget ? "Edit Budget" : "Set Budget"}
        </button>
      </div>

      {/* Revenue by Channel Table */}
      <div className="revenue-sales__section">
        <h3 className="revenue-sales__section-title">Revenue by Channel</h3>
        <div className="revenue-sales__table-wrap">
          <table className="revenue-sales__table">
            <thead>
              <tr>
                <th>Channel</th>
                {monthKeys.map((mk) => {
                  const [, m] = mk.split("-");
                  return <th key={mk}>{MONTH_LABELS[parseInt(m, 10) - 1]}</th>;
                })}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {revenueByChannel.map((ch) => (
                <tr key={ch.channel}>
                  <td className="revenue-sales__channel-name">{ch.channel}</td>
                  {monthKeys.map((mk) => (
                    <td key={mk} className="revenue-sales__cell-number">
                      {fmt(ch.months[mk])}
                    </td>
                  ))}
                  <td className="revenue-sales__cell-number revenue-sales__cell-total">
                    {fmt(ch.total)}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="revenue-sales__totals-row">
                <td><strong>Total</strong></td>
                {monthKeys.map((mk) => (
                  <td key={mk} className="revenue-sales__cell-number">
                    <strong>{fmt(revenueSummary.monthlyTotals?.[mk])}</strong>
                  </td>
                ))}
                <td className="revenue-sales__cell-number revenue-sales__cell-total">
                  <strong>{fmt(ytd)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {channelMixConfig && (
          <ChartPanel title="Revenue Mix by Channel" chartConfig={channelMixConfig} />
        )}
        {monthlyLineConfig && (
          <ChartPanel title="Monthly Revenue Trend" chartConfig={monthlyLineConfig} />
        )}
      </div>

      {/* SKU Breakdown */}
      {skuBarConfig && (
        <div className="revenue-sales__section">
          <h3 className="revenue-sales__section-title">Revenue by Product</h3>
          <ChartPanel title="" chartConfig={skuBarConfig} />
        </div>
      )}

      {/* Budget Editor Modal */}
      {showBudgetEditor && budgetDraft && (
        <div className="modal-overlay" onClick={() => setShowBudgetEditor(false)}>
          <div className="modal-content revenue-sales__budget-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Budget Editor — {budgetDraft.year || new Date().getFullYear()}</h3>
              <button className="modal-close" onClick={() => setShowBudgetEditor(false)}>&times;</button>
            </div>
            <div className="revenue-sales__budget-body">
              <div className="revenue-sales__budget-annual">
                <label>Annual Total Budget</label>
                <input
                  type="number"
                  min="0"
                  value={budgetDraft.annualTotal || ""}
                  onChange={(e) => handleAnnualChange(e.target.value)}
                  placeholder="e.g. 2850000"
                  className="revenue-sales__budget-input"
                />
                <span className="revenue-sales__budget-hint">
                  Set a total — it auto-spreads evenly. Fine-tune below.
                </span>
              </div>
              <div className="revenue-sales__budget-grid-wrap">
                <table className="revenue-sales__budget-grid">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      {MONTH_LABELS.map((m) => <th key={m}>{m}</th>)}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(budgetDraft.channels || {}).map(([ch, months]) => (
                      <tr key={ch}>
                        <td className="revenue-sales__channel-name">{ch}</td>
                        {(months || []).map((val, i) => (
                          <td key={i}>
                            <input
                              type="number"
                              min="0"
                              value={val || ""}
                              onChange={(e) => handleCellChange(ch, i, e.target.value)}
                              className="revenue-sales__budget-cell"
                            />
                          </td>
                        ))}
                        <td className="revenue-sales__cell-number">
                          {fmt((months || []).reduce((s, v) => s + v, 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBudgetEditor(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBudget} disabled={saving}>
                {saving ? "Saving..." : "Save Budget"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
