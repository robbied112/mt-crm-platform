/**
 * ChartPanel component
 * Reusable wrapper for Chart.js canvases.
 * Handles mounting, resizing, and cleanup of Chart.js instances.
 */

import { useRef, useEffect } from "react";
import Chart from "chart.js/auto";

export default function ChartPanel({ title, chartConfig, className = "" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !chartConfig) return;

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new Chart(ctx, chartConfig);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartConfig]);

  return (
    <div className={`chart-container ${className}`}>
      {title && <div className="chart-title">{title}</div>}
      <div className="chart-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
