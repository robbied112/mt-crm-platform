/**
 * InventoryTable component
 * Extracted from index.html renderInventory() table section (lines 4251-4389).
 * Paginated, sortable inventory detail table with SKU filter and expandable rows.
 */

import { useState, useMemo, useCallback } from "react";
import { t } from "../utils/terminology";

const PAGE_SIZE = 50;

function StatusBadge({ status }) {
  const styles = {
    Healthy: { bg: "#d1fae5", color: "#065f46" },
    "Reorder Opportunity": { bg: "#fed7aa", color: "#9a3412" },
    Overstocked: { bg: "#dbeafe", color: "#1e40af" },
    "Dead Stock": { bg: "#e5e7eb", color: "#374151" },
    "Review Needed": { bg: "#dbeafe", color: "#1e40af" },
  };
  const s = styles[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {status || "--"}
    </span>
  );
}

function SkuRows({ skus }) {
  if (!skus || skus.length === 0) return null;
  return skus.map((s, i) => (
    <tr key={i} style={{ fontSize: 12 }}>
      <td style={{ padding: "4px 10px", fontWeight: 500 }}>{s.w}</td>
      <td />
      <td style={{ padding: "4px 10px" }}>{(s.oh || 0).toFixed(1)}</td>
      <td style={{ padding: "4px 10px" }}>{(s.rate || 0).toFixed(2)}</td>
      <td style={{ padding: "4px 10px" }}>{Math.round(s.doh || 0)}</td>
      <td />
      <td style={{ padding: "4px 10px" }}>
        <StatusBadge status={s.status} />
      </td>
      <td />
    </tr>
  ));
}

