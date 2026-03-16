/**
 * LogActivityModal — Log wine-industry activities:
 * tastings, sample drops, visits, calls, wine dinners, etc.
 */
import { useState } from "react";
import { useData } from "../context/DataContext";
import { useCrm } from "../context/CrmContext";

const TYPE_LABELS = {
  call: "Phone Call",
  email: "Email",
  visit: "Site Visit",
  tasting: "Wine Tasting",
  sample_drop: "Sample Drop",
  menu_placement: "Menu Placement",
  wine_dinner: "Wine Dinner",
  staff_training: "Staff Training",
  reorder_followup: "Reorder Follow-up",
  note: "Note",
};

const TYPE_ICONS = {
  call: "\u{1F4DE}", email: "\u{1F4E7}", visit: "\u{1F6B6}", tasting: "\u{1F377}",
  sample_drop: "\u{1F4E6}", menu_placement: "\u{1F4CB}", wine_dinner: "\u{1F37D}\u{FE0F}",
  staff_training: "\u{1F393}", reorder_followup: "\u{1F504}", note: "\u{1F4DD}",
};

export default function LogActivityModal({ accountId, accountName, contacts, onSave, onClose, accounts }) {
  const { tenantConfig } = useData();
  const crm = useCrm();
  const allAccounts = accounts || crm.accounts;

  const [form, setForm] = useState({
    type: "visit",
    date: new Date().toISOString().slice(0, 10),
    subject: "",
    notes: "",
    outcome: null,
    contactId: "",
    contactName: "",
    followUpDate: "",
    followUpAction: "",
    accountId: accountId || "",
    accountName: accountName || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleAccountChange = (e) => {
    const acctId = e.target.value;
    const acct = allAccounts.find((a) => a.id === acctId);
    setForm((f) => ({
      ...f,
      accountId: acctId,
      accountName: acct?.name || "",
      contactId: "",
      contactName: "",
    }));
  };

  const handleContactChange = (e) => {
    const cId = e.target.value;
    const contactsList = contacts || crm.contacts.filter((c) => c.accountId === form.accountId);
    const c = contactsList.find((x) => x.id === cId);
    setForm((f) => ({
      ...f,
      contactId: cId,
      contactName: c ? `${c.firstName} ${c.lastName}` : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error("Log activity failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const types = tenantConfig?.activityTypes || Object.keys(TYPE_LABELS);
  const contactsList = contacts || crm.contacts.filter((c) => c.accountId === form.accountId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Activity</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            {/* Activity type pills */}
            <div className="form-field form-field--full">
              <label>Activity Type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`pill${form.type === t ? " active" : ""}`}
                    onClick={() => set("type", t)}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  >
                    {TYPE_ICONS[t] || ""} {TYPE_LABELS[t] || formatLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {!accountId && (
              <div className="form-field form-field--full">
                <label>Account</label>
                <select className="form-input" value={form.accountId} onChange={handleAccountChange}>
                  <option value="">-- Select Account --</option>
                  {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-field">
              <label>Date</label>
              <input className="form-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Contact</label>
              <select className="form-input" value={form.contactId} onChange={handleContactChange}>
                <option value="">-- None --</option>
                {contactsList.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>

            <div className="form-field form-field--full">
              <label>Subject</label>
              <input className="form-input" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Brief summary..." />
            </div>

            <div className="form-field form-field--full">
              <label>Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Details, wines discussed, outcomes..." />
            </div>

            <div className="form-field form-field--full">
              <label>Outcome</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["positive", "neutral", "negative"].map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`pill${form.outcome === o ? " active" : ""}`}
                    onClick={() => set("outcome", form.outcome === o ? null : o)}
                    style={{ fontSize: 12, padding: "6px 14px" }}
                  >
                    {o === "positive" ? "\u{1F44D}" : o === "negative" ? "\u{1F44E}" : "\u{1F91D}"} {formatLabel(o)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>Follow-up Date</label>
              <input className="form-input" type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Follow-up Action</label>
              <select className="form-input" value={form.followUpAction} onChange={(e) => set("followUpAction", e.target.value)}>
                <option value="">-- None --</option>
                {(tenantConfig?.nextActions || []).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Log Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
