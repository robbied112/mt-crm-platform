/**
 * ReorderForecast tab component
 * Extracted from index.html renderReorder() / renderReorderTable() (lines 4620-4769)
 * and HTML (lines 1573-1639).
 * Shows KPIs, status doughnut chart, and priority reorder table with SKU expansion.
 */

import { useState, useMemo, useCallback } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import { getFilteredData } from "../utils/filterData";
import { esc } from "../utils/formatting";
import { t } from "../utils/terminology";
import { exportToXlsx } from "../utils/exportXlsx";

const PAGE_SIZE = 50;

function getReorderStatus(days, cycle) {
  if (days > cycle * 1.5) return "Overdue";
  if (days > cycle * 0.8) return "Due Soon";
  return "On Track";
}

function ReorderStatusBadge({ status }) {
  if (status === "Overdue")
    return <span className="badge badge-orange pulse">Overdue</span>;
  if (status === "Due Soon")
    return <span className="badge badge-yellow">Due Soon</span>;
  return <span className="badge badge-green">On Track</span>;
}

function PriorityBar({ priority }) {
  const p = priority || 0;
  const color = p >= 70 ? "#ef4444" : p >= 40 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 40,
          height: 6,
          background: "#eee",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(p, 100)}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "#64748b" }}>{p}</span>
    </div>
  );
}

function SkuStatusBadge({ days, cycle }) {
  if (days > cycle && cycle > 0)
    return <span className="badge badge-orange">Overdue</span>;
  if (days >= cycle - 7 && cycle > 0)
    return <span className="badge badge-yellow">Due</span>;
  return <span className="badge badge-green">On Track</span>;
}

