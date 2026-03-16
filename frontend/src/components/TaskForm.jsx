/**
 * TaskForm — Modal for creating/editing tasks linked to accounts.
 */
import { useState, useEffect } from "react";
import { useCrm } from "../context/CrmContext";

export default function TaskForm({ task, accountId, accountName, contacts, onSave, onClose }) {
  const crm = useCrm();
  const allAccounts = crm.accounts;

  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    status: "open",
    accountId: accountId || "",
    accountName: accountName || "",
    contactId: "",
    contactName: "",
    assignedTo: "",
    assignedToName: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setForm((f) => ({ ...f, ...task }));
    }
  }, [task]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleAccountChange = (e) => {
    const acctId = e.target.value;
    const acct = allAccounts.find((a) => a.id === acctId);
    setForm((f) => ({ ...f, accountId: acctId, accountName: acct?.name || "", contactId: "", contactName: "" }));
  };

  const handleContactChange = (e) => {
    const cId = e.target.value;
    const contactsList = contacts || crm.contacts.filter((c) => c.accountId === form.accountId);
    const c = contactsList.find((x) => x.id === cId);
    setForm((f) => ({ ...f, contactId: cId, contactName: c ? `${c.firstName} ${c.lastName}` : "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error("Save task failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const contactsList = contacts || crm.contacts.filter((c) => c.accountId === form.accountId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? "Edit Task" : "New Task"}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label>Title *</label>
              <input className="form-input" value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder="e.g. Follow up on Pinot tasting" />
            </div>

            <div className="form-field form-field--full">
              <label>Description</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>

            {!accountId && (
              <div className="form-field form-field--full">
                <label>Account</label>
                <select className="form-input" value={form.accountId} onChange={handleAccountChange}>
                  <option value="">-- None --</option>
                  {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            {form.accountId && (
              <div className="form-field">
                <label>Contact</label>
                <select className="form-input" value={form.contactId} onChange={handleContactChange}>
                  <option value="">-- None --</option>
                  {contactsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-field">
              <label>Due Date</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Priority</label>
              <select className="form-input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {task && (
              <div className="form-field">
                <label>Status</label>
                <select className="form-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>
              {saving ? "Saving..." : task ? "Update" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
