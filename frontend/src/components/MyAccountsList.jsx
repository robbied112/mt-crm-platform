/**
 * MyAccountsList component
 * Extracted from index.html My Accounts section (lines 3512-3717).
 * Filterable list of accounts with tags, actions, and note counts.
 */

import { useState } from "react";
import { esc } from "../utils/formatting";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "has-action", label: "Has Action" },
  { key: "has-notes", label: "Has Notes" },
  { key: "VIP", label: "VIP" },
  { key: "At Risk", label: "At Risk" },
  { key: "Hot Lead", label: "Hot Lead" },
  { key: "Needs Visit", label: "Needs Visit" },
  { key: "Follow Up", label: "Follow Up" },
];

const TAG_COLORS = {
  VIP: "#7C3AED",
  "At Risk": "#DC2626",
  "Hot Lead": "#F59E0B",
  "Needs Visit": "#2563EB",
  "Follow Up": "#10b981",
  Chain: "#6B7280",
  Independent: "#6B7280",
  Seasonal: "#D97706",
};

export default function MyAccountsList({
  accounts = [],
  onAccountClick,
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered =
    activeFilter === "all"
      ? accounts
      : activeFilter === "has-action"
        ? accounts.filter((a) => a.nextAction || a.followUp)
        : activeFilter === "has-notes"
          ? accounts.filter((a) => a.noteCount > 0)
          : accounts.filter((a) => a.tags && a.tags.includes(activeFilter));

  const todayStr = new Date().toISOString().split("T")[0];
  const withTags = accounts.filter((a) => a.tags && a.tags.length > 0).length;
  const withActions = accounts.filter((a) => a.nextAction).length;
  const withNotes = accounts.filter((a) => a.noteCount > 0).length;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      {/* Header + Filters */}
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#0F766E",
          }}
        >
          My Accounts
        </h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`myacct-filter${activeFilter === opt.key ? " active" : ""}`}
              onClick={() => setActiveFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Account List */}
      <div style={{ padding: "8px 16px", maxHeight: 360, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 24,
              color: "#9ca3af",
            }}
          >
            <div style={{ fontSize: 13 }}>No accounts match this filter.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Open an account and add tags, notes, or actions to see them here.
            </div>
          </div>
        ) : (
          filtered.slice(0, 50).map((a, i) => {
            const isOverdue = a.followUp && a.followUp < todayStr;

            return (
              <div
                key={i}
                className="myacct-row"
                onClick={() => onAccountClick?.(a.name)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#0F766E",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {esc(a.name)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6B7280",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {esc(a.dist || "--")} - {esc(a.st || "")}
                  </div>
                </div>

                {/* Tags + note badge */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  {(a.tags || []).map((tag) => {
                    const bg = TAG_COLORS[tag] || "#6B7280";
                    return (
                      <span
                        key={tag}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 8,
                          fontSize: 9,
                          fontWeight: 600,
                          background: bg + "20",
                          color: bg,
                        }}
                      >
                        {esc(tag)}
                      </span>
                    );
                  })}
                  {a.noteCount > 0 && (
                    <span
                      style={{
                        background: "#E0E7FF",
                        color: "#4338CA",
                        padding: "1px 6px",
                        borderRadius: 8,
                        fontSize: 9,
                        fontWeight: 600,
                      }}
                    >
                      {a.noteCount} note{a.noteCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Action + overdue */}
                {a.nextAction && (
                  <div style={{ minWidth: 100, textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#059669",
                        fontWeight: 600,
                      }}
                    >
                      {esc(a.nextAction)}
                      {a.followUp ? ` by ${esc(a.followUp)}` : ""}
                    </span>
                    {isOverdue && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#DC2626",
                          fontWeight: 700,
                          marginLeft: 4,
                        }}
                      >
                        OVERDUE
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #e2e8f0",
          fontSize: 11,
          color: "#6B7280",
        }}
      >
        Showing {filtered.length} of {accounts.length} accounts |{" "}
        {withTags} tagged | {withActions} with actions | {withNotes} with notes
      </div>
    </div>
  );
}
