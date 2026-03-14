/**
 * useFilters hook
 * Manages global filter state for the dashboard.
 * Extracted from index.html global filter variables (lines 2479-2488).
 */

import { useState, useCallback } from "react";

const INITIAL_FILTERS = {
  dateRange: "",
  dateFrom: "",
  dateTo: "",
  rep: "",
  product: "",
  distributor: "",
  region: "",
  state: "",
  channel: "ALL",
};

export default function useFilters() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  return { filters, updateFilter, clearAll };
}
