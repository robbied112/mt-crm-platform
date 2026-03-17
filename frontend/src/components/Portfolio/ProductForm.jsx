/**
 * ProductForm — Modal form for creating/editing wine products.
 * Matches the modal pattern from OpportunityForm (modal-overlay, modal-panel, etc.).
 */
import { useState, useEffect, useMemo } from "react";
import { useCrm } from "../../context/CrmContext";
import { buildNormalizedName } from "../../../../packages/pipeline/src/productNormalize.js";

const BOTTLE_SIZES = ["187ml", "375ml", "500ml", "750ml", "1L", "1.5L", "3L"];
const STATUS_OPTIONS = ["active", "archived", "discontinued"];

const INITIAL = {
  name: "",
  producer: "",
  supplier: "",
  vintage: "",
  isNV: false,
  varietal: "",
  appellation: "",
  region: "",
  country: "",
  alcoholPct: "",
  caseSize: 12,
  bottleSize: "750ml",
  sku: "",
  upc: "",
  fobPrice: "",
  tastingNotes: "",
  tagsInput: "",
  status: "active",
};

export default function ProductForm({ product, parentProduct, onSave, onClose }) {
  const { products } = useCrm();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!product;
  const isVintageMode = !!parentProduct;

  useEffect(() => {
    if (product) {
      // Edit mode — populate from existing product
      setForm({
        name: product.name || "",
        producer: product.producer || "",
        supplier: product.supplier || "",
        vintage: product.vintage || "",
        isNV: product.type === "nv" || (!product.vintage && product.type !== "vintage"),
        varietal: product.varietal || "",
        appellation: product.appellation || "",
        region: product.region || product.wineRegion || "",
        country: product.country || "",
        alcoholPct: product.alcoholPct || "",
        caseSize: product.caseSize || 12,
        bottleSize: product.bottleSize || "750ml",
        sku: product.sku || "",
        upc: product.upc || "",
        fobPrice: product.fobPrice != null ? product.fobPrice : "",
        tastingNotes: product.tastingNotes || "",
        tagsInput: Array.isArray(product.tags) ? product.tags.join(", ") : "",
        status: product.status || "active",
      });
    } else if (parentProduct) {
      // Add vintage mode — pre-fill from parent
      setForm({
        ...INITIAL,
        name: parentProduct.name || "",
        producer: parentProduct.producer || "",
        supplier: parentProduct.supplier || "",
        varietal: parentProduct.varietal || "",
        region: parentProduct.region || parentProduct.wineRegion || "",
        country: parentProduct.country || "",
        appellation: parentProduct.appellation || "",
        bottleSize: parentProduct.bottleSize || "750ml",
        caseSize: parentProduct.caseSize || 12,
        isNV: false,
      });
    }
  }, [product, parentProduct]);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (error) setError("");
  };

  // Validate vintage range
  const vintageError = useMemo(() => {
    if (form.isNV || !form.vintage) return "";
    const v = Number(form.vintage);
    if (isNaN(v) || v < 1900 || v > 2099) return "Vintage must be between 1900 and 2099";
    return "";
  }, [form.vintage, form.isNV]);

  // Dedup check
  const dupWarning = useMemo(() => {
    if (!form.name.trim()) return "";
    const normalized = buildNormalizedName(form.name);
    if (!normalized) return "";
    const dup = products.find((p) => {
      if (isEditing && p.id === product.id) return false;
      return p.normalizedName === normalized;
    });
    return dup ? `Possible duplicate of "${dup.displayName || dup.name}"` : "";
  }, [form.name, products, isEditing, product]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (vintageError) {
      setError(vintageError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const tags = form.tagsInput
        ? form.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const vintage = form.isNV ? "" : form.vintage;
      const type = form.isNV ? "nv" : (vintage ? "vintage" : "nv");
      const displayName = vintage
        ? `${form.name.trim()} ${vintage}`
        : form.name.trim();

      const data = {
        name: form.name.trim(),
        displayName,
        normalizedName: buildNormalizedName(form.name.trim()),
        producer: form.producer.trim(),
        supplier: form.supplier.trim(),
        vintage,
        type,
        varietal: form.varietal.trim(),
        appellation: form.appellation.trim(),
        region: form.region.trim(),
        country: form.country.trim(),
        alcoholPct: form.alcoholPct ? Number(form.alcoholPct) : null,
        caseSize: form.caseSize ? Number(form.caseSize) : 12,
        bottleSize: form.bottleSize,
        sku: form.sku.trim(),
        upc: form.upc.trim(),
        fobPrice: form.fobPrice !== "" ? Number(form.fobPrice) : null,
        tastingNotes: form.tastingNotes.trim(),
        tags,
        status: form.status,
      };

      // Set parentId for vintage additions
      if (isVintageMode && parentProduct) {
        data.parentId = parentProduct.id;
        data.type = "vintage";
      }

      await onSave(data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const title = isEditing
    ? "Edit Wine"
    : isVintageMode
      ? `Add Vintage \u2014 ${parentProduct.displayName || parentProduct.name}`
      : "Add Wine";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            {/* Name */}
            <div className="form-field form-field--full">
              <label>Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Chateau Margaux"
                required
              />
              {dupWarning && (
                <span className="product-form__warning">{dupWarning}</span>
              )}
            </div>

            {/* Producer */}
            <div className="form-field">
              <label>Producer</label>
              <input
                className="form-input"
                value={form.producer}
                onChange={(e) => set("producer", e.target.value)}
                placeholder="e.g. Chateau Margaux"
              />
            </div>

            {/* Supplier */}
            <div className="form-field">
              <label>Supplier</label>
              <input
                className="form-input"
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
              />
            </div>

            {/* Vintage */}
            <div className="form-field">
              <label>Vintage</label>
              <div className="product-form__vintage-row">
                <input
                  className="form-input"
                  type="number"
                  min="1900"
                  max="2099"
                  value={form.isNV ? "" : form.vintage}
                  onChange={(e) => set("vintage", e.target.value)}
                  placeholder="e.g. 2020"
                  disabled={form.isNV}
                />
                <label className="product-form__nv-label">
                  <input
                    type="checkbox"
                    checked={form.isNV}
                    onChange={(e) => {
                      set("isNV", e.target.checked);
                      if (e.target.checked) set("vintage", "");
                    }}
                  />
                  NV
                </label>
              </div>
              {vintageError && (
                <span className="product-form__error">{vintageError}</span>
              )}
            </div>

            {/* Varietal */}
            <div className="form-field">
              <label>Varietal</label>
              <input
                className="form-input"
                value={form.varietal}
                onChange={(e) => set("varietal", e.target.value)}
                placeholder="e.g. Cabernet Sauvignon"
              />
            </div>

            {/* Appellation */}
            <div className="form-field">
              <label>Appellation</label>
              <input
                className="form-input"
                value={form.appellation}
                onChange={(e) => set("appellation", e.target.value)}
                placeholder="e.g. Margaux AOC"
              />
            </div>

            {/* Region */}
            <div className="form-field">
              <label>Region</label>
              <input
                className="form-input"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="e.g. Bordeaux"
              />
            </div>

            {/* Country */}
            <div className="form-field">
              <label>Country</label>
              <input
                className="form-input"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="e.g. France"
              />
            </div>

            {/* Alcohol % */}
            <div className="form-field">
              <label>Alcohol %</label>
              <input
                className="form-input"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.alcoholPct}
                onChange={(e) => set("alcoholPct", e.target.value)}
                placeholder="e.g. 13.5"
              />
            </div>

            {/* Case Size */}
            <div className="form-field">
              <label>Case Size</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.caseSize}
                onChange={(e) => set("caseSize", e.target.value)}
              />
            </div>

            {/* Bottle Size */}
            <div className="form-field">
              <label>Bottle Size</label>
              <select
                className="form-input"
                value={form.bottleSize}
                onChange={(e) => set("bottleSize", e.target.value)}
              >
                {BOTTLE_SIZES.map((sz) => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>
            </div>

            {/* SKU */}
            <div className="form-field">
              <label>SKU</label>
              <input
                className="form-input"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
              />
            </div>

            {/* UPC */}
            <div className="form-field">
              <label>UPC</label>
              <input
                className="form-input"
                value={form.upc}
                onChange={(e) => set("upc", e.target.value)}
              />
            </div>

            {/* FOB Price */}
            <div className="form-field">
              <label>FOB Price ($)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={form.fobPrice}
                onChange={(e) => set("fobPrice", e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Status */}
            <div className="form-field">
              <label>Status</label>
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Tasting Notes */}
            <div className="form-field form-field--full">
              <label>Tasting Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.tastingNotes}
                onChange={(e) => set("tastingNotes", e.target.value)}
                placeholder="Describe the wine's character, aromas, and flavor profile..."
              />
            </div>

            {/* Tags */}
            <div className="form-field form-field--full">
              <label>Tags</label>
              <input
                className="form-input"
                value={form.tagsInput}
                onChange={(e) => set("tagsInput", e.target.value)}
                placeholder="organic, biodynamic, reserve (comma-separated)"
              />
              {form.tagsInput && (
                <div className="product-form__tags-preview">
                  {form.tagsInput.split(",").map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                    <span key={i} className="product-form__tag-pill">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <div className="product-form__error-banner">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Saving..." : isEditing ? "Update" : isVintageMode ? "Add Vintage" : "Add Wine"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
