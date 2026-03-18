/**
 * PipelineBreakdowns component
 * Extracted from index.html renderPipeline() owner/tier sections (lines 6421-6444).
 * Side-by-side tables showing pipeline by owner and by tier.
 */

import { formatCurrency } from "../utils/formatting";

const TIER_COLORS = {
  Enterprise: "#B87333",
  "On-Premise Natl": "#C53030",
  Regional: "#8B6A4C",
  Emerging: "#6B6B6B",
};

const TIER_ORDER = ["Enterprise", "On-Premise Natl", "Regional", "Emerging"];

function BreakdownTable({ title, data, showTierBadge = false }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: 16,
        border: "1px solid #E5E0DA",
      }}
    >
      <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#6B1E1E" }}>
        {title}
      </h4>
      <table
        style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #E5E0DA" }}>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>
              {showTierBadge ? "Tier" : "Owner"}
            </th>
            <th style={{ textAlign: "center", padding: 4 }}>Accts</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>
              Pipeline
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>
              Weighted
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(([key, d]) => (
            <tr key={key} style={{ borderBottom: "1px solid #E5E0DA" }}>
              <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                {showTierBadge ? (
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#fff",
                      background: TIER_COLORS[key] || "#6B6B6B",
                    }}
                  >
                    {key}
                  </span>
                ) : (
                  key
                )}
              </td>
              <td style={{ textAlign: "center" }}>{d.count}</td>
              <td style={{ textAlign: "right", padding: "6px 8px" }}>
                {formatCurrency(d.value)}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  color: "#B87333",
                }}
              >
                {formatCurrency(d.weighted)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PipelineBreakdowns({ rows = [] }) {
  // Owner breakdown (exclude Closed Won)
  const ownerMap = {};
  rows
    .filter((r) => r.stage !== "Closed Won")
    .forEach((r) => {
      const o = r.owner || "Unassigned";
      if (!ownerMap[o]) ownerMap[o] = { count: 0, value: 0, weighted: 0 };
      ownerMap[o].count++;
      ownerMap[o].value += r.estValue || 0;
      ownerMap[o].weighted += r.weighted || 0;
    });
  const ownerData = Object.entries(ownerMap).sort(
    (a, b) => b[1].value - a[1].value
  );

  // Tier breakdown (exclude Closed Won)
  const tierMap = {};
  rows
    .filter((r) => r.stage !== "Closed Won")
    .forEach((r) => {
      const t = r.tier || "Other";
      if (!tierMap[t]) tierMap[t] = { count: 0, value: 0, weighted: 0 };
      tierMap[t].count++;
      tierMap[t].value += r.estValue || 0;
      tierMap[t].weighted += r.weighted || 0;
    });
  const tierData = TIER_ORDER.map((tier) => [
    tier,
    tierMap[tier] || { count: 0, value: 0, weighted: 0 },
  ]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 20,
      }}
    >
      <BreakdownTable title="By Owner" data={ownerData} />
      <BreakdownTable
        title="By Tier"
        data={tierData}
        showTierBadge
      />
    </div>
  );
}
