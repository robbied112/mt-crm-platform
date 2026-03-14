/**
 * Global data filtering utility
 * Extracted from index.html getFilteredData() (line 2747).
 * Applies all active dashboard filters to a dataset.
 */

import TENANT_CONFIG from "../config/tenant";
import { matchesUserTerritory } from "./territory";
import { dateInRange } from "./dateFilters";

/**
 * Apply the global filter state to a data array.
 * @param {Array} data - Raw data rows
 * @param {object} filters - Current filter state from useFilters()
 * @param {object|null} user - Current user (for territory enforcement)
 * @param {string} stateField - Field name for state in data rows (default 'st')
 * @returns {Array} Filtered rows
 */
export function getFilteredData(
  data,
  filters,
  user = null,
  stateField = "st"
) {
  const { regionMap } = TENANT_CONFIG;
  let filtered = data;

  // Territory restriction for reps (cannot be bypassed)
  if (user && user.role !== "admin") {
    filtered = filtered.filter((d) =>
      matchesUserTerritory(d[stateField], user)
    );
  }

  // Region filter
  if (filters.region) {
    filtered = filtered.filter(
      (d) => regionMap[d[stateField]] === filters.region
    );
  }

  // State filter
  if (filters.state) {
    filtered = filtered.filter((d) => d[stateField] === filters.state);
  }

  // Channel filter
  if (filters.channel && filters.channel !== "ALL") {
    filtered = filtered.filter((d) => {
      if (!d.ch) return true;
      return filters.channel === "ON"
        ? d.ch === "On-Premise"
        : d.ch === "Off-Premise";
    });
  }

  // Distributor filter
  if (filters.distributor) {
    filtered = filtered.filter((d) => {
      return (
        (d.name && d.name === filters.distributor) ||
        (d.dist && d.dist === filters.distributor) ||
        (d.distributor && d.distributor === filters.distributor)
      );
    });
  }

  // Rep / Owner filter
  if (filters.rep) {
    filtered = filtered.filter((d) => {
      const owner = d.owner || d.rep || "";
      return owner.includes(filters.rep);
    });
  }

  // Product filter (for data with skus arrays)
  if (filters.product) {
    filtered = filtered.filter((d) => {
      if (d.skus && Array.isArray(d.skus)) {
        return d.skus.some(
          (s) => s.w === filters.product || s.name === filters.product
        );
      }
      return true;
    });
  }

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter((d) => {
      const dateVal = d.date || d.last || d.stageDate || d.lastOrder || "";
      if (!dateVal) return true;
      return dateInRange(dateVal, filters.dateRange, filters.dateFrom, filters.dateTo);
    });
  }

  return filtered;
}
