/**
 * AccountDetailPage — full account view with tabs:
 * Overview, Activity, Orders, Contacts, Tasks, Notes
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import { useData } from "../context/DataContext";
import AccountForm from "./AccountForm";
import ContactForm from "./ContactForm";
import LogActivityModal from "./LogActivityModal";
import TaskForm from "./TaskForm";
import OpportunityForm from "./OpportunityForm";
import { formatCurrency } from "../utils/formatting";

const TABS = ["overview", "opportunities", "activity", "orders", "contacts", "tasks", "notes"];
const STATUS_COLORS = { active: "badge-green", prospect: "badge-blue", inactive: "badge-yellow", churned: "badge-orange" };

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    accounts, contacts, activities, tasks, opportunities,
    updateAccount, deleteAccount,
    createContact, updateContact, deleteContact,
    logActivity, createTask, updateTask,
    createOpportunity, advanceStage, oppTypes,
    fetchNotes, addNote, deleteNote,
  } = useCrm();
  const { accountsTop, reorderData } = useData();

  const [activeTab, setActiveTab] = useState("overview");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showOppForm, setShowOppForm] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id]);
  const acctContacts = useMemo(() => contacts.filter((c) => c.accountId === id), [contacts, id]);
  const acctActivities = useMemo(() =>
    activities.filter((a) => a.accountId === id).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [activities, id]
  );
  const acctTasks = useMemo(() => tasks.filter((t) => t.accountId === id), [tasks, id]);
  const acctOpps = useMemo(() => opportunities.filter((o) => o.accountId === id), [opportunities, id]);

  // Match BI data by name
  const biData = useMemo(() => {
    if (!account) return null;
    const name = account.name?.toLowerCase();
    const matched = (accountsTop || []).find((a) => a.name?.toLowerCase() === name || a.acct?.toLowerCase() === name);
    const reorders = (reorderData || []).filter((r) => r.acct?.toLowerCase() === name || r.account?.toLowerCase() === name);
    return { matched, reorders };
  }, [account, accountsTop, reorderData]);

  // Load notes when tab changes
  useEffect(() => {
    if (activeTab === "notes" && id) {
      setNotesLoading(true);
      fetchNotes(id).then(setNotes).catch(console.error).finally(() => setNotesLoading(false));
    }
  }, [activeTab, id, fetchNotes]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote(id, { text: noteText.trim() });
    setNoteText("");
    const updated = await fetchNotes(id);
    setNotes(updated);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(`Delete "${account.name}"? This cannot be undone.`)) return;
    await deleteAccount(id);
    navigate("/accounts");
  };

  if (!account) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
        <p style={{ fontSize: 16 }}>Account not found.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/accounts")}>
          Back to Accounts
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="acct-detail-header">
        <button className="btn btn-small btn-secondary" onClick={() => navigate("/accounts")} style={{ marginBottom: 12 }}>
          &larr; Accounts
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{account.name}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`badge ${STATUS_COLORS[account.status] || "badge-blue"}`}>
                {formatLabel(account.status || "prospect")}
              </span>
              {account.type && <span className="badge badge-blue">{formatLabel(account.type)}</span>}
              {account.wineProgram && account.wineProgram !== "none" && (
                <span className="badge badge-green">{formatLabel(account.wineProgram)}</span>
              )}
              {(account.tags || []).map((t) => (
                <span key={t} className="myacct-tag-sm">{t}</span>
              ))}
            </div>
            {account.distributorName && (
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                {account.distributorName} {account.state ? `\u00B7 ${account.city || ""} ${account.state}` : ""}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-small" onClick={() => setShowActivityModal(true)}>Log Activity</button>
            <button className="btn btn-secondary btn-small" onClick={() => setShowEditForm(true)}>Edit</button>
            <button className="btn btn-small" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }} onClick={handleDeleteAccount}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {formatLabel(tab)}
            {tab === "opportunities" && acctOpps.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({acctOpps.filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Completed").length})</span>
            )}
            {tab === "contacts" && acctContacts.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({acctContacts.length})</span>
            )}
            {tab === "tasks" && acctTasks.filter((t) => t.status !== "completed").length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({acctTasks.filter((t) => t.status !== "completed").length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ marginTop: 20 }}>
        {activeTab === "overview" && (
          <OverviewTab account={account} contacts={acctContacts} biData={biData} activities={acctActivities} />
        )}
        {activeTab === "opportunities" && (
          <OpportunitiesTab
            opportunities={acctOpps}
            oppTypes={oppTypes}
            onAdd={() => setShowOppForm(true)}
            onAdvance={advanceStage}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab
            activities={acctActivities}
            onLogActivity={() => setShowActivityModal(true)}
          />
        )}
        {activeTab === "orders" && (
          <OrdersTab biData={biData} />
        )}
        {activeTab === "contacts" && (
          <ContactsTab
            contacts={acctContacts}
            onAdd={() => { setEditContact(null); setShowContactForm(true); }}
            onEdit={(c) => { setEditContact(c); setShowContactForm(true); }}
            onDelete={(c) => {
              if (window.confirm(`Remove ${c.firstName} ${c.lastName}?`)) deleteContact(c.id);
            }}
          />
        )}
        {activeTab === "tasks" && (
          <TasksTab
            tasks={acctTasks}
            onAdd={() => setShowTaskForm(true)}
            onToggle={(t) => updateTask(t.id, {
              status: t.status === "completed" ? "open" : "completed",
              completedAt: t.status === "completed" ? null : new Date().toISOString(),
            })}
          />
        )}
        {activeTab === "notes" && (
          <NotesTab
            notes={notes}
            loading={notesLoading}
            noteText={noteText}
            onNoteChange={setNoteText}
            onAddNote={handleAddNote}
            onDeleteNote={async (noteId) => {
              await deleteNote(id, noteId);
              setNotes((prev) => prev.filter((n) => n.id !== noteId));
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showEditForm && (
        <AccountForm
          account={account}
          onSave={(data) => updateAccount(id, data)}
          onClose={() => setShowEditForm(false)}
        />
      )}
      {showContactForm && (
        <ContactForm
          contact={editContact}
          accountId={id}
          accountName={account.name}
          onSave={async (data) => {
            if (editContact) await updateContact(editContact.id, data);
            else await createContact(data);
          }}
          onClose={() => { setShowContactForm(false); setEditContact(null); }}
        />
      )}
      {showActivityModal && (
        <LogActivityModal
          accountId={id}
          accountName={account.name}
          contacts={acctContacts}
          onSave={logActivity}
          onClose={() => setShowActivityModal(false)}
        />
      )}
      {showTaskForm && (
        <TaskForm
          accountId={id}
          accountName={account.name}
          contacts={acctContacts}
          onSave={createTask}
          onClose={() => setShowTaskForm(false)}
        />
      )}
      {showOppForm && (
        <OpportunityForm
          prefilledAccountId={id}
          prefilledAccountName={account.name}
          onSave={createOpportunity}
          onClose={() => setShowOppForm(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-tab components ──────────────────────────────────────

function OverviewTab({ account, contacts, biData, activities }) {
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Account Info Card */}
      <div className="table-container" style={{ marginBottom: 0 }}>
        <h3 className="table-title" style={{ marginBottom: 12 }}>Account Details</h3>
        <InfoRow label="Type" value={formatLabel(account.type || "")} />
        <InfoRow label="License" value={formatLabel(account.licenseType || "")} />
        <InfoRow label="Wine Program" value={formatLabel(account.wineProgram || "none")} />
        <InfoRow label="BTG Program" value={account.btgProgram ? "Yes" : "No"} />
        <InfoRow label="Distributor" value={account.distributorName} />
        <InfoRow label="Location" value={[account.city, account.state].filter(Boolean).join(", ") || "--"} />
        <InfoRow label="Next Action" value={account.nextAction || "--"} />
        <InfoRow label="Follow-up" value={account.followUpDate || "--"} />
      </div>

      {/* Primary Contact + KPIs */}
      <div>
        {primaryContact && (
          <div className="table-container" style={{ marginBottom: 20 }}>
            <h3 className="table-title" style={{ marginBottom: 12 }}>Primary Contact</h3>
            <InfoRow label="Name" value={`${primaryContact.firstName} ${primaryContact.lastName}`} />
            <InfoRow label="Title" value={primaryContact.title || formatLabel(primaryContact.role || "")} />
            <InfoRow label="Email" value={primaryContact.email} />
            <InfoRow label="Phone" value={primaryContact.phone} />
          </div>
        )}

        {biData?.matched && (
          <div className="kpi-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Cases</div>
              <div className="kpi-value">{biData.matched.ce?.toLocaleString() || biData.matched.totalCases?.toLocaleString() || "--"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Revenue</div>
              <div className="kpi-value">${(biData.matched.totalRevenue || biData.matched.revenue || 0).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="table-container" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
        <h3 className="table-title" style={{ marginBottom: 12 }}>Recent Activity</h3>
        {activities.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No activity logged yet.</p>
        ) : (
          activities.slice(0, 5).map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text-dim)", minWidth: 80 }}>{a.date}</span>
              <span className={`badge ${a.outcome === "positive" ? "badge-green" : a.outcome === "negative" ? "badge-orange" : "badge-blue"}`} style={{ fontSize: 11 }}>
                {formatLabel(a.type || "note")}
              </span>
              <span style={{ flex: 1 }}>{a.subject || a.notes}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ActivityTab({ activities, onLogActivity }) {
  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">Activity Timeline</h3>
        <button className="btn btn-primary btn-small" onClick={onLogActivity}>+ Log Activity</button>
      </div>
      {activities.length === 0 ? (
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No activities yet. Click &quot;+ Log Activity&quot; to start.</p>
      ) : (
        <div>
          {activities.map((a) => (
            <div key={a.id} className="activity-item">
              <div className="activity-item__header">
                <span className={`badge ${a.outcome === "positive" ? "badge-green" : a.outcome === "negative" ? "badge-orange" : "badge-blue"}`}>
                  {formatLabel(a.type || "note")}
                </span>
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
              {a.loggedByName && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>by {a.loggedByName}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ biData }) {
  if (!biData?.matched && (!biData?.reorders || biData.reorders.length === 0)) {
    return (
      <div className="table-container">
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>
          No order data found. Upload depletion or purchase data in Settings to see order history here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {biData.matched && (
        <div className="kpi-row" style={{ marginBottom: 20 }}>
          <div className="kpi-card"><div className="kpi-label">Trend</div><div className="kpi-value" style={{ fontSize: 20 }}>{biData.matched.trend || "--"}</div></div>
          <div className="kpi-card"><div className="kpi-label">Rank</div><div className="kpi-value">#{biData.matched.rank || "--"}</div></div>
          <div className="kpi-card"><div className="kpi-label">Order Count</div><div className="kpi-value">{biData.matched.orderCount || "--"}</div></div>
          <div className="kpi-card"><div className="kpi-label">Avg Order</div><div className="kpi-value">{biData.matched.avgOrderSize || "--"}</div></div>
        </div>
      )}

      {biData.reorders?.length > 0 && (
        <div className="table-container">
          <h3 className="table-title" style={{ marginBottom: 12 }}>Reorder History</h3>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Last Order</th>
                <th>Cycle (days)</th>
                <th>Days Since</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {biData.reorders.flatMap((r) =>
                (r.skus || [{ w: r.acct, days: r.days, cycle: r.cycle }]).map((sku, i) => (
                  <tr key={`${r.acct}-${i}`}>
                    <td>{sku.w || "--"}</td>
                    <td>{r.lastOrder || "--"}</td>
                    <td>{sku.cycle || r.cycle || "--"}</td>
                    <td>{sku.days || r.days || "--"}</td>
                    <td>
                      <span className={`badge ${(sku.days || r.days || 0) > (sku.cycle || r.cycle || 999) ? "badge-orange" : "badge-green"}`}>
                        {(sku.days || r.days || 0) > (sku.cycle || r.cycle || 999) ? "Overdue" : "On Track"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContactsTab({ contacts, onAdd, onEdit, onDelete }) {
  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">Contacts</h3>
        <button className="btn btn-primary btn-small" onClick={onAdd}>+ Add Contact</button>
      </div>
      {contacts.length === 0 ? (
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No contacts yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Title / Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Primary</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</td>
                <td>{c.title || formatLabel(c.role || "")}</td>
                <td>{c.email || "--"}</td>
                <td>{c.phone || "--"}</td>
                <td>{c.isPrimary ? "\u2705" : ""}</td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-small btn-secondary" onClick={() => onEdit(c)}>Edit</button>
                    <button className="btn btn-small" style={{ color: "#dc2626", background: "none", border: "none" }} onClick={() => onDelete(c)}>&times;</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TasksTab({ tasks, onAdd, onToggle }) {
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "completed");

  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">Tasks</h3>
        <button className="btn btn-primary btn-small" onClick={onAdd}>+ Add Task</button>
      </div>
      {tasks.length === 0 ? (
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No tasks yet.</p>
      ) : (
        <>
          {open.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
          {done.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", padding: "12px 0 4px" }}>
                Completed ({done.length})
              </div>
              {done.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle }) {
  const isOverdue = task.status !== "completed" && task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
  const priorityColors = { urgent: "#dc2626", high: "#f97316", medium: "#d97706", low: "#64748b" };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
      borderBottom: "1px solid var(--border)", opacity: task.status === "completed" ? 0.6 : 1,
    }}>
      <input
        type="checkbox"
        checked={task.status === "completed"}
        onChange={() => onToggle(task)}
        style={{ cursor: "pointer" }}
      />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, textDecoration: task.status === "completed" ? "line-through" : "none", fontSize: 14 }}>
          {task.title}
        </span>
        {task.dueDate && (
          <span style={{ marginLeft: 8, fontSize: 12, color: isOverdue ? "#dc2626" : "var(--text-dim)" }}>
            Due {task.dueDate}
          </span>
        )}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
        color: priorityColors[task.priority] || "#64748b",
        background: task.priority === "urgent" ? "#fee2e2" : task.priority === "high" ? "#fed7aa" : "#f8fafc",
      }}>
        {task.priority || "medium"}
      </span>
    </div>
  );
}

function NotesTab({ notes, loading, noteText, onNoteChange, onAddNote, onDeleteNote }) {
  return (
    <div className="table-container">
      <h3 className="table-title" style={{ marginBottom: 12 }}>Notes</h3>
      <div className="ap-note-input" style={{ marginBottom: 16 }}>
        <textarea
          value={noteText}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a note..."
        />
        <button onClick={onAddNote} disabled={!noteText.trim()}>Add</button>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading...</p>
      ) : notes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No notes yet.</p>
      ) : (
        <div className="ap-notes-list">
          {notes.map((n) => (
            <div key={n.id} className="ap-note">
              <div className="meta">
                {n.authorName || "Unknown"} &middot; {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : ""}
                <button
                  style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14 }}
                  onClick={() => onDeleteNote(n.id)}
                  title="Delete note"
                >
                  &times;
                </button>
              </div>
              {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Opportunities Tab ────────────────────────────────────────

const OPP_STAGE_COLORS = {
  Won: "#10b981", Lost: "#ef4444", Completed: "#10b981",
  Identified: "#8B6A4C", Outreach: "#60a5fa", Meeting: "#818cf8",
  Tasting: "#a78bfa", Proposal: "#f59e0b", Negotiation: "#f97316",
};

function OpportunitiesTab({ opportunities, oppTypes, onAdd, onAdvance }) {
  const open = opportunities.filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Completed");
  const closed = opportunities.filter((o) => o.stage === "Won" || o.stage === "Lost" || o.stage === "Completed");
  const typeLabel = (key) => oppTypes.find((t) => t.key === key)?.label || key;

  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">
          Opportunities
          {open.length > 0 && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: "var(--text-dim)" }}>{open.length} open</span>}
        </h3>
        <button className="btn btn-primary btn-small" onClick={onAdd}>+ New Opportunity</button>
      </div>
      {opportunities.length === 0 ? (
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No opportunities yet. Create one to start tracking deals with this account.</p>
      ) : (
        <>
          {open.map((opp) => (
            <OppRow key={opp.id} opp={opp} typeLabel={typeLabel(opp.type)} onAdvance={onAdvance} oppTypes={oppTypes} />
          ))}
          {closed.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", padding: "12px 0 4px" }}>
                Closed ({closed.length})
              </div>
              {closed.map((opp) => (
                <OppRow key={opp.id} opp={opp} typeLabel={typeLabel(opp.type)} onAdvance={onAdvance} oppTypes={oppTypes} isClosed />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function OppRow({ opp, typeLabel, onAdvance, oppTypes, isClosed }) {
  const type = oppTypes.find((t) => t.key === opp.type);
  const stages = type?.stages || [];
  const currentIdx = stages.indexOf(opp.stage);
  const nextStage = !isClosed && currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
      borderBottom: "1px solid var(--border)", opacity: isClosed ? 0.6 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{opp.title}</span>
          <span className="badge badge-blue" style={{ fontSize: 10 }}>{typeLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
          <span className="pipeline-stage-badge" style={{ background: OPP_STAGE_COLORS[opp.stage] || "#8B6A4C", fontSize: 10, padding: "1px 8px" }}>
            {opp.stage}
          </span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{formatCurrency(opp.estValue || 0)}</span>
          {opp.wines?.length > 0 && <span>{opp.wines.length} wine{opp.wines.length > 1 ? "s" : ""}</span>}
          {opp.owner && <span>{opp.owner}</span>}
        </div>
      </div>
      {nextStage && (
        <button
          className="btn btn-small btn-secondary"
          onClick={async () => {
            try { await onAdvance(opp.id, nextStage); } catch (err) { console.error(err.message); }
          }}
          style={{ fontSize: 11, whiteSpace: "nowrap" }}
        >
          &rarr; {nextStage}
        </button>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid #FDF8F0", fontSize: 13 }}>
      <span style={{ fontWeight: 600, color: "var(--text-dim)", minWidth: 120 }}>{label}</span>
      <span>{value || "--"}</span>
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
