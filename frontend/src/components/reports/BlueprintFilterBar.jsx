/**
 * BlueprintFilterBar — renders dynamic global filters from the blueprint.
 * Filter values are pre-extracted and stored with the blueprint.
 */
import { useBlueprint } from "../../context/BlueprintContext";

export default function BlueprintFilterBar() {
  const { blueprint, filters, setFilters } = useBlueprint();

  if (!blueprint?.globalFilters?.length) return null;

  const handleChange = (filterId, value) => {
    setFilters((prev) => ({ ...prev, [filterId]: value }));
  };

  return (
    <div className="blueprint-filter-bar">
      {blueprint.globalFilters.map((filterDef) => {
        const options = blueprint.filterValues?.[filterDef.id] || [];
        const currentValue = filters[filterDef.id] || "all";

        return (
          <div key={filterDef.id} className="blueprint-filter">
            <label className="blueprint-filter__label">{filterDef.label}</label>
            <select
              className="blueprint-filter__select"
              value={currentValue}
              onChange={(e) => handleChange(filterDef.id, e.target.value)}
            >
              <option value="all">All {filterDef.label}s</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      })}

      {Object.values(filters).some((v) => v && v !== "all") && (
        <button
          className="blueprint-filter__clear"
          onClick={() => setFilters({})}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
