/**
 * DistributorHealth tab component
 * Extracted from index.html Distributor Health tab (lines 1266-1369, 3970-4156).
 * Dropdown to select a distributor, then shows KPIs, charts, and inventory table.
 */

import { useState, useMemo } from "react";
import KpiCard from "./KpiCard";
import ChartPanel from "./ChartPanel";
import AccountPenetration from "./AccountPenetration";
import HealthInventoryTable from "./HealthInventoryTable";
import { matchesUserTerritory } from "../utils/territory";
import { t } from "../utils/terminology";
import TENANT_CONFIG from "../config/tenant";

export default function DistributorHealth({
  distHealth = [],
  distScorecard = [],
  user,
  filters,
  initialDistributor = "",
}) {
  const [selectedDist, setSelectedDist] = useState(initialDistributor);

  // Build distributor list filtered by territory / region / state
  const distributorOptions = useMemo(() => {
    const { regionMap } = TENANT_CONFIG;
    const distStateMap = {};
    distScorecard.forEach((d) => {
      distStateMap[d.name] = d.st;
    });

    const uniqueDists = [...new Set(distHealth.map((d) => d.dist))];

    return uniqueDists.filter((dist) => {
      const st = distStateMap[dist] || "";
      if (user && user.role !== "admin" && st && !matchesUserTerritory(st, user))
        return false;
      if (filters.region && regionMap[st] !== filters.region) return false;
      if (filters.state && st !== filters.state) return false;
      return true;
    });
  }, [distHealth, distScorecard, user, filters]);

  // Reset selection if the selected distributor is no longer visible
  const effectiveDist = distributorOptions.includes(selectedDist)
    ? selectedDist
    : "";

  // Find health data for selected distributor
  const h = effectiveDist
    ? distHealth.find((d) => d.dist === effectiveDist)
    : null;

  // --- Chart configs ---
  const skuChartConfig = useMemo(() => {
    if (!h) return null;
    return {
      type: "bar",
      data: {
        labels: h.skus.map((s) => s.w),
        datasets: [
          {
            label: "Sell-In (4M)",
            data: h.skus.map((s) => s.sellIn),
            backgroundColor: "rgba(52,152,219,0.7)",
            borderRadius: 4,
          },
          {
            label: `Sell-Through (${t("longPeriod")})`,
            data: h.skus.map((s) => s.sellThru),
            backgroundColor: "rgba(46,204,113,0.7)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 11 } } },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Case Equivalents" },
          },
        },
      },
    };
  }, [h]);

  const monthlyChartConfig = useMemo(() => {
    if (!h) return null;
    return {
      type: "bar",
      data: {
        labels: ["Nov", "Dec", "Jan", "Feb"],
        datasets: [
          {
            label: "Distributor Purchases (CE)",
            data: [h.nov || 0, h.dec || 0, h.jan || 0, h.feb || 0],
            backgroundColor: [
              "rgba(155,89,182,0.7)",
              "rgba(52,152,219,0.7)",
              "rgba(46,204,113,0.7)",
              "rgba(241,196,15,0.7)",
            ],
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "CE" } },
        },
      },
    };
  }, [h]);

  const totalOH = h ? h.skus.reduce((sum, s) => sum + (s.oh || 0), 0) : 0;

  return (
    <div>
      {/* Distributor Selector */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Select Distributor</label>
          <select
            className="dropdown-select"
            value={effectiveDist}
            onChange={(e) => setSelectedDist(e.target.value)}
          >
            <option value="">-- Choose a distributor --</option>
            {distributorOptions.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Health detail (visible only when a distributor is selected) */}
      {h && (
        <>
          {/* KPI Row */}
          <div className="kpi-row">
            <KpiCard
              label="Sell-In (4M)"
              value={`${(h.totalSellIn || 0).toFixed(1)} CE`}
            />
            <KpiCard
              label={`Sell-Through (${t("longPeriod")})`}
              value={`${(h.totalSellThru || 0).toFixed(1)} CE`}
            />
            <KpiCard
              label="Pull-Through Rate"
              value={`${h.totalRatio || 0}%`}
            />
            <KpiCard
              label="Active Accounts"
              value={`${h.activeAccounts || 0} / ${h.totalAccounts || 0}`}
            />
          </div>

          {/* Sell-In vs Sell-Through by SKU chart */}
          <div className="table-container" style={{ marginTop: 16 }}>
            <div className="table-header">
              <div className="table-title">
                Sell-In vs Sell-Through by Product
              </div>
            </div>
            <div style={{ height: 280, padding: 12 }}>
              {skuChartConfig && <ChartPanel chartConfig={skuChartConfig} />}
            </div>
          </div>

          {/* Two-column: Monthly Pattern + Account Penetration */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 16,
            }}
          >
            {/* Monthly Purchasing Pattern */}
            <div className="table-container">
              <div className="table-header">
                <div className="table-title">
                  Monthly Purchasing Pattern ({t("volume")})
                </div>
              </div>
              <div style={{ height: 240, padding: 12 }}>
                {monthlyChartConfig && (
                  <ChartPanel chartConfig={monthlyChartConfig} />
                )}
              </div>
            </div>

            {/* Account Penetration */}
            <AccountPenetration
              totalAccounts={h.totalAccounts || 0}
              avgSkuBreadth={h.avgSkuBreadth || 0}
              established={h.established || 0}
              building={h.building || 0}
              emerging={h.emerging || 0}
              newAccts={h.newAccts || 0}
              lostAccts={h.lostAccts || 0}
            />
          </div>

          {/* Inventory Coverage Table */}
          <HealthInventoryTable
            skus={h.skus || []}
            totalSellIn={h.totalSellIn}
            totalSellThru={h.totalSellThru}
            totalRatio={h.totalRatio}
            totalOH={totalOH}
            doh={h.doh}
          />
        </>
      )}

      {/* Empty state when no distributor selected */}
      {!h && distributorOptions.length > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128202;</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 8,
            }}
          >
            Select a Distributor
          </div>
          <div style={{ fontSize: 14 }}>
            Choose a distributor above to see their health metrics, inventory
            coverage, and account penetration.
          </div>
        </div>
      )}

      {/* No distributors available */}
      {distributorOptions.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128230;</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 8,
            }}
          >
            No Distributor Data
          </div>
          <div style={{ fontSize: 14 }}>
            Upload distributor health data to populate this view.
          </div>
        </div>
      )}
    </div>
  );
}
