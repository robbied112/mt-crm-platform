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
import { t } from "../utils/terminology";
import { exportToXlsx } from "../utils/exportXlsx";

const PAGE_SIZE = 50;

function TrendBadge({ trend }) {
  if (trend === "Momentum")
    return <span className="badge badge-green">Momentum</span>;
  if (trend === "Growth Opportunity")
    return <span className="badge badge-yellow">Growth Opportunity</span>;
  return (
    <span className="badge" style={{ background: "#E5E0DA", color: "#6B6B6B" }}>
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
        background: "#F5EDE3",
        borderRadius: 8,
        marginBottom: 16,
        borderLeft: "4px solid #8B6A4C",
      }}
    >
      <h4 style={{ margin: "0 0 8px 0", color: "#2E2E2E" }}>
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
  monthAxis,
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
            backgroundColor: ["#1F865A", "#F8992D", "#E5E0DA"],
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

  // Detect month columns from first data row
  const monthColumns = useMemo(() => {
    const cols = [];
    const sample = data[0] || {};
    for (let i = 0; i < 12; i++) {
      if (sample[`m${i}`] !== undefined) {
        const label = monthAxis && monthAxis[i] ? monthAxis[i] : `M${i + 1}`;
        cols.push({ key: `m${i}`, label });
      }
    }
    if (cols.length === 0) {
      // Fallback for legacy data with no m0-m11 fields
      cols.push({ key: "m0", label: monthAxis?.[0] || "M1" });
      cols.push({ key: "m1", label: monthAxis?.[1] || "M2" });
      cols.push({ key: "m2", label: monthAxis?.[2] || "M3" });
      cols.push({ key: "m3", label: monthAxis?.[3] || "M4" });
    }
    return cols;
  }, [data, monthAxis]);

  const totalLabel = monthColumns.length > 0 ? `${monthColumns.length}M CE` : "4M CE";

  const columns = [
    { key: "rank", label: "#" },
    { key: "acct", label: t("account") },
    { key: "dist", label: t("distributor") },
    { key: "st", label: "State" },
    { key: "ch", label: "Channel" },
    ...monthColumns,
    { key: "total", label: totalLabel },
    { key: "trend", label: "Trend" },
    { key: "growthPotential", label: "Growth Potential" },
  ];

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label={`Total ${t("account")}s`} value={data.length} />
        <KpiCard label={`Momentum ${t("account")}s`} value={momentumAccounts} />
        <KpiCard label="Growth Opportunity" value={growthAccounts} />
        <KpiCard label={`Consistent ${t("account")}s`} value={consistentAccounts} />
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
          <div className="table-title">{t("account")}s</div>
          <div className="table-controls">
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
                onClick={() => {
                  const mCols = monthColumns.map((c) => c.key);
                  const mHeaders = Object.fromEntries(monthColumns.map((c) => [c.key, c.label]));
                  exportToXlsx(tableData, "account-insights", "Accounts", {
                    columns: ["rank", "acct", "dist", "st", "ch", ...mCols, "total", "trend", "growthPotential"],
                    headers: { rank: "#", acct: t("account"), dist: t("distributor"), st: "State", ch: "Channel", ...mHeaders, total: totalLabel, trend: "Trend", growthPotential: "Growth Potential" },
                  });
                }}
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
                {monthColumns.map((col) => (
                  <td key={col.key}>{a[col.key] ? a[col.key].toFixed(1) : "-"}</td>
                ))}
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
                    color: "#6B6B6B",
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
              color: "#6B6B6B",
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
