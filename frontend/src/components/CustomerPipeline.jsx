/**
 * CustomerPipeline tab component
 * Extracted from index.html pipeline tab (lines 1641-1782, 6162-6502).
 * Shows KPIs, funnel, owner/tier breakdowns, filters, and pipeline table.
 */

import { useState, useMemo, useCallback } from "react";
import PipelineFunnel from "./PipelineFunnel";
import PipelineBreakdowns from "./PipelineBreakdowns";
import { matchesUserTerritory } from "../utils/territory";
import { formatCurrency, esc } from "../utils/formatting";
import TENANT_CONFIG from "../config/tenant";
import { t } from "../utils/terminology";
import { exportToXlsx } from "../utils/exportXlsx";

const STAGE_ORDER = [
  "Identified",
  "Outreach Sent",
  "Meeting Set",
  "RFP/Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const STAGE_WEIGHTS = {
  Identified: 0.05,
  "Outreach Sent": 0.1,
  "Meeting Set": 0.25,
  "RFP/Proposal": 0.5,
  Negotiation: 0.75,
  "Closed Won": 1.0,
  "Closed Lost": 0,
};

const STAGE_COLORS = {
  Identified: "#8B6A4C",
  "Outreach Sent": "#60a5fa",
  "Meeting Set": "#a78bfa",
  "RFP/Proposal": "#f59e0b",
  Negotiation: "#f97316",
  "Closed Won": "#10b981",
  "Closed Lost": "#DC2626",
};

const TIER_COLORS = {
  Enterprise: "#7C3AED",
  "On-Premise Natl": "#DC2626",
  Regional: "#2563EB",
  Emerging: "#6B6B6B",
};

function PipelineKpi({ label, value, borderColor, subtext }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: "#fff",
        borderRadius: 8,
        padding: "12px 16px",
        borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
        borderTop: "1px solid #e5e7eb",
        borderRight: "1px solid #e5e7eb",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontSize: 11, color: "#6B6B6B" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: borderColor || "#0F766E" }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: 10, color: "#9ca3af" }}>{subtext}</div>
      )}
    </div>
  );
}

