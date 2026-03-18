/**
 * Depletions tab component
 * Extracted from index.html renderDepletions() (lines 3811-3949)
 * and the Depletions HTML (lines 1201-1264).
 * Shows KPIs, weekly CE chart, SKU mix chart, and distributor scorecard table.
 */

import { useMemo } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import ScorecardTable from "./ScorecardTable";
import { getFilteredData } from "../utils/filterData";
import { t } from "../utils/terminology";
import TENANT_CONFIG from "../config/tenant";

const CHART_COLORS = ["#6B1E1E", "#8B6A4C", "#F8992D", "#1F865A", "#B87333", "#C07B01"];

export default function Depletions({
  distScorecard = [],
  filters,
  user,
  onDrillIn,
  onExport,
}) {
  // Apply global filters
  const data = useMemo(
    () => getFilteredData(distScorecard, filters, user),
    [distScorecard, filters, user]
  );

  // --- KPIs ---
  const totalCE = data.reduce((sum, d) => sum + (d.ce || 0), 0);
  const total4W = data.reduce((sum, d) => sum + (d.w4 || 0), 0);
  const momentumCount = data.filter(
    (d) => d.momentum && String(d.momentum).startsWith("+")
  ).length;
  const avgConsistency =
    data.length > 0
      ? (
          (data.reduce((sum, d) => sum + (d.con || 0), 0) / data.length) *
          100
        ).toFixed(0)
      : "0";

  // --- Weekly CE stacked bar chart config ---
  const weeklyCEConfig = useMemo(() => {
    const topDists = [...data].sort((a, b) => (b.ce || 0) - (a.ce || 0)).slice(0, 6);
    const weeks = Array.from({ length: 13 }, (_, i) => `W${i + 1}`);
    const datasets = topDists.map((d, idx) => ({
      label: (d.name || "").substring(0, 15),
      data: d.weekly || [],
      backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
      stack: "stack",
    }));

    return {
      type: "bar",
      data: { labels: weeks, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { x: { stacked: true }, y: { stacked: true } },
      },
    };
  }, [data]);

  // --- SKU mix doughnut chart config ---
  const skuMixConfig = useMemo(() => {
    const catalog = (TENANT_CONFIG.productCatalog || []).filter(
      (p) => p.status !== "Discontinued"
    );
    const skus =
      catalog.length > 0
        ? catalog.map((p) => p.name || p.sku)
        : ["No products configured"];
    const distribution =
      catalog.length > 0
        ? catalog.map(() => Math.round(100 / catalog.length))
        : [100];

    return {
      type: "doughnut",
      data: {
        labels: skus,
        datasets: [
          {
            data: distribution,
            backgroundColor: CHART_COLORS.slice(0, skus.length),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    };
  }, []);

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard
          label={`Total ${t("longPeriod")} ${t("volume")}`}
          value={totalCE.toFixed(0)}
        />
        <KpiCard
          label={`${t("shortPeriod")} ${t("volume")}`}
          value={total4W.toFixed(0)}
        />
        <KpiCard label="Markets w/ Momentum" value={momentumCount} />
        <KpiCard label="Consistency Score" value={`${avgConsistency}%`} />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <ChartPanel
          title={`Weekly ${t("volume")} by Top ${t("distributor")}s`}
          chartConfig={weeklyCEConfig}
        />
        <ChartPanel title="SKU Mix" chartConfig={skuMixConfig} />
      </div>

      {/* Distributor Scorecard Table */}
      <ScorecardTable
        data={data}
        onDrillIn={onDrillIn}
        onExport={onExport}
      />
    </div>
  );
}