function ReorderRow({ row, index, skuFilter, onAccountClick }) {
  const [expanded, setExpanded] = useState(false);

  // SKU-filtered view
  if (skuFilter !== "all") {
    const sku = (row.skus || []).find((s) => s.w === skuFilter);
    if (!sku) return null;
    const skuStatus =
      sku.days > sku.cycle && sku.cycle > 0
        ? "Overdue"
        : sku.days >= sku.cycle - 7 && sku.cycle > 0
          ? "Due Soon"
          : "On Track";

    return (
      <tr>
        <td>{index + 1}</td>
        <td>
          <span className="acct-clickable" onClick={() => onAccountClick?.(row.acct)}>
            {esc(row.acct)}
          </span>
        </td>
        <td>{esc(row.dist)}</td>
        <td>{esc(row.st)}</td>
        <td>{esc(row.ch)}</td>
        <td>{(sku.ce || 0).toFixed(1)}</td>
        <td>{sku.purch}</td>
        <td>{sku.cycle}</td>
        <td>{sku.last}</td>
        <td>{sku.days}</td>
        <td><PriorityBar priority={row.priority} /></td>
        <td><ReorderStatusBadge status={skuStatus} /></td>
      </tr>
    );
  }

  // Default view with expandable SKU rows
  const hasSkus = row.skus && row.skus.length > 0;

  return (
    <>
      <tr>
        <td>{row.rank}</td>
        <td>
          {hasSkus && (
            <span
              style={{ cursor: "pointer", color: "#3498db", fontSize: 12, marginRight: 4 }}
              onClick={() => setExpanded(!expanded)}
              title="Show SKU breakdown"
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </span>
          )}
          <span className="acct-clickable" onClick={() => onAccountClick?.(row.acct)}>
            {esc(row.acct)}
          </span>
        </td>
        <td>{esc(row.dist)}</td>
        <td>{esc(row.st)}</td>
        <td>{esc(row.ch)}</td>
        <td>{(row.ce || 0).toFixed(1)}</td>
        <td>{(row.purch || 0).toFixed(1)}</td>
        <td>{Math.round(row.cycle || 0)}</td>
        <td>{esc(row.last)}</td>
        <td>{Math.round(row.days || 0)}</td>
        <td><PriorityBar priority={row.priority} /></td>
        <td><ReorderStatusBadge status={row.status} /></td>
      </tr>
      {expanded && hasSkus && (
        <tr>
          <td colSpan={12} style={{ padding: 0 }}>
            <table style={{ width: "100%", background: "#f8f9fa", border: "none", margin: 0 }}>
              <thead style={{ fontSize: 11, color: "#7f8c8d" }}>
                <tr>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }}>Product</th>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }} />
                  <th style={{ padding: "6px 10px", border: "none" }}>CE</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Orders</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Cycle</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Last Order</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Days</th>
                  <th style={{ padding: "6px 10px", border: "none" }}>Status</th>
                  <th style={{ padding: "6px 10px", border: "none" }} />
                </tr>
              </thead>
              <tbody>
                {row.skus.map((s, si) => (
                  <tr key={si} style={{ fontSize: 12 }}>
                    <td style={{ padding: "4px 10px", border: "none" }} />
                    <td style={{ padding: "4px 10px", border: "none", fontWeight: 500 }}>{s.w}</td>
                    <td style={{ padding: "4px 10px", border: "none" }} />
                    <td style={{ padding: "4px 10px", border: "none" }} />
                    <td style={{ padding: "4px 10px", border: "none" }} />
                    <td style={{ padding: "4px 10px", border: "none" }}>{(s.ce || 0).toFixed(1)}</td>
                    <td style={{ padding: "4px 10px", border: "none" }}>{s.purch}</td>
                    <td style={{ padding: "4px 10px", border: "none" }}>{s.cycle}</td>
                    <td style={{ padding: "4px 10px", border: "none" }}>{s.last}</td>
                    <td style={{ padding: "4px 10px", border: "none" }}>{s.days}</td>
                    <td style={{ padding: "4px 10px", border: "none" }}>
                      <SkuStatusBadge days={s.days} cycle={s.cycle} />
                    </td>
                    <td style={{ padding: "4px 10px", border: "none" }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReorderForecast({
  reorderData = [],
  filters,
  user,
  onAccountClick,
  onExport,
}) {
  const [viewMode, setViewMode] = useState("top");
  const [skuFilter, setSkuFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("priority");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const filteredBase = useMemo(
    () => getFilteredData(reorderData, filters, user),
    [reorderData, filters, user]
  );

  // Add status to each row
  const dataWithStatus = useMemo(
    () =>
      filteredBase.map((r) => ({
        ...r,
        status: getReorderStatus(r.days, r.cycle),
      })),
    [filteredBase]
  );

  // KPIs
  const overdueCount = dataWithStatus.filter((r) => r.status === "Overdue").length;
  const soonCount = dataWithStatus.filter((r) => r.status === "Due Soon").length;
  const trackCount = dataWithStatus.filter((r) => r.status === "On Track").length;
  const avgCycle =
    dataWithStatus.length > 0
      ? (
          dataWithStatus.reduce((sum, r) => sum + (r.cycle || 0), 0) /
          dataWithStatus.length
        ).toFixed(0)
      : "0";

  // Status chart
  const statusChartConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Overdue", "Due Soon", "On Track"],
        datasets: [
          {
            data: [overdueCount, soonCount, trackCount],
            backgroundColor: ["#F8992D", "#D97706", "#0D9F6E"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    }),
    [overdueCount, soonCount, trackCount]
  );

  // SKU filter options
  const skuOptions = useMemo(() => {
    const names = new Set();
    dataWithStatus.forEach((r) =>
      (r.skus || []).forEach((s) => names.add(s.w))
    );
    return [...names].sort();
  }, [dataWithStatus]);

  // Table data: filter, search, sort, paginate
  const tableData = useMemo(() => {
    let rows = dataWithStatus;

    if (skuFilter !== "all") {
      rows = rows.filter(
        (r) => r.skus && r.skus.some((s) => s.w === skuFilter)
      );
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.acct || "").toLowerCase().includes(q) ||
          (r.dist || "").toLowerCase().includes(q)
      );
    }

    rows = viewMode === "top" ? rows.slice(0, 20) : [...rows];

    rows.sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [dataWithStatus, skuFilter, search, viewMode, sortCol, sortDir]);

  const totalPages = Math.ceil(tableData.length / PAGE_SIZE);
  const pageData = tableData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const columns = [
    { key: "rank", label: "#" },
    { key: "acct", label: t("account") },
    { key: "dist", label: t("distributor") },
    { key: "st", label: "State" },
    { key: "ch", label: "Channel" },
    { key: "ce", label: "4M CE" },
    { key: "purch", label: "Purchases" },
    { key: "cycle", label: "Avg Cycle" },
    { key: "last", label: "Last Order" },
    { key: "days", label: "Days Since" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
  ];

  // Empty state
  if (!filteredBase || filteredBase.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128260;</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          No Reorder Data
        </div>
        <div style={{ fontSize: 14 }}>
          Upload purchase history data to see reorder timing and priorities.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label="Overdue Accounts" value={overdueCount} />
        <KpiCard label="Due Soon" value={soonCount} />
        <KpiCard label="On Track" value={trackCount} />
        <KpiCard label="Avg Cycle (Days)" value={avgCycle} />
      </div>

      {/* Status Chart */}
      <div className="charts-row">
        <ChartPanel
          title="Reorder Status Distribution"
          chartConfig={statusChartConfig}
        />
      </div>

      {/* Reorder Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-title">Priority Reorder Forecast</div>
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="text"
              className="search-input"
              placeholder={`Search ${t("account").toLowerCase()}s...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <div className="toggle-group">
              <button
                className={`toggle-btn${viewMode === "top" ? " active" : ""}`}
                onClick={() => { setViewMode("top"); setPage(1); }}
              >
                Top 20
              </button>
              <button
                className={`toggle-btn${viewMode === "all" ? " active" : ""}`}
                onClick={() => { setViewMode("all"); setPage(1); }}
              >
                Show All
              </button>
            </div>
            {onExport && (
              <button className="btn btn-secondary btn-small" onClick={() => exportToXlsx(tableData, "reorder-forecast", "Reorder Forecast", {
                columns: ["rank", "acct", "dist", "st", "ch", "ce", "purch", "cycle", "last", "days", "priority", "status"],
                headers: { rank: "#", acct: t("account"), dist: t("distributor"), st: "State", ch: "Channel", ce: "4M CE", purch: "Purchases", cycle: "Avg Cycle", last: "Last Order", days: "Days Since", priority: "Priority", status: "Status" },
              })}>
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
                      ? sortDir === "asc" ? " \u2191" : " \u2193"
                      : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <ReorderRow
                key={i}
                row={row}
                index={(page - 1) * PAGE_SIZE + i}
                skuFilter={skuFilter}
                onAccountClick={onAccountClick}
              />
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                  No accounts match the current filters.
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
              {Math.min(page * PAGE_SIZE, tableData.length)} of {tableData.length}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-secondary btn-small" disabled={page === 1} onClick={() => setPage(1)}>&laquo;</button>
              <button className="btn btn-secondary btn-small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>&lsaquo; Prev</button>
              <span style={{ padding: "4px 8px", fontWeight: 600 }}>Page {page} of {totalPages}</span>
              <button className="btn btn-secondary btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next &rsaquo;</button>
              <button className="btn btn-secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>&raquo;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
