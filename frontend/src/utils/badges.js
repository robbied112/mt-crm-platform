/**
 * Badge/label rendering utilities
 * Extracted from index.html display helper functions (lines 2813-2876).
 * These return plain objects for React rendering rather than HTML strings.
 */

/**
 * Stage badge config: Established / Building / Emerging
 */
export function getStageBadge(label) {
  if (label === "Established") return { text: "Established", className: "badge badge-green" };
  if (label === "Building") return { text: "Building", className: "badge badge-blue" };
  return { text: "Emerging", className: "badge badge-yellow" };
}

/**
 * Momentum badge config
 */
export function getMomentumBadge(val) {
  const str = String(val || "");
  if (str.startsWith("+")) return { text: str, className: "badge badge-green" };
  if (str.startsWith("Opportunity")) return { text: str, className: "badge badge-yellow" };
  if (str === "New Market") return { text: str, className: "badge badge-blue" };
  return { text: str, className: "badge badge-blue" };
}

/**
 * Velocity trend indicator: up / down / new / flat
 */
export function getVelTrendIndicator(trend) {
  if (trend === "up") return { symbol: "\u25B2", color: "#10b981" };
  if (trend === "down") return { symbol: "\u25BC", color: "#ef4444" };
  if (trend === "new") return { symbol: "NEW", color: "#6B7280", fontSize: 10 };
  return { symbol: "\u2594", color: "#6B7280" };
}

/**
 * Sell-through percentage color
 */
export function getSellThruColor(pct) {
  if (pct >= 60) return "#10b981";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}
