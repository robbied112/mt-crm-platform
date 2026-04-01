/**
 * ImportDiffSummary — "What Changed" card shown after a rebuild.
 *
 * Compares current views with the previous snapshot to surface
 * meaningful deltas: new/lost accounts, volume changes, inventory alerts.
 * Displayed in DataContext consumers after import + rebuild.
 *
 * TODO-014: Import Comparison Summary
 */

import { useState, useEffect, useMemo } from "react";
import { useData } from "../context/DataContext";

/**
 * Compute a diff between old and new view data.
 */
function computeDiff(prev, curr) {
  const changes = [];

  // Account count changes
  const prevAccts = new Set((prev.distScorecard || []).map((d) => d.acct || d.name).filter(Boolean));
  const currAccts = new Set((curr.distScorecard || []).map((d) => d.acct || d.name).filter(Boolean));
  const newAccts = [...currAccts].filter((a) => !prevAccts.has(a));
  const lostAccts = [...prevAccts].filter((a) => !currAccts.has(a));

  if (newAccts.length > 0) {
    changes.push({
      type: "positive",
      icon: "+",
      text: `${newAccts.length} new account${newAccts.length > 1 ? "s" : ""}: ${newAccts.slice(0, 3).join(", ")}${newAccts.length > 3 ? ` +${newAccts.length - 3} more` : ""}`,
    });
  }
  if (lostAccts.length > 0) {
    changes.push({
      type: "warning",
      icon: "-",
      text: `${lostAccts.length} account${lostAccts.length > 1 ? "s" : ""} no longer reporting: ${lostAccts.slice(0, 3).join(", ")}`,
    });
  }

  // Volume changes
  const prevVol = (prev.distScorecard || []).reduce((s, d) => s + (d.ce || 0), 0);
  const currVol = (curr.distScorecard || []).reduce((s, d) => s + (d.ce || 0), 0);
  if (prevVol > 0 && currVol > 0) {
    const pctChange = ((currVol - prevVol) / prevVol) * 100;
    if (Math.abs(pctChange) >= 1) {
      changes.push({
        type: pctChange > 0 ? "positive" : "negative",
        icon: pctChange > 0 ? "\u25B2" : "\u25BC",
        text: `Volume ${pctChange > 0 ? "up" : "down"} ${Math.abs(pctChange).toFixed(1)}% (${Math.round(currVol).toLocaleString()} vs ${Math.round(prevVol).toLocaleString()} cases)`,
      });
    }
  }

  // Reorder changes
  const prevOverdue = (prev.reorderData || []).filter((r) => r.days > r.cycle && r.cycle > 0).length;
  const currOverdue = (curr.reorderData || []).filter((r) => r.days > r.cycle && r.cycle > 0).length;
  if (prevOverdue !== currOverdue) {
    const delta = currOverdue - prevOverdue;
    changes.push({
      type: delta > 0 ? "warning" : "positive",
      icon: delta > 0 ? "!" : "\u2713",
      text: delta > 0
        ? `${delta} new overdue reorder${delta > 1 ? "s" : ""} (${currOverdue} total)`
        : `${Math.abs(delta)} reorder${Math.abs(delta) > 1 ? "s" : ""} back on track (${currOverdue} remaining)`,
    });
  }

  // Inventory alerts
  const prevLowStock = (prev.inventoryData || []).filter((i) => (i.doh || 0) < 14).length;
  const currLowStock = (curr.inventoryData || []).filter((i) => (i.doh || 0) < 14).length;
  if (currLowStock > 0 && currLowStock !== prevLowStock) {
    changes.push({
      type: "warning",
      icon: "!",
      text: `${currLowStock} SKU${currLowStock > 1 ? "s" : ""} below 14 days on hand${prevLowStock > 0 ? ` (was ${prevLowStock})` : ""}`,
    });
  }

  // Revenue changes
  const prevRev = (prev.revenueByChannel || []).reduce((s, r) => s + (r.total || r.revenue || 0), 0);
  const currRev = (curr.revenueByChannel || []).reduce((s, r) => s + (r.total || r.revenue || 0), 0);
  if (prevRev > 0 && currRev > 0) {
    const pctChange = ((currRev - prevRev) / prevRev) * 100;
    if (Math.abs(pctChange) >= 1) {
      changes.push({
        type: pctChange > 0 ? "positive" : "negative",
        icon: "$",
        text: `Revenue ${pctChange > 0 ? "up" : "down"} ${Math.abs(pctChange).toFixed(1)}% ($${Math.round(currRev).toLocaleString()})`,
      });
    }
  }

  return changes;
}

const TYPE_COLORS = {
  positive: { bg: "rgba(31, 134, 90, 0.08)", color: "#1F865A", border: "rgba(31, 134, 90, 0.2)" },
  negative: { bg: "rgba(197, 48, 48, 0.08)", color: "#C53030", border: "rgba(197, 48, 48, 0.2)" },
  warning: { bg: "rgba(192, 123, 1, 0.08)", color: "#C07B01", border: "rgba(192, 123, 1, 0.2)" },
  neutral: { bg: "rgba(107, 107, 107, 0.06)", color: "#6B6B6B", border: "rgba(107, 107, 107, 0.15)" },
};

export default function ImportDiffSummary({ previousData, onDismiss }) {
  const currentData = useData();
  const [visible, setVisible] = useState(true);

  const changes = useMemo(() => {
    if (!previousData) return [];
    return computeDiff(previousData, currentData);
  }, [previousData, currentData]);

  if (!visible || changes.length === 0) return null;

  return (
    <div className="import-diff">
      <div className="import-diff__header">
        <h3 className="import-diff__title">What Changed</h3>
        <button
          className="import-diff__dismiss"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
      <div className="import-diff__changes">
        {changes.map((change, i) => {
          const colors = TYPE_COLORS[change.type] || TYPE_COLORS.neutral;
          return (
            <div
              key={i}
              className="import-diff__item"
              style={{
                background: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
              }}
            >
              <span
                className="import-diff__icon"
                style={{ color: colors.color }}
              >
                {change.icon}
              </span>
              <span className="import-diff__text">{change.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export the compute function for testing
export { computeDiff };
