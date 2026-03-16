/**
 * Apply margin on selling price.
 * sell_price = cost / (1 - margin)
 * If margin >= 1, returns cost unchanged (prevents division by zero / nonsense).
 */
export function applyMarginOnSelling(cost: number, marginPercent: number): number {
  const m = (marginPercent || 0) / 100;
  if (m <= 0 || !isFinite(m) || m >= 1) return cost;
  return cost / (1 - m);
}

/**
 * Calculate the actual margin percent from cost and selling price.
 * Returns 0 if selling price is zero.
 */
export function actualMarginPercent(cost: number, sellingPrice: number): number {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - cost) / sellingPrice) * 100;
}

/**
 * Round a retail price to .99 for shelf-friendly display.
 */
export function roundToShelfPrice(value: number): number {
  if (!Number.isFinite(value)) return value;
  const floored = Math.floor(value);
  const decimal = value - floored;
  const EPS = 1e-9;
  if (decimal + EPS < 0.4) {
    const candidate = Math.max(0, floored - 1 + 0.99);
    return candidate === 0 ? 0.99 : candidate;
  }
  return floored + 0.99;
}