export default function CustomerPipeline({
  pipelineAccounts = [],
  pipelineMeta = {},
  user,
  onAccountClick,
  onAddNew,
  onExportCSV,
  onExportXLSX,
}) {
  const [plFilters, setPlFilters] = useState({
    stage: "",
    tier: "",
    owner: "",
    type: "",
    channel: "",
    region: "",
    state: "",
  });
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("stage");
  const [sortDir, setSortDir] = useState("desc");

  const { regionMap } = TENANT_CONFIG;

  // Resolve all rows with meta overlay
  const allRows = useMemo(() => {
    return pipelineAccounts.map((a) => {
      const id = a.acct.replace(/[^a-zA-Z0-9]/g, "_");
      const meta = pipelineMeta[id] || {};
      const stage = meta.stage || a.stage;
      const w = STAGE_WEIGHTS[stage] || 0.05;
      const val =
        meta.customValue && meta.customValue > 0
          ? meta.customValue
          : a.estValue || 0;
      return {
        ...a,
        stage,
        estValue: val,
        weighted: Math.round(val * w),
        hasCustom: !!(meta.customValue && meta.customValue > 0),
        stageDate: meta.stageDate || a.stageDate || "2026-02-15",
        owner: meta.owner || a.owner,
        source: meta.source || a.source,
        tier: meta.tier || a.tier,
        type: meta.type || a.type,
        channel: meta.channel || a.channel || "",
        state: meta.state || a.state || "",
        nextStep: meta.nextStep || "",
        dueDate: meta.dueDate || "",
        notes: meta.notes || "",
      };
    });
  }, [pipelineAccounts, pipelineMeta]);

  // KPIs (computed before filtering)
  const open = allRows.filter(
    (r) => r.stage !== "Closed Won" && r.stage !== "Closed Lost"
  );
  const won = allRows.filter((r) => r.stage === "Closed Won");
  const lost = allRows.filter((r) => r.stage === "Closed Lost");
  const totalOpen = open.reduce((s, r) => s + r.estValue, 0);
  const totalWeighted = open.reduce((s, r) => s + r.weighted, 0);
  const totalWon = won.reduce((s, r) => s + r.estValue, 0);
  const totalLost = lost.reduce((s, r) => s + r.estValue, 0);
  const rfpPlus = allRows.filter((r) =>
    ["RFP/Proposal", "Negotiation", "Closed Won"].includes(r.stage)
  );
  const enterpriseInPlay = allRows.filter(
    (r) =>
      r.tier === "Enterprise" &&
      r.stage !== "Closed Won" &&
      r.stage !== "Closed Lost"
  ).length;

  // Owner options for filter
  const ownerOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.owner).filter(Boolean))].sort(),
    [allRows]
  );

  // State options (territory-restricted)
  const stateOptions = useMemo(() => {
    const states = new Set();
    allRows.forEach((r) => {
      if (r.state) states.add(r.state);
    });
    return [...states]
      .filter((st) => {
        if (
          user &&
          user.role !== "admin" &&
          !matchesUserTerritory(st, user)
        )
          return false;
        if (plFilters.region && regionMap[st] !== plFilters.region) return false;
        return true;
      })
      .sort();
  }, [allRows, user, plFilters.region, regionMap]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (plFilters.stage) rows = rows.filter((r) => r.stage === plFilters.stage);
    if (plFilters.tier) rows = rows.filter((r) => r.tier === plFilters.tier);
    if (plFilters.owner) rows = rows.filter((r) => r.owner === plFilters.owner);
    if (plFilters.type) rows = rows.filter((r) => (r.type || "Chain") === plFilters.type);
    if (plFilters.channel) rows = rows.filter((r) => r.channel === plFilters.channel);
    if (plFilters.region) rows = rows.filter((r) => r.state && regionMap[r.state] === plFilters.region);
    if (plFilters.state) rows = rows.filter((r) => r.state === plFilters.state);
    if (user && user.role !== "admin") {
      rows = rows.filter((r) => matchesUserTerritory(r.state, user));
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.acct.toLowerCase().includes(q) ||
          (r.owner || "").toLowerCase().includes(q) ||
          (r.source || "").toLowerCase().includes(q) ||
          (r.nextStep || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, plFilters, search, user, regionMap]);

  // Sort
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const today = new Date();
    const stageIdx = (s) => STAGE_ORDER.indexOf(s);
    const tierIdx = (t) =>
      ["Enterprise", "On-Premise Natl", "Regional", "Emerging"].indexOf(t);
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      if (sortCol === "stage")
        return (
          dir * (stageIdx(a.stage) - stageIdx(b.stage)) ||
          b.estValue - a.estValue
        );
      if (sortCol === "value") return dir * (a.estValue - b.estValue);
      if (sortCol === "weighted") return dir * (a.weighted - b.weighted);
      if (sortCol === "tier")
        return (
          dir * (tierIdx(a.tier) - tierIdx(b.tier)) ||
          b.estValue - a.estValue
        );
      if (sortCol === "owner")
        return (
          dir * (a.owner || "").localeCompare(b.owner || "") ||
          b.estValue - a.estValue
        );
      if (sortCol === "acct")
        return dir * a.acct.localeCompare(b.acct);
      if (sortCol === "due")
        return dir * (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      if (sortCol === "days") {
        const da = Math.floor(
          (today - new Date(a.stageDate || "2026-02-15")) / 86400000
        );
        const db = Math.floor(
          (today - new Date(b.stageDate || "2026-02-15")) / 86400000
        );
        return dir * (da - db);
      }
      return 0;
    });
    return copy;
  }, [filteredRows, sortCol, sortDir]);

  const handleSort = useCallback(
    (col) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir(col === "value" || col === "weighted" || col === "stage" ? "desc" : "asc");
      }
    },
    [sortCol]
  );

  const updateFilter = useCallback((key, value) => {
    setPlFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date();

  // Empty state
  if (!pipelineAccounts || pipelineAccounts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128200;</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          No Pipeline Accounts
        </div>
        <div style={{ fontSize: 14 }}>
          Add accounts from the Accounts view or upload data to populate your pipeline.
        </div>
      </div>
    );
  }

  const sortIndicator = (col) =>
    sortCol === col ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  const filterSelect = (label, key, options) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B" }}>
        {label}:
      </label>
      <select
        value={plFilters[key]}
        onChange={(e) => updateFilter(key, e.target.value)}
        style={{
          padding: "6px 10px",
          border: "1px solid #E5E0DA",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      {/* Title */}
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0F766E", marginBottom: 4 }}>
        Customer Pipeline{" "}
        <span style={{ fontSize: 13, fontWeight: 400, color: "#6B6B6B", marginLeft: 8 }}>
          National &amp; Regional Account Tracker
        </span>
      </div>

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <PipelineKpi label="Total Accounts" value={allRows.length} />
        <PipelineKpi label="Open Pipeline" value={formatCurrency(totalOpen)} borderColor="#2563EB" subtext="unweighted" />
        <PipelineKpi label="Weighted Pipeline" value={formatCurrency(totalWeighted)} borderColor="#7C3AED" subtext="probability-adjusted" />
        <PipelineKpi label="Closed Won" value={formatCurrency(totalWon)} borderColor="#10b981" subtext={`${won.length} accounts`} />
        <PipelineKpi label="RFP+ Active" value={rfpPlus.length} borderColor="#f59e0b" />
        {lost.length > 0 && (
          <PipelineKpi label="Closed Lost" value={formatCurrency(totalLost)} borderColor="#DC2626" subtext={`${lost.length} accounts`} />
        )}
        <PipelineKpi label="Enterprise in Play" value={enterpriseInPlay} />
      </div>

      {/* Funnel */}
      <PipelineFunnel rows={allRows} />

      {/* Owner + Tier Breakdowns */}
      <PipelineBreakdowns rows={allRows} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {filterSelect("Stage", "stage", [
          { value: "", label: "All Stages" },
          ...STAGE_ORDER.map((s) => ({ value: s, label: s })),
        ])}
        {filterSelect("Region", "region", [
          { value: "", label: "All Regions" },
          { value: "East", label: "East" },
          { value: "West", label: "West" },
        ])}
        {filterSelect("State", "state", [
          { value: "", label: "All States" },
          ...stateOptions.map((s) => ({ value: s, label: s })),
        ])}
        {filterSelect("Tier", "tier", [
          { value: "", label: "All Tiers" },
          { value: "Enterprise", label: "Enterprise" },
          { value: "On-Premise Natl", label: "On-Premise Natl" },
          { value: "Regional", label: "Regional" },
          { value: "Emerging", label: "Emerging" },
        ])}
        {filterSelect("Owner", "owner", [
          { value: "", label: "All Owners" },
          ...ownerOptions.map((o) => ({ value: o, label: o })),
        ])}
        {filterSelect("Type", "type", [
          { value: "", label: "All Types" },
          { value: "Chain", label: "Chain Accounts" },
          { value: "Distributor", label: `${t("distributor")} Partners` },
        ])}
        {filterSelect("Channel", "channel", [
          { value: "", label: "All Channels" },
          { value: "On-Premise", label: "On-Premise" },
          { value: "Off-Premise", label: "Off-Premise" },
        ])}
        {onAddNew && (
          <button
            onClick={onAddNew}
            style={{
              padding: "6px 14px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add New
          </button>
        )}
      </div>

      {/* Search + Export */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E5E0DA",
              borderRadius: 8,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
        {onExportCSV && (
          <button onClick={onExportCSV} style={{ padding: "6px 14px", background: "#2E2E2E", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export CSV
          </button>
        )}
        {onExportXLSX && (
          <button onClick={() => exportToXlsx(sortedRows, "customer-pipeline", "Pipeline", {
            columns: ["acct", "tier", "stage", "owner", "source", "estValue", "weighted", "nextStep", "dueDate", "notes"],
            headers: { acct: t("account"), tier: "Tier", stage: "Stage", owner: "Owner", source: "Source", estValue: "Est. Value", weighted: "Weighted", nextStep: "Next Step", dueDate: "Due Date", notes: "Notes" },
          })} style={{ padding: "6px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export Excel
          </button>
        )}
      </div>

      {/* Pipeline Table */}
      <div style={{ maxHeight: 600, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 2 }}>
            <tr>
              {[
                { key: "acct", label: t("account"), align: "left" },
                { key: "tier", label: "Tier", align: "center" },
                { key: "stage", label: "Stage", align: "center" },
                { key: "days", label: "Days", align: "center" },
                { key: "owner", label: "Owner", align: "left" },
                { key: null, label: "Source", align: "left" },
                { key: "value", label: "Est. Value", align: "right" },
                { key: "weighted", label: "Weighted", align: "right" },
                { key: null, label: "Next Step", align: "left" },
                { key: "due", label: "Due", align: "center" },
                { key: null, label: "Notes", align: "center" },
              ].map((col, i) => (
                <th
                  key={i}
                  onClick={col.key ? () => handleSort(col.key) : undefined}
                  style={{
                    padding: "8px 12px",
                    textAlign: col.align,
                    borderBottom: "2px solid #e2e8f0",
                    cursor: col.key ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {col.label}
                  {col.key && (
                    <span style={{ fontSize: 10 }}>
                      {sortIndicator(col.key)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => {
              const isOverdue = r.dueDate && r.dueDate < todayStr;
              const distBadge =
                r.type === "Distributor" ? (
                  <span
                    style={{
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      padding: "1px 6px",
                      borderRadius: 8,
                      fontSize: 9,
                      fontWeight: 600,
                      marginLeft: 4,
                    }}
                  >
                    Dist
                  </span>
                ) : null;
              const stageDate = r.stageDate
                ? new Date(r.stageDate)
                : new Date("2026-02-15");
              const daysSinceStage = Math.floor(
                (today - stageDate) / 86400000
              );
              let daysColor = "#059669";
              if (daysSinceStage > 30) daysColor = "#DC2626";
              else if (daysSinceStage > 14) daysColor = "#D97706";

              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #FDF8F0",
                    cursor: "pointer",
                  }}
                  onClick={() => onAccountClick?.(r.acct)}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: "#0F766E",
                    }}
                  >
                    {esc(r.acct)}
                    {distBadge}
                  </td>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#fff",
                        background: TIER_COLORS[r.tier] || "#6B6B6B",
                      }}
                    >
                      {esc(r.tier)}
                    </span>
                  </td>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#fff",
                        background: STAGE_COLORS[r.stage] || "#8B6A4C",
                      }}
                    >
                      {esc(r.stage)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: 8,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: daysColor,
                    }}
                  >
                    {daysSinceStage}
                  </td>
                  <td style={{ padding: 8, fontSize: 12 }}>
                    {esc(r.owner)}
                  </td>
                  <td style={{ padding: 8, fontSize: 12, color: "#6B6B6B" }}>
                    {esc(r.source || "--")}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(r.estValue)}
                    {r.hasCustom && (
                      <span
                        style={{
                          color: "#10b981",
                          fontSize: 9,
                          marginLeft: 2,
                        }}
                      >
                        *
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      textAlign: "right",
                      color: "#7C3AED",
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(r.weighted)}
                  </td>
                  <td style={{ padding: 8, fontSize: 11 }}>
                    {r.nextStep ? (
                      esc(r.nextStep)
                    ) : (
                      <span style={{ color: "#E5E0DA" }}>--</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      textAlign: "center",
                      fontSize: 11,
                      ...(isOverdue
                        ? { color: "#DC2626", fontWeight: 700 }
                        : {}),
                    }}
                  >
                    {r.dueDate ? esc(r.dueDate) : "--"}
                  </td>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    {r.notes ? (
                      <span
                        style={{
                          background: "#EEF2FF",
                          color: "#4338CA",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        Yes
                      </span>
                    ) : (
                      "--"
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#64748b",
                  }}
                >
                  No accounts match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#6B6B6B" }}>
        Showing {sortedRows.length} accounts |{" "}
        {formatCurrency(
          sortedRows.reduce((s, r) => s + r.estValue, 0)
        )}{" "}
        total value
      </div>
    </div>
  );
}
