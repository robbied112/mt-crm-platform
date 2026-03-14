/**
 * Opportunities tab component
 * Extracted from index.html renderOpportunities() (lines 4535-4618)
 * and HTML (lines 1505-1571).
 * Shows KPIs, re-engagement table, new wins table, and net placement chart.
 */

import { useMemo } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import { getFilteredData } from "../utils/filterData";
import { esc } from "../utils/formatting";
import { t } from "../utils/terminology";

export default function Opportunities({
  reEngagementData = [],
  newWins = [],
  placementSummary = [],
  filters,
  user,
  onAccountClick,
}) {
  const reEngData = useMemo(
    () => getFilteredData(reEngagementData, filters, user),
    [reEngagementData, filters, user]
  );
  const newWinsData = useMemo(
    () => getFilteredData(newWins, filters, user),
    [newWins, filters, user]
  );
  const placementData = useMemo(
    () => getFilteredData(placementSummary, filters, user),
    [placementSummary, filters, user]
  );

  // --- KPIs ---
  const reEngAccounts = reEngData.reduce(
    (sum, d) => sum + (d.priorAccts || 0),
    0
  );
  const newWinsCount = newWinsData.length;
  const netDoors = placementData.reduce((sum, d) => sum + (d.net || 0), 0);
  const totalOppCE = (
    reEngData.reduce((sum, d) => sum + (d.priorCE || 0), 0) +
    newWinsData.reduce((sum, d) => sum + (d.ce || 0), 0)
  ).toFixed(1);

  // --- Net placement chart ---
  const placementChartConfig = useMemo(() => {
    const topPlacement = [...placementData]
      .sort((a, b) => (b.net || 0) - (a.net || 0))
      .slice(0, 10);

    return {
      type: "bar",
      data: {
        labels: topPlacement.map((d) => (d.name || "").substring(0, 20)),
        datasets: [
          {
            label: "New Placements",
            data: topPlacement.map((d) => d.newA || 0),
            backgroundColor: "#0D9F6E",
          },
          {
            label: "Re-engagement",
            data: topPlacement.map((d) => d.reEngageA || 0),
            backgroundColor: "#2563EB",
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, stacked: false } },
        plugins: { legend: { position: "top" } },
      },
    };
  }, [placementData]);

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-row">
        <KpiCard label="Re-Engagement Targets" value={reEngAccounts} />
        <KpiCard label="New Wins (30D)" value={newWinsCount} />
        <KpiCard label="Net Doors" value={Math.round(netDoors)} />
        <KpiCard label="Total Opportunity CE" value={totalOppCE} />
      </div>

      {/* Re-Engagement Table */}
      <div className="section-header">
        <h3>Re-Engagement Opportunities</h3>
        <p>
          {t("reEngageDescription")}
        </p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("distributor")}</th>
              <th>State</th>
              <th>{t("account")}s to Re-engage</th>
              <th>Prior Volume (CE)</th>
            </tr>
          </thead>
          <tbody>
            {reEngData.map((d, i) => (
              <tr key={i}>
                <td>
                  <span
                    className="acct-clickable"
                    onClick={() => onAccountClick?.(d.name)}
                  >
                    {esc(d.name)}
                  </span>
                </td>
                <td>{esc(d.st)}</td>
                <td>{d.priorAccts}</td>
                <td>{(d.priorCE || 0).toFixed(1)}</td>
              </tr>
            ))}
            {reEngData.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#64748b",
                  }}
                >
                  No re-engagement opportunities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Wins Table */}
      <div className="section-header">
        <h3>New Wins</h3>
        <p>
          {t("newWinsDescription")}
        </p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("account")}</th>
              <th>{t("distributor")}</th>
              <th>State</th>
              <th>30D CE</th>
              <th>SKUs</th>
            </tr>
          </thead>
          <tbody>
            {newWinsData.map((w, i) => (
              <tr key={i}>
                <td>
                  <span
                    className="acct-clickable"
                    onClick={() => onAccountClick?.(w.acct)}
                  >
                    {esc(w.acct)}
                  </span>
                </td>
                <td>{esc(w.dist)}</td>
                <td>{esc(w.st)}</td>
                <td>{(w.ce || 0).toFixed(1)}</td>
                <td>{w.skus}</td>
              </tr>
            ))}
            {newWinsData.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#64748b",
                  }}
                >
                  No new wins in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Net Placement Chart */}
      <div style={{ marginTop: 25 }}>
        <ChartPanel
          title={t("netPlacementTitle")}
          chartConfig={placementChartConfig}
        />
      </div>
    </div>
  );
}
