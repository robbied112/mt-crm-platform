/**
 * Reusable pagination system for tables
 * Extracted from index.html paginate() / renderPaginationControls().
 */

const _paginators = {};

/**
 * Paginate a data array for a given table.
 * @param {string} tableId - Unique identifier for the table
 * @param {Array} data - The full data array
 * @param {number} pageSize - Rows per page (default 50)
 * @returns {{ page, total, pageSize, totalPages, pageData }}
 */
export function paginate(tableId, data, pageSize = 50) {
  if (!_paginators[tableId]) _paginators[tableId] = { page: 1 };
  const p = _paginators[tableId];
  p.total = data.length;
  p.pageSize = pageSize;
  p.totalPages = Math.ceil(data.length / pageSize);
  if (p.page > p.totalPages) p.page = p.totalPages || 1;
  const start = (p.page - 1) * pageSize;
  p.pageData = data.slice(start, start + pageSize);
  return p;
}

/**
 * Set the current page for a paginator.
 */
export function setPage(tableId, page) {
  if (_paginators[tableId]) {
    _paginators[tableId].page = page;
  }
}

/**
 * Get the current paginator state for a table.
 */
export function getPaginator(tableId) {
  return _paginators[tableId] || null;
}

/**
 * Reset pagination state for a table.
 */
export function resetPagination(tableId) {
  delete _paginators[tableId];
}
