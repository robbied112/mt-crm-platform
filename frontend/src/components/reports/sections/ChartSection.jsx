/**
 * ChartSection — renders a Chart.js chart from blueprint spec.
 * Translates blueprint chart definitions into Chart.js config objects
 * and wraps the existing ChartPanel component.
 */
import { useMemo } from "react";
import { useBlueprint } from "../../../context/BlueprintContext";
import ChartPanel from "../../ChartPanel";

const CHART_COLORS = [
  "#6B1E1E", "#8B6A4C", "#F8992D", "#1F865A", "#B87333",
  "#C07B01", "#4A6FA5", "#9B2335", "#5B8C5A", "#D4A574",
  "#2E4057", "#7A4988", "#CC6633", "#3D8B37", "#8B4513",
];

function buildChartConfig(section, data) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const xField = section.xAxis?.field;
  const yField = section.yAxis?.field;
  if (!xField || !yField) return null;

  const labels = data.map((d) => String(d[xField] || ""));
  const values = data.map((d) => {
    const v = d[yField];
    return typeof v === "number" ? v : parseFloat(v) || 0;
  });

  const chartType = section.chartType || "bar";

  if (chartType === "doughnut") {
    return {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 } } },
        },
      },
    };
  }

  return {
    type: chartType,
    data: {
      labels,
      datasets: [{
        label: section.yAxis?.label || yField,
        data: values,
        backgroundColor: chartType === "line" ? "transparent" : CHART_COLORS[0] + "CC",
        borderColor: CHART_COLORS[0],
        borderWidth: chartType === "line" ? 2 : 1,
        tension: chartType === "line" ? 0.3 : undefined,
        fill: chartType === "area",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: !!section.xAxis?.label, text: section.xAxis?.label },
          ticks: { maxRotation: 45, font: { size: 10 } },
        },
        y: {
          title: { display: !!section.yAxis?.label, text: section.yAxis?.label },
          beginAtZero: true,
        },
      },
    },
  };
}

export default function ChartSection({ section }) {
  const { getFilteredData } = useBlueprint();
  const data = getFilteredData(section.id);

  const chartConfig = useMemo(
    () => buildChartConfig(section, data),
    [section, data]
  );

  if (!chartConfig) {
    return (
      <div className="blueprint-section blueprint-section--chart blueprint-section--empty">
        <div className="chart-title">{section.title}</div>
        <p className="blueprint-no-data">No data available</p>
      </div>
    );
  }

  return (
    <div className="blueprint-section blueprint-section--chart">
      <ChartPanel
        title={section.title}
        chartConfig={chartConfig}
        className="blueprint-chart"
      />
    </div>
  );
}
