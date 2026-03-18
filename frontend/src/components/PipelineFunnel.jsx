/**
 * PipelineFunnel component
 * Extracted from index.html renderPipeline() funnel section (lines 6405-6419).
 * Visual funnel showing account count and value per stage.
 */

import { formatCurrency } from "../utils/formatting";

const STAGE_ORDER = [
  "Identified",
  "Outreach Sent",
  "Meeting Set",
  "RFP/Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const STAGE_COLORS = {
  Identified: "#6B6B6B",
  "Outreach Sent": "#8B6A4C",
  "Meeting Set": "#8B6A4C",
  "RFP/Proposal": "#C07B01",
  Negotiation: "#B87333",
  "Closed Won": "#1F865A",
  "Closed Lost": "#C53030",
};

export default function PipelineFunnel({ rows = [] }) {
  const maxCount = Math.max(
    ...STAGE_ORDER.map((s) => rows.filter((r) => r.stage === s).length),
    1
  );

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
        border: "1px solid #E5E0DA",
      }}
    >
      <h4 style={{ margin: "0 0 14px 0", fontSize: 14, color: "#6B1E1E" }}>
        Pipeline Funnel
      </h4>
      {STAGE_ORDER.map((stage) => {
        const sr = rows.filter((r) => r.stage === stage);
        const pct = Math.max((sr.length / maxCount) * 100, 8);
        const val = sr.reduce((s, r) => s + (r.estValue || 0), 0);
        const wVal = sr.reduce((s, r) => s + (r.weighted || 0), 0);

        return (
          <div
            key={stage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 120,
                fontSize: 12,
                fontWeight: 600,
                textAlign: "right",
                color: "#2E2E2E",
              }}
            >
              {stage}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: `${pct}%`,
                  background: STAGE_COLORS[stage],
                  height: 32,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  minWidth: 80,
                }}
              >
                <span
                  style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}
                >
                  {sr.length} accounts
                </span>
              </div>
            </div>
            <div
              style={{
                width: 180,
                fontSize: 12,
                color: "#6B6B6B",
                textAlign: "right",
              }}
            >
              {formatCurrency(val)}{" "}
              <span style={{ color: "#6B6B6B" }}>
                (wtd: {formatCurrency(wVal)})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
