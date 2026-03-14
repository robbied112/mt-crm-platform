/**
 * Date range filtering utilities
 * Extracted from index.html getDateRangeBounds() / dateInRange().
 */

/**
 * Compute date range boundaries from a filter selection.
 * @param {string} rangeKey - '', 'R3', 'R6', 'R9', 'R12', 'MTD', 'QTD', 'YTD', 'custom'
 * @param {string} [customFrom] - YYYY-MM-DD for custom range start
 * @param {string} [customTo] - YYYY-MM-DD for custom range end
 * @returns {{ from: Date, to: Date } | null}
 */
export function getDateRangeBounds(rangeKey, customFrom = "", customTo = "") {
  const now = new Date();
  let from = null;
  let to = now;

  switch (rangeKey) {
    case "R3":
      from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      break;
    case "R6":
      from = new Date(now);
      from.setMonth(from.getMonth() - 6);
      break;
    case "R9":
      from = new Date(now);
      from.setMonth(from.getMonth() - 9);
      break;
    case "R12":
      from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "MTD":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "QTD": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), qMonth, 1);
      break;
    }
    case "YTD":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = customFrom ? new Date(customFrom) : null;
      to = customTo ? new Date(customTo) : now;
      break;
    default:
      return null; // All Time
  }

  return from ? { from, to } : null;
}

/**
 * Check if a date string falls within the given range.
 * @param {string} dateStr - The date to check
 * @param {string} rangeKey - Current range filter key
 * @param {string} [customFrom] - Custom start date
 * @param {string} [customTo] - Custom end date
 * @returns {boolean}
 */
export function dateInRange(dateStr, rangeKey, customFrom, customTo) {
  if (!rangeKey) return true;
  const bounds = getDateRangeBounds(rangeKey, customFrom, customTo);
  if (!bounds) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true; // keep rows with no/bad dates
  return d >= bounds.from && d <= bounds.to;
}
