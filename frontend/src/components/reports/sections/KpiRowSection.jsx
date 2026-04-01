/**
 * KpiRowSection — renders a row of KPI cards from blueprint spec.
 * Wraps the existing KpiCard component with dynamic data.
 */
import { useBlueprint } from "../../../context/BlueprintContext";
import KpiCard from "../../KpiCard";

function formatValue(value, format) {
  if (value == null) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    case "decimal":
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "number":
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
}

export default function KpiRowSection({ section }) {
  const { getFilteredData } = useBlueprint();
  const data = getFilteredData(section.id);

  // Data is an array of { label, value, format } objects from computeBlueprint.
  // Fall back to section.items so KPI labels still render even with zero data.
  const computed = Array.isArray(data) && data.length > 0 ? data : null;
  const items = computed || section.items || [];

  if (items.length === 0) return null;

  return (
    <div className="blueprint-kpi-row">
      {items.map((item, i) => (
        <KpiCard
          key={item.label || i}
          label={item.label}
          value={computed ? formatValue(item.value, item.format) : "—"}
          subtext={item.subtext || ""}
        />
      ))}
    </div>
  );
}
