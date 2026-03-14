/**
 * FilterBar component
 * Extracted from index.html lines 1111-1179.
 * Global filter bar with date range, rep, product, distributor, region, state, channel.
 */

import { useState } from "react";

const DATE_RANGE_OPTIONS = [
  { value: "", label: "All Time" },
  { value: "R3", label: "Rolling 3 Months" },
  { value: "R6", label: "Rolling 6 Months" },
  { value: "R9", label: "Rolling 9 Months" },
  { value: "R12", label: "Rolling 12 Months" },
  { value: "MTD", label: "Month to Date" },
  { value: "QTD", label: "Quarter to Date" },
  { value: "YTD", label: "Year to Date" },
  { value: "custom", label: "Custom Range" },
];

const CHANNEL_OPTIONS = [
  { value: "ALL", label: "All Channels" },
  { value: "ON", label: "On-Premise" },
  { value: "OFF", label: "Off-Premise" },
];

export default function FilterBar({
  filters,
  onFilterChange,
  onClearAll,
  regions = [],
  states = [],
  reps = [],
  products = [],
  distributors = [],
  userName,
}) {
  const [showCustomDates, setShowCustomDates] = useState(
    filters.dateRange === "custom"
  );

  function handleDateRangeChange(e) {
    const value = e.target.value;
    setShowCustomDates(value === "custom");
    onFilterChange("dateRange", value);
  }

  // Count active filters
  const activeCount = [
    filters.dateRange,
    filters.rep,
    filters.product,
    filters.distributor,
    filters.region,
    filters.state,
    filters.channel && filters.channel !== "ALL" ? filters.channel : "",
  ].filter(Boolean).length;

  return (
    <div
      className="filter-bar"
      style={{ flexWrap: "wrap", gap: "8px 16px", padding: "12px 20px" }}
    >
      {/* Date Range */}
      <div className="filter-group" style={{ minWidth: 140 }}>
        <label>Date Range</label>
        <select
          value={filters.dateRange}
          onChange={handleDateRangeChange}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Date Fields */}
      {showCustomDates && (
        <div className="filter-group" style={{ minWidth: 200 }}>
          <label>From / To</label>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => onFilterChange("dateFrom", e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                width: 120,
              }}
            />
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => onFilterChange("dateTo", e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                width: 120,
              }}
            />
          </div>
        </div>
      )}

      {/* Rep / Owner */}
      <div className="filter-group" style={{ minWidth: 130 }}>
        <label>Rep / Owner</label>
        <select
          value={filters.rep}
          onChange={(e) => onFilterChange("rep", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          <option value="">All Reps</option>
          {reps.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Product */}
      <div className="filter-group" style={{ minWidth: 130 }}>
        <label>Product</label>
        <select
          value={filters.product}
          onChange={(e) => onFilterChange("product", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Distributor */}
      <div className="filter-group" style={{ minWidth: 130 }}>
        <label>Distributor</label>
        <select
          value={filters.distributor}
          onChange={(e) => onFilterChange("distributor", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          <option value="">All Distributors</option>
          {distributors.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Region */}
      <div className="filter-group" style={{ minWidth: 110 }}>
        <label>Region</label>
        <select
          value={filters.region}
          onChange={(e) => onFilterChange("region", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* State */}
      <div className="filter-group" style={{ minWidth: 110 }}>
        <label>State</label>
        <select
          value={filters.state}
          onChange={(e) => onFilterChange("state", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Channel */}
      <div className="filter-group" style={{ minWidth: 110 }}>
        <label>Channel</label>
        <select
          value={filters.channel}
          onChange={(e) => onFilterChange("channel", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        >
          {CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear + Badge + Username */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          marginLeft: "auto",
        }}
      >
        <button
          onClick={onClearAll}
          style={{
            padding: "6px 12px",
            background: "#F3F4F6",
            color: "#6B7280",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title="Reset all filters"
        >
          Clear Filters
        </button>
        {activeCount > 0 && (
          <span
            style={{
              background: "#0F766E",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 10,
            }}
          >
            {activeCount}
          </span>
        )}
        {userName && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#0F766E",
              whiteSpace: "nowrap",
            }}
          >
            {userName}
          </span>
        )}
      </div>
    </div>
  );
}
