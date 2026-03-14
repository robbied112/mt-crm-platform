/**
 * ChartPanel component
 * Reusable wrapper for Chart.js canvases.
 * Handles mounting, resizing, and cleanup of Chart.js instances.
 */

import { useRef, useEffect } from "react";

export default function ChartPanel({ title, chartConfig, className = "" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    // Chart.js must be loaded globally (via CDN) for now.
    // During full migration this will switch to: import Chart from 'chart.js/auto';
    const Chart = window.Chart;
    if (!Chart || !canvasRef.current || !chartConfig) return;

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
