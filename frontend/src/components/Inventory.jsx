/**
 * Inventory tab component
 * Extracted from index.html renderInventory() (lines 4158-4391)
 * and HTML (lines 1371-1436).
 * Shows KPIs, warehouse panel, status/scatter charts, and detail table.
 */

import { useMemo } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import WarehousePanel from "./WarehousePanel";
import InventoryTable from "./InventoryTable";
import { getFilteredData } from "../utils/filterData";
import { t } from "../utils/terminology";

export default function Inventory({
  inventoryData = [],
  warehouseInventory = null,
  filters,
  user,
  onExport,
}) {
  const data = useMemo(
    () => getFilteredData(inventoryData, filters, user),
    [inventoryData, filters, user]
  );

  // --- KPIs ---
  const totalOH = data.reduce((sum, d) => sum + (d.oh || 0), 0);
  const avgDOH =
    data.length > 0
      ? (data.reduce((sum, d) => sum + (d.doh || 0), 0) / data.length).toFixed(0)
      : "0";
  const reorderCount = data.filter(
    (d) => d.status === "Reorder Opportunity"
  ).length;

  // --- Status doughnut chart ---
  const statusChartConfig = useMemo(() => {
    const counts = {
      Healthy: data.filter((d) => d.status === "Healthy").length,
      "Reorder Opportunity": data.filter((d) => d.status === "Reorder Opportunity").length,
      Overstocked: data.filter((d) => d.status === "Overstocked").length,
      "Dead Stock": data.filter((d) => d.status === "Dead Stock").length,
      "Review Needed": data.filter((d) => d.status === "Review Needed").length,
    };
    return {
      type: "doughnut",
      data: {
        labels: Object.keys(counts),
        datasets: [
          {
            data: Object.values(counts),
            backgroundColor: ["#0D9F6E", "#F8992D", "#2563EB", "#6B7280", "#2563EB"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    };
  }, [data]);

  // --- Scatter chart ---
  const scatterChartConfig = useMemo(() => {
    const points = data.map((d) => ({ x: d.oh || 0, y: d.doh || 0 }));
    return {
      type: "scatter",
      data: {
        datasets: [
          {
            label: t("distributor") + "s",
            data: points,
            backgroundColor: "#0F766E",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "On Hand" } },
          y: { title: { display: true, text: "Days on Hand" } },
        },
      },
    };
  }, [data]);

  // --- Empty state ---
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128230;</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          No Inventory Data
        </div>
        <div style={{ fontSize: 14 }}>
          Upload inventory data to see on-hand, days-on-hand, and reorder signals.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label="Total On Hand" value={totalOH.toFixed(1)} />
        <KpiCard label="Avg DOH" value={avgDOH} />
        <KpiCard label="Reorder Opportunities" value={reorderCount} />
        <KpiCard label={`${t("distributor")}s Reviewed`} value={data.length} />
      </div>

      {/* Warehouse Panel */}
      <WarehousePanel warehouseInventory={warehouseInventory} />

      {/* Charts Row */}
      <div className="charts-row">
        <ChartPanel
          title="Inventory Status Distribution"
          chartConfig={statusChartConfig}
        />
        <ChartPanel
          title="On Hand vs Days on Hand"
          chartConfig={scatterChartConfig}
        />
      </div>

      {/* Detail Table */}
      <InventoryTable data={data} onExport={onExport} />
    </div>
  );
}
