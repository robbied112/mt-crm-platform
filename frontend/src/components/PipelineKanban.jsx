/**
 * PipelineKanban — Unified pipeline view backed by CRM opportunities.
 * Desktop: Kanban board with drag-to-advance.
 * Mobile: Card list grouped by stage.
 * Filters by opportunity type, stage, owner, account.
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import { formatCurrency } from "../utils/formatting";
import OpportunityForm from "./OpportunityForm";

const STAGE_COLORS = {
  Identified: "#94a3b8", Outreach: "#60a5fa", Meeting: "#818cf8",
  Tasting: "#a78bfa", Proposal: "#f59e0b", Negotiation: "#f97316",
  "Menu Trial": "#c084fc", Confirmed: "#1F865A", "Menu Planning": "#fb923c",
  Pitched: "#60a5fa", "Samples Sent": "#93c5fd", Approved: "#1F865A",
  Contacted: "#60a5fa", Proposed: "#818cf8", Scheduled: "#fbbf24",
  Executed: "#1F865A", Completed: "#1F865A", "Menu Approved": "#1F865A",
  Won: "#1F865A", Lost: "#ef4444",
};

export default function PipelineKanban() {
  const {
    opportunities, accounts, oppTypes, getStagesForType,
    createOpportunity, updateOpportunity, advanceStage, deleteOpportunity,
  } = useCrm();
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editOpp, setEditOpp] = useState(null);
  const [dragOppId, setDragOppId] = useState(null);
  const [view, setView] = useState("kanban"); // kanban | table

  // Filtered opportunities
  const filtered = useMemo(() => {
    let opps = opportunities;
    if (typeFilter) opps = opps.filter((o) => o.type === typeFilter);
    if (ownerFilter) opps = opps.filter((o) => o.owner === ownerFilter);
    if (accountFilter) opps = opps.filter((o) => o.accountId === accountFilter);
    if (search) {
      const q = search.toLowerCase();
      opps = opps.filter((o) =>
        (o.title || "").toLowerCase().includes(q) ||
        (o.accountName || "").toLowerCase().includes(q) ||
        (o.owner || "").toLowerCase().includes(q)
      );
    }
    return opps;
  }, [opportunities, typeFilter, ownerFilter, accountFilter, search]);

  // Get stages to display based on type filter
  const displayStages = useMemo(() => {
    if (typeFilter) {
      return getStagesForType(typeFilter);
    }
    // When showing all types, use a merged unique stage list
    const stageSet = new Set();
    oppTypes.forEach((t) => t.stages.forEach((s) => stageSet.add(s)));
    // Put Won/Lost/Completed at the end
    const endStages = ["Won", "Lost", "Completed"];
    const middle = [...stageSet].filter((s) => !endStages.includes(s));
    const end = [...stageSet].filter((s) => endStages.includes(s));
    return [...middle, ...end];
  }, [typeFilter, oppTypes, getStagesForType]);

  // Group by stage
  const groupedByStage = useMemo(() => {
    const groups = {};
    displayStages.forEach((s) => { groups[s] = []; });
    filtered.forEach((o) => {
      if (groups[o.stage]) groups[o.stage].push(o);
      else if (groups.Won) groups.Won.push(o); // fallback
    });
    return groups;
  }, [filtered, displayStages]);

  // KPIs
  const openOpps = filtered.filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Completed");
  const wonOpps = filtered.filter((o) => o.stage === "Won" || o.stage === "Completed");
  const totalOpen = openOpps.reduce((s, o) => s + (o.estValue || 0), 0);
  const totalWon = wonOpps.reduce((s, o) => s + (o.estValue || 0), 0);

  // Owner options
  const owners = useMemo(
    () => [...new Set(opportunities.map((o) => o.owner).filter(Boolean))].sort(),
    [opportunities]
  );

  // Drag handlers
  const handleDragStart = useCallback((e, oppId) => {
    setDragOppId(oppId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback(async (e, targetStage) => {
    e.preventDefault();
    if (!dragOppId) return;
    const opp = opportunities.find((o) => o.id === dragOppId);
    if (!opp || opp.stage === targetStage) { setDragOppId(null); return; }
    try {
      await advanceStage(dragOppId, targetStage);
    } catch (err) {
      console.error("Stage advance failed:", err.message);
    }
    setDragOppId(null);
  }, [dragOppId, opportunities, advanceStage]);

  const handleDragOver = (e) => e.preventDefault();

  const typeLabel = (key) => oppTypes.find((t) => t.key === key)?.label || key;

  // Empty state
  if (opportunities.length === 0) {
    return (
      <div className="pipeline-empty">
        <div className="pipeline-empty__icon">&#127919;</div>
        <h3 className="pipeline-empty__title">No Opportunities Yet</h3>
        <p className="pipeline-empty__text">
          Create your first opportunity to start tracking deals.
          {accounts.length === 0 && " You'll need to add an account first."}
        </p>
        <div className="pipeline-empty__actions">
          {accounts.length === 0 ? (
            <button className="btn btn-primary" onClick={() => navigate("/accounts")}>
              Add First Account
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setEditOpp(null); setShowForm(true); }}>
              Create First Opportunity
            </button>
          )}
        </div>

        {showForm && (
          <OpportunityForm
            onSave={createOpportunity}
            onClose={() => setShowForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pipeline">
      {/* Header */}
      <div className="pipeline__header">
        <div>
          <h2 className="pipeline__title">Pipeline</h2>
          <p className="pipeline__subtitle">
            {openOpps.length} open &middot; {formatCurrency(totalOpen)} value
            {wonOpps.length > 0 && <> &middot; {wonOpps.length} won ({formatCurrency(totalWon)})</>}
          </p>
        </div>
        <div className="pipeline__header-actions">
          <div className="toggle-group">
            <button className={`toggle-btn${view === "kanban" ? " active" : ""}`} onClick={() => setView("kanban")}>Board</button>
            <button className={`toggle-btn${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>Table</button>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditOpp(null); setShowForm(true); }}>
            + New Opportunity
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row pipeline__kpis">
        <div className="kpi-card">
          <div className="kpi-label">Open Opportunities</div>
          <div className="kpi-value">{openOpps.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open Pipeline</div>
          <div className="kpi-value" style={{ color: "#2563eb" }}>{formatCurrency(totalOpen)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Won</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{formatCurrency(totalWon)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Win Rate</div>
          <div className="kpi-value">
            {filtered.length > 0
              ? `${Math.round((wonOpps.length / filtered.length) * 100)}%`
              : "--"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="pipeline__filters">
        <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {oppTypes.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <select className="form-input" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All Owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="form-input" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">All Accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input
          className="form-input"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 150 }}
        />
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="pipeline-board">
          {displayStages
            .filter((stage) => stage !== "Lost") // hide Lost column, show in table
            .map((stage) => {
              const cards = groupedByStage[stage] || [];
              const stageValue = cards.reduce((s, o) => s + (o.estValue || 0), 0);
              return (
                <div
                  key={stage}
                  className="pipeline-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className="pipeline-col__header">
                    <span className="pipeline-col__dot" style={{ background: STAGE_COLORS[stage] || "#94a3b8" }} />
                    <span className="pipeline-col__name">{stage}</span>
                    <span className="pipeline-col__count">{cards.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <div className="pipeline-col__value">{formatCurrency(stageValue)}</div>
                  )}
                  <div className="pipeline-col__cards">
                    {cards.map((opp) => (
                      <OppCard
                        key={opp.id}
                        opp={opp}
                        typeLabel={typeLabel(opp.type)}
                        onDragStart={handleDragStart}
                        onClick={() => navigate(`/accounts/${opp.accountId}`)}
                        onEdit={() => { setEditOpp(opp); setShowForm(true); }}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="pipeline-col__empty">No deals</div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Opportunity</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Owner</th>
                <th>Wines</th>
                <th>Next Step</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr key={opp.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/accounts/${opp.accountId}`)}>
                  <td style={{ fontWeight: 600, color: "var(--accent)" }}>{opp.accountName || "--"}</td>
                  <td>{opp.title}</td>
                  <td><span className="badge badge-blue" style={{ fontSize: 11 }}>{typeLabel(opp.type)}</span></td>
                  <td>
                    <span className="pipeline-stage-badge" style={{ background: STAGE_COLORS[opp.stage] || "#94a3b8" }}>
                      {opp.stage}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(opp.estValue || 0)}</td>
                  <td>{opp.owner || "--"}</td>
                  <td>
                    {opp.wines?.length > 0 ? (
                      <span className="badge badge-green" style={{ fontSize: 11 }}>{opp.wines.length} wine{opp.wines.length > 1 ? "s" : ""}</span>
                    ) : "--"}
                  </td>
                  <td style={{ fontSize: 12 }}>{opp.nextStep || "--"}</td>
                  <td style={{ fontSize: 12 }}>{opp.dueDate || "--"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>No opportunities match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <OpportunityForm
          opportunity={editOpp}
          onSave={editOpp
            ? async (data) => { await updateOpportunity(editOpp.id, data); }
            : createOpportunity
          }
          onClose={() => { setShowForm(false); setEditOpp(null); }}
        />
      )}
    </div>
  );
}

