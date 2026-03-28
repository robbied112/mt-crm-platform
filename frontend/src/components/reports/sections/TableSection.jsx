/**
 * TableSection — renders a dynamic sortable, paginated table from blueprint spec.
 * Column definitions come from the blueprint, not hardcoded.
 */
import { useState, useMemo, useCallback } from "react";
import { useBlueprint } from "../../../context/BlueprintContext";

const PAGE_SIZE = 50;

function formatCell(value, format) {
  if (value == null || value === "") return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    case "decimal":
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
    case "percent":
      return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : value;
    case "number":
      return typeof value === "number"
        ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
        : value;
    default:
      return String(value);
  }
}

export default function TableSection({ section }) {
  const { getFilteredData } = useBlueprint();
  const data = getFilteredData(section.id);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);

  const columns = section.columns || [];

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  }, [sortField]);

  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [data, sortField, sortDir]);

  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);

  const handleExport = useCallback(() => {
    if (!sortedData.length) return;
    const headers = columns.map((c) => c.label);
    const csvRows = [headers.join(",")];
    for (const row of sortedData) {
      csvRows.push(columns.map((c) => {
        const val = row[c.field];
        if (val == null) return "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") ? `"${str}"` : str;
      }).join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${section.title || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedData, columns, section.title]);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="blueprint-section blueprint-section--table blueprint-section--empty">
        <div className="blueprint-section-header">
          <h3>{section.title}</h3>
        </div>
        <p className="blueprint-no-data">No data available</p>
      </div>
    );
  }

  return (
    <div className="blueprint-section blueprint-section--table">
      <div className="blueprint-section-header">
        <h3>{section.title}</h3>
        <div className="blueprint-section-actions">
          <span className="blueprint-row-count">{sortedData.length} rows</span>
          {section.exportable && (
            <button className="btn-secondary btn-sm" onClick={handleExport}>
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="blueprint-table-wrapper">
        <table className="blueprint-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  className={col.sortable ? "blueprint-table__th--sortable" : ""}
                  onClick={col.sortable ? () => handleSort(col.field) : undefined}
                >
                  {col.label}
                  {sortField === col.field && (
                    <span className="blueprint-sort-arrow">
                      {sortDir === "asc" ? " ↑" : " ↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.field} className={col.format === "number" || col.format === "currency" ? "text-right" : ""}>
                    {formatCell(row[col.field], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="blueprint-pagination">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