function InventoryRow({ row, skuFilter }) {
  const [expanded, setExpanded] = useState(false);
  const [childExpanded, setChildExpanded] = useState({});

  const toggleChild = useCallback((idx) => {
    setChildExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  // When a SKU filter is active, show only that SKU's data
  if (skuFilter !== "all") {
    const sku = (row.skus || []).find((s) => s.w === skuFilter);
    if (!sku) return null;

    if (row.isGroup && row.children) {
      return (
        <>
          <tr style={{ backgroundColor: "#f0f4f8", fontWeight: 600 }}>
            <td>
              <span
                style={{ cursor: "pointer", color: "#3498db", fontSize: 12, marginRight: 4 }}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "\u25BC" : "\u25B6"}
              </span>
              {row.name}
            </td>
            <td>{row.st}</td>
            <td>{(sku.oh || 0).toFixed(1)}</td>
            <td>{(sku.rate || 0).toFixed(2)}</td>
            <td>{Math.round(sku.doh || 0)}</td>
            <td>-</td>
            <td><StatusBadge status={sku.status} /></td>
            <td>-</td>
          </tr>
          {expanded && row.children.map((child, ci) => {
            const childSku = (child.skus || []).find((s) => s.w === skuFilter);
            if (!childSku) return null;
            return (
              <tr key={ci} style={{ backgroundColor: "#f9f9f9", fontSize: 12, borderLeft: "3px solid #3498db" }}>
                <td style={{ padding: "4px 10px 4px 28px", borderBottom: "1px solid #e5e7eb" }}>{child.name}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{child.st}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(childSku.oh || 0).toFixed(1)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(childSku.rate || 0).toFixed(2)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{Math.round(childSku.doh || 0)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>-</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}><StatusBadge status={childSku.status} /></td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>-</td>
              </tr>
            );
          })}
        </>
      );
    }

    return (
      <tr>
        <td>{row.name}</td>
        <td>{row.st}</td>
        <td>{(sku.oh || 0).toFixed(1)}</td>
        <td>{(sku.rate || 0).toFixed(2)}</td>
        <td>{Math.round(sku.doh || 0)}</td>
        <td>-</td>
        <td><StatusBadge status={sku.status} /></td>
        <td>-</td>
      </tr>
    );
  }

  // Default: show distributor totals with expandable SKU/warehouse rows
  const hasSkus = row.skus && row.skus.length > 0;

  if (row.isGroup && row.children) {
    return (
      <>
        <tr style={{ backgroundColor: "#f0f4f8", fontWeight: 600 }}>
          <td>
            <span
              style={{ cursor: "pointer", color: "#3498db", fontSize: 12, marginRight: 4 }}
              onClick={() => setExpanded(!expanded)}
              title="Show warehouses"
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </span>
            {row.name}{" "}
            <span style={{ fontSize: 10, color: "#6B7280", fontWeight: 400 }}>
              ({row.children.length} locations)
            </span>
          </td>
          <td>{row.st}</td>
          <td><strong>{(row.oh || 0).toFixed(1)}</strong></td>
          <td>{(row.rate || 0).toFixed(2)}</td>
          <td>{Math.round(row.doh || 0)}</td>
          <td>{(row.dep90 || 0).toFixed(1)}</td>
          <td><StatusBadge status={row.status} /></td>
          <td>{(row.proj || 0).toFixed(1)}</td>
        </tr>
        {expanded && row.children.map((child, ci) => {
          const childHasSkus = child.skus && child.skus.length > 0;
          return (
            <React.Fragment key={ci}>
              <tr style={{ backgroundColor: "#f9f9f9", fontSize: 12, borderLeft: "3px solid #3498db" }}>
                <td style={{ padding: "4px 10px 4px 28px", borderBottom: "1px solid #e5e7eb", fontWeight: 500 }}>
                  {childHasSkus && (
                    <span
                      style={{ cursor: "pointer", color: "#3498db", fontSize: 11, marginRight: 2 }}
                      onClick={() => toggleChild(ci)}
                      title="Show product breakdown"
                    >
                      {childExpanded[ci] ? "\u25BC" : "\u25B6"}
                    </span>
                  )}
                  {child.name}
                </td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{child.st}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(child.oh || 0).toFixed(1)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(child.rate || 0).toFixed(2)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{Math.round(child.doh || 0)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(child.dep90 || 0).toFixed(1)}</td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}><StatusBadge status={child.status} /></td>
                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{(child.proj || 0).toFixed(1)}</td>
              </tr>
              {childExpanded[ci] && childHasSkus && (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <table style={{ width: "100%", background: "#f0f1f3", border: "none", margin: 0 }}>
                      <tbody>
                        <SkuRows skus={child.skus} />
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  }

  // Single distributor row
  return (
    <>
      <tr>
        <td>
          {hasSkus && (
            <span
              style={{ cursor: "pointer", color: "#3498db", fontSize: 12, marginRight: 4 }}
              onClick={() => setExpanded(!expanded)}
              title="Show product breakdown"
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </span>
          )}
          {row.name}
        </td>
        <td>{row.st}</td>
        <td><strong>{(row.oh || 0).toFixed(1)}</strong></td>
        <td>{(row.rate || 0).toFixed(2)}</td>
        <td>{Math.round(row.doh || 0)}</td>
        <td>{(row.dep90 || 0).toFixed(1)}</td>
        <td><StatusBadge status={row.status} /></td>
        <td>{(row.proj || 0).toFixed(1)}</td>
      </tr>
      {expanded && hasSkus && (
        <tr>
          <td colSpan={8} style={{ padding: 0 }}>
            <table style={{ width: "100%", background: "#f8f9fa", border: "none", margin: 0 }}>
              <thead style={{ fontSize: 11, color: "#7f8c8d" }}>
                <tr>
                  <th style={{ padding: "6px 10px", border: "none" }}>Product</th>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }}>On Hand</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Daily Rate</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>DOH</th>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }}>Status</th>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                </tr>
              </thead>
              <tbody>
                <SkuRows skus={row.skus} />
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function InventoryTable({ data = [], onExport }) {
  const [skuFilter, setSkuFilter] = useState("all");
  const [sortCol, setSortCol] = useState("oh");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  // Collect all unique SKU names for the filter dropdown
  const skuOptions = useMemo(() => {
    const names = new Set();
    data.forEach((d) => {
      (d.skus || []).forEach((s) => names.add(s.w));
      (d.children || []).forEach((c) =>
        (c.skus || []).forEach((s) => names.add(s.w))
      );
    });
    return [...names].sort();
  }, [data]);

  const handleSort = useCallback(
    (col) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortCol]
  );

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    { key: "name", label: t("distributor") },
    { key: "st", label: "State" },
    { key: "oh", label: "On Hand" },
    { key: "rate", label: "Daily Rate" },
    { key: "doh", label: "DOH" },
    { key: "dep90", label: `90D ${t("depletion")}` },
    { key: "status", label: "Status" },
    { key: "proj", label: "Proj Order" },
  ];

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title">Inventory Details by {t("distributor")}</div>
        <div className="table-controls">
          <select
            className="dropdown-select"
            style={{ marginRight: 8, minWidth: 140 }}
            value={skuFilter}
            onChange={(e) => {
              setSkuFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Products</option>
            {skuOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {onExport && (
            <button className="btn btn-secondary btn-small" onClick={onExport}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="sortable"
                onClick={() => handleSort(col.key)}
                style={{ cursor: "pointer" }}
              >
                {col.label}
                <span className="sort-indicator">
                  {sortCol === col.key
                    ? sortDir === "asc"
                      ? " \u2191"
                      : " \u2193"
                    : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageData.map((row, i) => (
            <InventoryRow key={i} row={row} skuFilter={skuFilter} />
          ))}
          {pageData.length === 0 && (
            <tr>
              <td
                colSpan={8}
                style={{ textAlign: "center", padding: 40, color: "#64748b" }}
              >
                No inventory data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-secondary btn-small" disabled={page === 1} onClick={() => setPage(1)}>
              &laquo;
            </button>
            <button className="btn btn-secondary btn-small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              &lsaquo; Prev
            </button>
            <span style={{ padding: "4px 8px", fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <button className="btn btn-secondary btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next &rsaquo;
            </button>
            <button className="btn btn-secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