// ─── Opportunity Card ────────────────────────────────────────

function OppCard({ opp, typeLabel, onDragStart, onClick, onEdit }) {
  const today = new Date();
  const stageDate = opp.stageHistory?.length > 0
    ? new Date(opp.stageHistory[opp.stageHistory.length - 1].date)
    : opp.createdAt?.toDate ? opp.createdAt.toDate() : today;
  const daysInStage = Math.max(0, Math.floor((today - stageDate) / 86400000));

  return (
    <div
      className="pipeline-card"
      draggable
      onDragStart={(e) => onDragStart(e, opp.id)}
      onClick={onClick}
    >
      <div className="pipeline-card__top">
        <span className="pipeline-card__account">{opp.accountName || "Unknown"}</span>
        <span className="pipeline-card__type">{typeLabel}</span>
      </div>
      <div className="pipeline-card__title">{opp.title}</div>
      <div className="pipeline-card__meta">
        <span className="pipeline-card__value">{formatCurrency(opp.estValue || 0)}</span>
        {opp.wines?.length > 0 && (
          <span className="pipeline-card__wines">{opp.wines.length} wine{opp.wines.length > 1 ? "s" : ""}</span>
        )}
        <span className="pipeline-card__days" style={{ color: daysInStage > 21 ? "#dc2626" : daysInStage > 14 ? "#d97706" : "var(--text-dim)" }}>
          {daysInStage}d
        </span>
      </div>
      {opp.owner && <div className="pipeline-card__owner">{opp.owner}</div>}
    </div>
  );
}
