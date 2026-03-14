/**
 * AccountPenetration component
 * Extracted from index.html distributor health account penetration panel (lines 1320-1345).
 * Shows total accounts, avg product count, penetration chart, and new/lost summary.
 */

import ChartPanel from "./ChartPanel";
import { t } from "../utils/terminology";

export default function AccountPenetration({
  totalAccounts = 0,
  avgSkuBreadth = 0,
  established = 0,
  building = 0,
  emerging = 0,
  newAccts = 0,
  lostAccts = 0,
}) {
  const hasData = established + building + emerging > 0;

  const penetrationConfig = {
    type: "doughnut",
    data: {
      labels: ["Established", "Building", "Emerging"],
      datasets: [
        {
          data: hasData ? [established, building, emerging] : [1],
          backgroundColor: hasData
            ? ["#27ae60", "#3498db", "#f39c12"]
            : ["#ecf0f1"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, padding: 8 },
        },
      },
    },
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title">{t("account")} Penetration</div>
      </div>
      <div style={{ padding: 16 }}>
        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 12,
              background: "#f8f9fa",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "#2c3e50" }}>
              {totalAccounts}
            </div>
            <div style={{ fontSize: 11, color: "#7f8c8d" }}>Total {t("account")}s</div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: 12,
              background: "#f8f9fa",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "#2c3e50" }}>
              {avgSkuBreadth}
            </div>
            <div style={{ fontSize: 11, color: "#7f8c8d" }}>
              Avg Product Count
            </div>
          </div>
        </div>

        {/* Penetration chart */}
        <div style={{ height: 140, padding: "0 12px" }}>
          <ChartPanel chartConfig={penetrationConfig} />
        </div>

        {/* New / Lost / Net summary */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            padding: "8px 12px",
            background: "#f8f9fa",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <span style={{ color: "#27ae60" }}>+{newAccts} New Wins</span>
          <span style={{ color: "#e67e22" }}>{lostAccts} Re-Engage Opps</span>
          <span style={{ fontWeight: 600, color: "#2c3e50" }}>
            Net: {newAccts - lostAccts}
          </span>
        </div>
      </div>
    </div>
  );
}
