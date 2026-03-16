/**
 * AccountForm — Modal for creating/editing accounts.
 * Wine-specific fields: type, license, wine program, BTG, etc.
 */
import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";

const INITIAL = {
  name: "", type: "on-premise", licenseType: "restaurant",
  wineProgram: "none", channel: "", buyerName: "", buyerTitle: "",
  btgProgram: false, address: "", city: "", state: "", zip: "", region: "",
  distributorName: "", tags: [], status: "prospect",
  nextAction: "", followUpDate: "",
};

export default function AccountForm({ account, onSave, onClose }) {
  const { tenantConfig } = useData();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setForm({ ...INITIAL, ...account });
    } else {
      setForm(INITIAL);
    }
  }, [account]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error("Save account failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const cfg = tenantConfig || {};
  const accountTypes = cfg.accountTypes || INITIAL_TYPES;
  const licenseTypes = cfg.licenseTypes || [];
  const wineLevels = cfg.wineProgramLevels || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{account ? "Edit Account" : "New Account"}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label>Account Name *</label>
              <input className="form-input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>

            <div className="form-field">
              <label>Type</label>
              <select className="form-input" value={form.type} onChange={(e) => set("type", e.target.value)}>
                {accountTypes.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label>License Type</label>
              <select className="form-input" value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)}>
                {licenseTypes.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label>Wine Program</label>
              <select className="form-input" value={form.wineProgram} onChange={(e) => set("wineProgram", e.target.value)}>
                {wineLevels.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="churned">Churned</option>
              </select>
            </div>

            <div className="form-field">
              <label>Buyer Name</label>
              <input className="form-input" value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Buyer Title</label>
              <input className="form-input" value={form.buyerTitle} onChange={(e) => set("buyerTitle", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Distributor</label>
              <input className="form-input" value={form.distributorName} onChange={(e) => set("distributorName", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Channel</label>
              <input className="form-input" value={form.channel} onChange={(e) => set("channel", e.target.value)} placeholder="On-Premise / Off-Premise" />
            </div>

            <div className="form-field form-field--full">
              <label>Address</label>
              <input className="form-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>

            <div className="form-field">
              <label>City</label>
              <input className="form-input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>

            <div className="form-field">
              <label>State</label>
              <input className="form-input" value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={2} style={{ textTransform: "uppercase" }} />
            </div>

            <div className="form-field">
              <label>ZIP</label>
              <input className="form-input" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Region</label>
              <input className="form-input" value={form.region} onChange={(e) => set("region", e.target.value)} />
            </div>

            <div className="form-field">
              <label>Next Action</label>
              <select className="form-input" value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)}>
                <option value="">-- None --</option>
                {(cfg.nextActions || []).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label>Follow-up Date</label>
              <input className="form-input" type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />
            </div>

            <div className="form-field form-field--full" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="btg" checked={form.btgProgram} onChange={(e) => set("btgProgram", e.target.checked)} />
              <label htmlFor="btg" style={{ marginBottom: 0 }}>By-the-Glass Program</label>
            </div>

            <div className="form-field form-field--full">
              <label>Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(cfg.tags || []).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`pill${form.tags.includes(tag) ? " active" : ""}`}
                    onClick={() => toggleTag(tag)}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : account ? "Update" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INITIAL_TYPES = ["on-premise", "off-premise", "hybrid"];

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
