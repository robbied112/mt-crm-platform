/**
 * GoalProgress component
 * Extracted from index.html renderMyTerritory() goal progress section (lines 3388-3428).
 * Renders progress bars toward configured annual/quarterly goals.
 */

import { t } from "../utils/terminology";

function GoalBar({ label, current, target, unit, color }) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((current / target) * 100));
  const barColor =
    pct >= 100 ? "#059669" : pct >= 75 ? color : pct >= 50 ? "#D97706" : "#DC2626";
  const fmt = (n) =>
    n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toLocaleString();

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {fmt(current)} / {fmt(target)} {unit}
        </span>
      </div>
      <div
        style={{
          background: "#E5E7EB",
          borderRadius: 6,
          height: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: barColor,
            height: "100%",
            borderRadius: 6,
            width: `${pct}%`,
            transition: "width 0.5s",
          }}
        />
      </div>
      <div
        style={{
          textAlign: "right",
          fontSize: 11,
          color: barColor,
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

export default function GoalProgress({
  goals,
  totalCE,
  totalAccounts,
  totalRevenue,
  uniqueStates,
  activeDists,
  newWinsCount,
}) {
  if (
    !goals ||
    (!goals.annualVolume &&
      !goals.totalAccounts &&
      !goals.annualRevenue &&
      !goals.totalStates)
  ) {
    return null;
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#374151" }}>
          Goal Progress
        </h3>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Set in Settings</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 24px",
        }}
      >
        <GoalBar
          label="Annual Volume"
          current={totalCE}
          target={goals.annualVolume}
          unit="cases"
          color="#0F766E"
        />
        <GoalBar
          label="Total Accounts"
          current={totalAccounts}
          target={goals.totalAccounts}
          unit=""
          color="#2563EB"
        />
        <GoalBar
          label="Annual Revenue"
          current={totalRevenue}
          target={goals.annualRevenue}
          unit="$"
          color="#059669"
        />
        <GoalBar
          label="Distribution (States)"
          current={uniqueStates}
          target={goals.totalStates}
          unit=""
          color="#7C3AED"
        />
        <GoalBar
          label={`Active ${t("distributor")}s`}
          current={activeDists}
          target={goals.totalDistributors}
          unit=""
          color="#D97706"
        />
        <GoalBar
          label="New Accounts (Q)"
          current={newWinsCount}
          target={goals.newAccountsPerQuarter}
          unit=""
          color="#0EA5E9"
        />
      </div>
    </div>
  );
}
