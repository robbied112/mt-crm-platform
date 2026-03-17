/**
 * OpportunityForm — Modal for creating/editing opportunities.
 * Type-aware stages, wine picker, account selector.
 */
import { useState, useEffect, useMemo } from "react";
import { useCrm } from "../context/CrmContext";

const INITIAL = {
  type: "new_placement",
  accountId: "",
  accountName: "",
  title: "",
  stage: "",
  estValue: 0,
  owner: "",
  tier: "",
  channel: "",
  state: "",
  nextStep: "",
  dueDate: "",
  notes: "",
  wines: [],
};

export default function OpportunityForm({ opportunity, prefilledAccountId, prefilledAccountName, onSave, onClose }) {
  const { accounts, products, oppTypes, getStagesForType, getDefaultValueForType } = useCrm();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [wineSearch, setWineSearch] = useState("");

  useEffect(() => {
    if (opportunity) {
      setForm({ ...INITIAL, ...opportunity });
    } else {
      const defaultType = "new_placement";
      const stages = getStagesForType(defaultType);
      setForm({
        ...INITIAL,
        stage: stages[0] || "",
        estValue: getDefaultValueForType(defaultType),
        accountId: prefilledAccountId || "",
        accountName: prefilledAccountName || "",
      });
    }
  }, [opportunity, prefilledAccountId, prefilledAccountName, getStagesForType, getDefaultValueForType]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const stages = useMemo(() => getStagesForType(form.type), [form.type, getStagesForType]);

  const handleTypeChange = (newType) => {
    const newStages = getStagesForType(newType);
    setForm((f) => ({
      ...f,
      type: newType,
      stage: newStages[0] || "",
      estValue: opportunity ? f.estValue : getDefaultValueForType(newType),
    }));
  };

  const handleAccountChange = (accountId) => {
    const acct = accounts.find((a) => a.id === accountId);
    setForm((f) => ({
      ...f,
      accountId,
      accountName: acct?.name || "",
      state: acct?.state || f.state,
      channel: acct?.channel || f.channel,
    }));
  };

  const toggleWine = (product) => {
    setForm((f) => {
      const existing = f.wines.find((w) => w.productId === product.id);
      if (existing) {
        return { ...f, wines: f.wines.filter((w) => w.productId !== product.id) };
      }
      return {
        ...f,
        wines: [...f.wines, { productId: product.id, name: product.name, vintage: product.vintage || "" }],
      };
    });
  };

  const filteredProducts = useMemo(() => {
    if (!wineSearch) return products;
    const q = wineSearch.toLowerCase();
    return products.filter(
      (p) => (p.name || "").toLowerCase().includes(q) || (p.producer || "").toLowerCase().includes(q)
    );
  }, [products, wineSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.accountId || !form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error("Save opportunity failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const typeObj = oppTypes.find((t) => t.key === form.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{opportunity ? "Edit Opportunity" : "New Opportunity"}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            {/* Account selector */}
            <div className="form-field form-field--full">
              <label>Account *</label>
              <select
                className="form-input"
                value={form.accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                required
                disabled={!!prefilledAccountId}
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="form-field">
              <label>Type *</label>
              <select className="form-input" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                {oppTypes.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Stage */}
            <div className="form-field">
              <label>Stage</label>
              <select className="form-input" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="form-field form-field--full">
              <label>Title *</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={typeObj ? `e.g. ${typeObj.label} — ${form.accountName || "Account"}` : "Opportunity title"}
                required
              />
            </div>

            {/* Value */}
            <div className="form-field">
              <label>Est. Value ($)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={form.estValue}
                onChange={(e) => set("estValue", Number(e.target.value))}
              />
            </div>

            {/* Owner */}
            <div className="form-field">
              <label>Owner</label>
              <input className="form-input" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
            </div>

            {/* Due Date */}
            <div className="form-field">
              <label>Due Date</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>

            {/* Next Step */}
            <div className="form-field">
              <label>Next Step</label>
              <input className="form-input" value={form.nextStep} onChange={(e) => set("nextStep", e.target.value)} placeholder="e.g. Schedule tasting" />
            </div>

            {/* Notes */}
            <div className="form-field form-field--full">
              <label>Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {/* Wine Picker */}
            {products.length > 0 && (
              <div className="form-field form-field--full">
                <label>Wines</label>
                {form.wines.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {form.wines.map((w) => (
                      <span key={w.productId} className="pill active" style={{ fontSize: 12, padding: "4px 10px", cursor: "pointer" }} onClick={() => toggleWine({ id: w.productId })}>
                        {w.name} {w.vintage ? `(${w.vintage})` : ""} &times;
                      </span>
                    ))}
                  </div>
                )}
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search wines to attach..."
                  value={wineSearch}
                  onChange={(e) => setWineSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {wineSearch && filteredProducts.length > 0 && (
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, background: "var(--card)" }}>
                    {filteredProducts.slice(0, 20).map((p) => {
                      const isSelected = form.wines.some((w) => w.productId === p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleWine(p)}
                          style={{
                            padding: "6px 10px", cursor: "pointer", fontSize: 13,
                            background: isSelected ? "var(--accent-light)" : "transparent",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          {p.vintage && <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: 11 }}>{p.vintage}</span>}
                          {p.producer && <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: 11 }}>— {p.producer}</span>}
                          {isSelected && <span style={{ float: "right", color: "var(--accent)" }}>&#10003;</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {wineSearch && filteredProducts.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>No wines found matching "{wineSearch}"</div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.accountId || !form.title.trim()}>
              {saving ? "Saving..." : opportunity ? "Update" : "Create Opportunity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
