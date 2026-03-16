/**
 * ContactForm — Modal for creating/editing contacts.
 * Wine-specific roles: sommelier, beverage director, wine buyer, etc.
 */
import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";

const ROLE_LABELS = {
  sommelier: "Sommelier",
  beverage_director: "Beverage Director",
  wine_buyer: "Wine Buyer",
  gm: "General Manager",
  owner: "Owner",
  bar_manager: "Bar Manager",
  purchasing: "Purchasing",
  other: "Other",
};

const INITIAL = {
  firstName: "", lastName: "", title: "", role: "other",
  email: "", phone: "", preferredContact: "email",
  isPrimary: false, notes: "",
};

export default function ContactForm({ contact, accountId, accountName, onSave, onClose }) {
  const { tenantConfig } = useData();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) setForm({ ...INITIAL, ...contact });
    else setForm(INITIAL);
  }, [contact]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        accountId,
        accountName,
      });
      onClose();
    } catch (err) {
      console.error("Save contact failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const roles = tenantConfig?.contactRoles || Object.keys(ROLE_LABELS);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{contact ? "Edit Contact" : "New Contact"}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>First Name *</label>
              <input className="form-input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Last Name *</label>
              <input className="form-input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Title</label>
              <input className="form-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Head Sommelier" />
            </div>
            <div className="form-field">
              <label>Role</label>
              <select className="form-input" value={form.role} onChange={(e) => set("role", e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || formatLabel(r)}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Email</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input className="form-input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Preferred Contact</label>
              <select className="form-input" value={form.preferredContact} onChange={(e) => set("preferredContact", e.target.value)}>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div className="form-field" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
              <input type="checkbox" id="primary" checked={form.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} />
              <label htmlFor="primary" style={{ marginBottom: 0 }}>Primary Contact</label>
            </div>
            <div className="form-field form-field--full">
              <label>Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Wine preferences, meeting notes..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.firstName.trim() || !form.lastName.trim()}>
              {saving ? "Saving..." : contact ? "Update" : "Add Contact"}
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
