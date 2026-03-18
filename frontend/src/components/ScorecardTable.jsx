/**
 * ScorecardTable component
 * Extracted from index.html renderDepletions() scorecard table (lines 3890-3949).
 * Paginated, sortable distributor scorecard with expandable group rows.
 */

import { useState, useMemo, useCallback } from "react";
import {
  getStageBadge,
  getMomentumBadge,
  getVelTrendIndicator,
  getSellThruColor,
} from "../utils/badges";
import { t } from "../utils/terminology";
import { exportToXlsx } from "../utils/exportXlsx";

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "name", label: () => t("distributor") },
  { key: "st", label: () => "State" },
  { key: "ce", label: () => `${t("longPeriod")} ${t("volume")}`, numeric: true },
  { key: "momentum", label: () => "Momentum" },
  { key: "w4", label: () => `${t("shortPeriod")} ${t("volume")}`, numeric: true },
  { key: "w4trend", label: () => `${t("shortPeriod")} Trend` },
  { key: "oh", label: () => "On Hand", numeric: true },
  { key: "doh", label: () => "DOH", numeric: true },
  { key: "net", label: () => "Net Placements", numeric: true },
  { key: "velTrend", label: () => "Trend" },
  { key: "sellThru", label: () => "Sell-Thru", numeric: true },
  { key: "conLabel", label: () => "Stage" },
];

function MomentumBadge({ value }) {
  const b = getMomentumBadge(value);
  return <span className={b.className}>{b.text}</span>;
}

function StageBadge({ value }) {
  const b = getStageBadge(value);
  return <span className={b.className}>{b.text}</span>;
}

function VelTrend({ value }) {
  const ind = getVelTrendIndicator(value || "flat");
  return (
    <span style={{ color: ind.color, fontWeight: 700, fontSize: ind.fontSize }}>
      {ind.symbol}
    </span>
  );
}

function SellThru({ value }) {
  const pct = value || 0;
  return (
    <span style={{ color: getSellThruColor(pct), fontWeight: 600 }}>
      {pct}%
    </span>
  );
}

function DataRow({ row, onDrillIn }) {
  return (
    <tr>
      <td>
        <span
          style={{ cursor: "pointer", textDecoration: "underline", color: "#6B1E1E" }}
          onClick={() => onDrillIn?.(row.name)}
        >
          {row.name}
        </span>
      </td>
      <td>{row.st}</td>
      <td><strong>{(row.ce || 0).toFixed(1)}</strong></td>
      <td><MomentumBadge value={row.momentum} /></td>
      <td><strong>{(row.w4 || 0).toFixed(1)}</strong></td>
      <td><MomentumBadge value={row.w4trend} /></td>
      <td>{(row.oh || 0).toFixed(1)}</td>
      <td>{Math.round(row.doh || 0)}</td>
      <td>{row.net}</td>
      <td style={{ textAlign: "center" }}><VelTrend value={row.velTrend} /></td>
      <td><SellThru value={row.sellThru} /></td>
      <td><StageBadge value={row.conLabel} /></td>
    </tr>
  );
}

function GroupRow({ row, onDrillIn }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr style={{ backgroundColor: "#F5EDE3", fontWeight: 600 }}>
        <td>
          <span
            style={{ cursor: "pointer", color: "#8B6A4C", fontSize: 12, marginRight: 4 }}
            onClick={() => setExpanded(!expanded)}
            title="Show warehouses"
          >
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
          <span
            style={{ cursor: "pointer", textDecoration: "underline", color: "#6B1E1E" }}
            onClick={() => onDrillIn?.(row.name)}
          >
            {row.name}
          </span>{" "}
          <span style={{ fontSize: 10, color: "#6B6B6B", fontWeight: 400 }}>
            ({row.children.length} locations)
          </span>
        </td>
        <td>{row.st}</td>
        <td><strong>{(row.ce || 0).toFixed(1)}</strong></td>
        <td><MomentumBadge value={row.momentum} /></td>
        <td><strong>{(row.w4 || 0).toFixed(1)}</strong></td>
        <td><MomentumBadge value={row.w4trend} /></td>
        <td>{(row.oh || 0).toFixed(1)}</td>
        <td>{Math.round(row.doh || 0)}</td>
        <td>{row.net}</td>
        <td style={{ textAlign: "center" }}><VelTrend value={row.velTrend} /></td>
        <td><SellThru value={row.sellThru} /></td>
        <td><StageBadge value={row.conLabel} /></td>
      </tr>
      {expanded &&
        row.children.map((child, ci) => (
          <tr
            key={ci}
            style={{
              backgroundColor: "#FDF8F0",
              fontSize: 12,
              borderLeft: "3px solid #8B6A4C",
            }}
          >
            <td style={{ padding: "4px 10px 4px 28px", borderBottom: "1px solid #E5E0DA" }}>{child.name}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{child.st}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{(child.ce || 0).toFixed(1)}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}><MomentumBadge value={child.momentum} /></td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{(child.w4 || 0).toFixed(1)}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}><MomentumBadge value={child.w4trend} /></td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{(child.oh || 0).toFixed(1)}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{Math.round(child.doh || 0)}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}>{child.net}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA", textAlign: "center" }}><VelTrend value={child.velTrend} /></td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}><SellThru value={child.sellThru} /></td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #E5E0DA" }}><StageBadge value={child.conLabel} /></td>
          </tr>
        ))}
    </>
  );
}

export default function ScorecardTable({ data = [], onDrillIn, onExport }) {
  const [sortCol, setSortCol] = useState("ce");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

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

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title">{t("distributor")} Scorecard</div>
        <div className="table-controls">
          {onExport && (
            <button className="btn btn-secondary btn-small" onClick={() => exportToXlsx(sorted, "distributor-scorecard", "Scorecard", {
              columns: ["name", "st", "ce", "momentum", "w4", "w4trend", "oh", "doh", "net", "velTrend", "sellThru", "conLabel"],
              headers: { name: t("distributor"), st: "State", ce: `${t("longPeriod")} ${t("volume")}`, momentum: "Momentum", w4: `${t("shortPeriod")} ${t("volume")}`, w4trend: `${t("shortPeriod")} Trend`, oh: "On Hand", doh: "DOH", net: "Net Placements", velTrend: "Trend", sellThru: "Sell-Thru", conLabel: "Stage" },
            })}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="sortable"
                onClick={() => handleSort(col.key)}
                style={{ cursor: "pointer" }}
              >
                {col.label()}
                <span className="sort-indicator">
                  {sortCol === col.key ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageData.map((row, i) =>
            row.isGroup && row.children ? (
              <GroupRow key={i} row={row} index={i} onDrillIn={onDrillIn} />
            ) : (
              <DataRow key={i} row={row} onDrillIn={onDrillIn} />
            )
          )}
          {pageData.length === 0 && (
            <tr>
              <td colSpan={12} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                No {t("distributor").toLowerCase()} data available.
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
  );
}
