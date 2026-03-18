/**
 * RecentActivity component
 * Extracted from index.html renderMyTerritory() recent activity (lines 3552-3565).
 * Shows a compact list of the latest CRM / pipeline activity.
 */

import { esc } from "../utils/formatting";

export default function RecentActivity({ activities = [] }) {
  if (activities.length === 0) return null;

  return (
    <div
      style={{
        background: "#F5EDE3",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>
        Recent Activity
      </h3>
      {activities.slice(0, 5).map((entry, i) => (
        <div
          key={i}
          style={{
            padding: "8px 0",
            borderBottom: "1px solid #E5E0DA",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#6B6B6B" }}>{esc(entry.date)}</span> -{" "}
          <strong>{esc(entry.account)}</strong>
          <br />
          <span style={{ color: "#6B6B6B" }}>by {esc(entry.by)}</span>
        </div>
      ))}
    </div>
  );
}
