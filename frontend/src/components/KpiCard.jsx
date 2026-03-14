/**
 * KpiCard component
 * Extracted from the recurring KPI card pattern used across all dashboard tabs.
 */

export default function KpiCard({ label, value, subtext }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {subtext && <div className="kpi-subtext">{subtext}</div>}
    </div>
  );
}
