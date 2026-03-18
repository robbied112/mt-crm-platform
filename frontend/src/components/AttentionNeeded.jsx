/**
 * AttentionNeeded component
 * Extracted from index.html renderMyTerritory() attention section (lines 3430-3504).
 * Displays overdue reorders, stalling deals, and declining accounts.
 */

import { esc } from "../utils/formatting";

const ICON_MAP = {
  "Overdue Reorder": "\u26A0",
  "Stalling Deal": "\u23F3",
  Declining: "\u25BC",
};

const TYPE_PRIORITY = {
  "Overdue Reorder": 0,
  "Stalling Deal": 1,
  Declining: 2,
};

export default function AttentionNeeded({ items = [] }) {
  // Sort: overdue first, then stalling, then declining. Cap at 8.
  const sorted = [...items]
    .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9))
    .slice(0, 8);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          background: "rgba(31, 134, 90, 0.08)",
          border: "1px solid rgba(31, 134, 90, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 20 }}>&#10003;</span>{" "}
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1F865A" }}>
          All clear! No urgent items right now.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(192, 123, 1, 0.08)",
        border: "1px solid rgba(192, 123, 1, 0.2)",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: 16,
          fontWeight: 700,
          color: "#C07B01",
        }}
      >
        Attention Needed{" "}
        <span style={{ fontSize: 12, fontWeight: 400, color: "#C07B01" }}>
          ({sorted.length} items)
        </span>
      </h3>
      {sorted.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
            borderBottom: "1px solid rgba(192, 123, 1, 0.15)",
            fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16 }}>
            {ICON_MAP[item.type] || "\u2022"}
          </span>
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontWeight: 600,
                color: item.color,
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              {esc(item.type)}
            </span>
            <br />
            <strong>{esc(item.account)}</strong>{" "}
            <span style={{ color: "#6B6B6B" }}>- {esc(item.detail)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
