/**
 * Import Diff — compares two imports and produces a summary of changes.
 *
 * Used to show what changed between the current and previous import.
 */

/**
 * Compare two import snapshots and produce a diff summary.
 *
 * @param {object} current - Current import stats { rowCount, type, fileName }
 * @param {object} previous - Previous import stats { rowCount, type, fileName }
 * @returns {object} Diff summary
 */
function computeImportDiff(current, previous) {
  if (!previous) {
    return { isFirst: true, current };
  }

  const rowDelta = (current.rowCount || 0) - (previous.rowCount || 0);
  const rowPctChange = previous.rowCount > 0
    ? Math.round((rowDelta / previous.rowCount) * 100)
    : null;

  return {
    isFirst: false,
    current,
    previous,
    rowDelta,
    rowPctChange,
    previousFileName: previous.fileName,
    daysSinceLast: previous.createdAt
      ? Math.floor((Date.now() - (previous.createdAt.toDate ? previous.createdAt.toDate() : new Date(previous.createdAt)).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  };
}

module.exports = { computeImportDiff };
