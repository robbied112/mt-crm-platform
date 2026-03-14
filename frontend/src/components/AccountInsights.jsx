/**
 * AccountInsights tab component
 * Extracted from index.html renderAccounts() (lines 4447-4533)
 * and HTML (lines 1438-1503).
 * Shows KPIs, trend chart, concentration insight, and accounts table.
 */

import { useState, useMemo, useCallback } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import { getFilteredData } from "../utils/filterData";
import { esc } from "../utils/formatting";

const PAGE_SIZE = 50;

function TrendBadge({ trend }) {
  if (trend === "Momentum")
    return <span className="badge badge-green">Momentum</span>;
  if (trend === "Growth Opportunity")
    return <span className="badge badge-yellow">Growth Opportunity</span>;
  return (
    <span className="badge" style={{ background: "#E5E7EB", color: "#6B7280" }}>
      Consistent
    </span>
  );
}

function ConcentrationInsight({ concentration }) {
  if (!concentration || !concentration.total || concentration.total === 0)
    return null;

  return (
    <div
      style={{
        padding: 12,
        background: "#f0f4f8",
        borderRadius: 8,
        marginBottom: 16,
        borderLeft: "4px solid #3498db",
      }}
    >
      <h4 style={{ margin: "0 0 8px 0", color: "#2c3e50" }}>
        Account Concentration
      </h4>
      <div style={{ fontSize: 14, color: "#555" }}>
        Top 10 accounts = <strong>{concentration.top10}%</strong> of volume |
        Median = <strong>{concentration.median} CE</strong> |{" "}
        {concentration.under1} accounts under 1 CE
      </div>
    </div>
  );
}

export default function AccountInsights({
  accountsTop = [],
  acctConcentration = {},
  filters,
  user,
  onAccountClick,
  onExport,
}) {
  const [viewMode, setViewMode] = useState("top");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const data = useMemo(
    () => getFilteredData(accountsTop, filters, user),
    [accountsTop, filters, user]
  );

  // KPIs
  const momentumAccounts = data.filter((a) => a.trend === "Momentum").length;
  const growthAccounts = data.filter(
    (a) => a.trend === "Growth Opportunity"
  ).length;
  const consistentAccounts = data.filter(
    (a) => a.trend === "Consistent"
  ).length;

  // Trend chart
  const trendChartConfig = useMemo(
    () => ({
      type: "doughnut",
      data: {
        labels: ["Momentum", "Growth Opportunity", "Consistent"],
        datasets: [
          {
            data: [momentumAccounts, growthAccounts, consistentAccounts],
            backgroundColor: ["#0D9F6E", "#F8992D", "#E5E7EB"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    }),
    [momentumAccounts, growthAccounts, consistentAccounts]
  );

  // Filter, search, sort, paginate table data
  const tableData = useMemo(() => {
    let rows = viewMode === "top" ? data.slice(0, 20) : [...data];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          (a.acct || "").toLowerCase().includes(q) ||
          (a.dist || "").toLowerCase().includes(q) ||
          (a.st || "").toLowerCase().includes(q)
      );
    }

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
  }, [data, viewMode, search, sortCol, sortDir]);

  const totalPages = Math.ceil(tableData.length / PAGE_SIZE);
  const pageData = tableData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

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
    { key: "acct", label: "Account" },
    { key: "dist", label: "Distributor" },
    { key: "st", label: "State" },
    { key: "ch", label: "Channel" },
    { key: "nov", label: "Nov" },
    { key: "dec", label: "Dec" },
    { key: "jan", label: "Jan" },
    { key: "feb", label: "Feb" },
    { key: "total", label: "4M CE" },
    { key: "trend", label: "Trend" },
    { key: "growthPotential", label: "Growth Potential" },
  ];

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label="Total Accounts" value={data.length} />
        <KpiCard label="Momentum Accounts" value={momentumAccounts} />
        <KpiCard label="Growth Opportunity" value={growthAccounts} />
        <KpiCard label="Consistent Accounts" value={consistentAccounts} />
      </div>

      {/* Trend Chart */}
      <div className="charts-row">
        <ChartPanel
          title="Account Trend Distribution"
          chartConfig={trendChartConfig}
        />
      </div>

      {/* Concentration Insight */}
      <ConcentrationInsight concentration={acctConcentration} />

      {/* Accounts Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-title">Accounts</div>
          <div className="table-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <div className="toggle-group">
              <button
                className={`toggle-btn${viewMode === "top" ? " active" : ""}`}
                onClick={() => {
                  setViewMode("top");
                  setPage(1);
                }}
              >
                Top 20
              </button>
              <button
                className={`toggle-btn${viewMode === "all" ? " active" : ""}`}
                onClick={() => {
                  setViewMode("all");
                  setPage(1);
                }}
              >
                Show All
              </button>
            </div>
            {onExport && (
              <button
                className="btn btn-secondary btn-small"
                onClick={onExport}
              >
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
            {pageData.map((a, i) => (
              <tr key={i}>
                <td>{a.rank}</td>
                <td>
                  <span
                    className="acct-clickable"
                    onClick={() => onAccountClick?.(a.acct)}
                  >
                    {esc(a.acct)}
                  </span>
                </td>
                <td>{esc(a.dist)}</td>
                <td>{esc(a.st)}</td>
                <td>{esc(a.ch)}</td>
                <td>{a.nov ? (a.nov).toFixed(1) : "-"}</td>
                <td>{a.dec ? (a.dec).toFixed(1) : "-"}</td>
                <td>{a.jan ? (a.jan).toFixed(1) : "-"}</td>
                <td>{a.feb ? (a.feb).toFixed(1) : "-"}</td>
                <td>{(a.total || 0).toFixed(1)}</td>
                <td>
                  <TrendBadge trend={a.trend} />
                </td>
                <td>
                  {(a.growthPotential || 0) > 0
                    ? `+${a.growthPotential.toFixed(1)} CE`
                    : "\u2014"}
                </td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#64748b",
                  }}
                >
                  No account data available.
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
              {Math.min(page * PAGE_SIZE, tableData.length)} of{" "}
              {tableData.length}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="btn btn-secondary btn-small"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                &laquo;
              </button>
              <button
                className="btn btn-secondary btn-small"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                &lsaquo; Prev
              </button>
              <span style={{ padding: "4px 8px", fontWeight: 600 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-small"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rsaquo;
              </button>
              <button
                className="btn btn-secondary btn-small"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
