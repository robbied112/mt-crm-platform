/**
 * ActivitiesPage — Global activity timeline across all accounts.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import { useTeam } from "../context/TeamContext";
import LogActivityModal from "./LogActivityModal";

const TYPE_LABELS = {
  call: "Phone Call", email: "Email", visit: "Site Visit", tasting: "Wine Tasting",
  sample_drop: "Sample Drop", menu_placement: "Menu Placement", wine_dinner: "Wine Dinner",
  staff_training: "Staff Training", reorder_followup: "Reorder Follow-up", note: "Note",
};

const TYPE_ICONS = {
  call: "\u{1F4DE}", email: "\u{1F4E7}", visit: "\u{1F6B6}", tasting: "\u{1F377}",
  sample_drop: "\u{1F4E6}", menu_placement: "\u{1F4CB}", wine_dinner: "\u{1F37D}\u{FE0F}",
  staff_training: "\u{1F393}", reorder_followup: "\u{1F504}", note: "\u{1F4DD}",
};

const OUTCOME_BADGE = {
  positive: "badge-green", neutral: "badge-blue", negative: "badge-orange",
};

export default function ActivitiesPage() {
  const { activities, logActivity } = useCrm();
  const { members } = useTeam();
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    let list = activities;
    if (typeFilter !== "all") {
      list = list.filter((a) => a.type === typeFilter);
    }
    if (repFilter !== "all") {
      list = list.filter((a) => a.loggedBy === repFilter);
    }
    return list;
  }, [activities, typeFilter, repFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((a) => {
      const date = a.date || "No Date";
      if (!groups[date]) groups[date] = [];
      groups[date].push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Activity Log</h2>
          <p className="page-subtitle">{activities.length} activities logged</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Log Activity</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-controls">
            <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {members.length > 1 && (
              <select className="form-input" value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
                <option value="all">All Reps</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>{m.displayName || m.email?.split("@")[0]}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#6B6B6B" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u{1F4DD}"}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#2E2E2E", marginBottom: 4 }}>No activities yet</p>
            <p style={{ fontSize: 13 }}>Log your first activity to start tracking interactions.</p>
          </div>
        ) : (
          grouped.map(([date, items]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                {date}
              </div>
              {items.map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="activity-item__header">
                    <span style={{ fontSize: 16, marginRight: 4 }}>{TYPE_ICONS[a.type] || "\u{1F4DD}"}</span>
                    <span className={`badge ${OUTCOME_BADGE[a.outcome] || "badge-blue"}`} style={{ fontSize: 11 }}>
                      {TYPE_LABELS[a.type] || formatLabel(a.type || "note")}
                    </span>
                    {a.accountName && (
                      <span
                        className="acct-clickable"
                        style={{ marginLeft: 8, fontSize: 13 }}
                        onClick={() => a.accountId && navigate(`/accounts/${a.accountId}`)}
                      >
                        {a.accountName}
                      </span>
                    )}
                    <span className="activity-item__date">{a.date}</span>
                  </div>
                  {a.subject && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{a.subject}</div>}
                  {a.notes && <div style={{ fontSize: 13, color: "var(--text)" }}>{a.notes}</div>}
                  {a.contactName && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>with {a.contactName}</div>}
                  {a.followUpDate && (
                    <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>
                      Follow-up: {a.followUpDate} {a.followUpAction ? `\u2014 ${a.followUpAction}` : ""}
                    </div>
                  )}
                  {a.loggedByName && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>by {a.loggedByName}</div>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <LogActivityModal
          onSave={logActivity}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
