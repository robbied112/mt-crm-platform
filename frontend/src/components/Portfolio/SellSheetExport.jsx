/**
 * SellSheetExport — modal for configuring and exporting product sell sheets as XLSX.
 */
import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext";
import { exportToXlsx } from "../../utils/exportXlsx";

const FIELD_DEFS = [
  { key: "name", label: "Name", always: true },
  { key: "producer", label: "Producer" },
  { key: "vintage", label: "Vintage" },
  { key: "varietal", label: "Varietal" },
  { key: "region", label: "Region" },
  { key: "caseSize", label: "Case Size" },
  { key: "bottleSize", label: "Bottle Size" },
  { key: "sku", label: "SKU" },
  { key: "tastingNotes", label: "Tasting Notes" },
];

const PRICING_OPTIONS = [
  { key: "fobPrice", label: "FOB Price" },
  { key: "srp", label: "SRP", disabled: true },
  { key: "wholesale", label: "Wholesale", disabled: true },
];

const HEADERS = {
  name: "Name",
  producer: "Producer",
  vintage: "Vintage",
  varietal: "Varietal",
  region: "Region",
  caseSize: "Case Size",
  bottleSize: "Bottle Size",
  sku: "SKU",
  tastingNotes: "Tasting Notes",
  fobPrice: "FOB Price",
  srp: "SRP",
  wholesale: "Wholesale",
};

export default function SellSheetExport({ products, onClose }) {
  const { tenantConfig } = useData();

  // Selection state — start with all selected
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(products.map((p) => p.id))
  );
  const [search, setSearch] = useState("");

  // Export options
  const [format] = useState("xlsx");
  const [pricingView, setPricingView] = useState("fobPrice");
  const [includedFields, setIncludedFields] = useState(
    () => new Set(["name", "producer", "vintage", "varietal", "region", "caseSize"])
  );
  const [companyName, setCompanyName] = useState(
    tenantConfig?.companyName || ""
  );

  // Filter products by search
  const visibleProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.producer || "").toLowerCase().includes(q) ||
        (p.varietal || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedCount = selectedIds.size;

  const toggleProduct = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(products.map((p) => p.id)));
  const selectNone = () => setSelectedIds(new Set());

  const toggleField = (key) => {
    setIncludedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = () => {
    const selected = products.filter((p) => selectedIds.has(p.id));
    if (!selected.length) return;

    // Build columns from included fields + pricing
    const columns = FIELD_DEFS.filter(
      (f) => f.always || includedFields.has(f.key)
    ).map((f) => f.key);
    columns.push(pricingView);

    // Build data rows
    const data = selected.map((p) => {
      const row = {};
      for (const col of columns) {
        if (col === "region") {
          row[col] = p.region || p.wineRegion || "";
        } else {
          row[col] = p[col] ?? "";
        }
      }
      return row;
    });

    const fileName = companyName
      ? `${companyName} - Sell Sheet`
      : "Sell Sheet";

    exportToXlsx(data, fileName, "Sell Sheet", {
      columns,
      headers: HEADERS,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel sell-sheet-export"
        style={{ maxWidth: 780 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>Export Sell Sheet</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: "16px 24px" }}>
          <div className="sell-sheet-export__layout">
            {/* Left: Product selection */}
            <div className="sell-sheet-export__products">
              <input
                type="text"
                className="sell-sheet-export__search form-input"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="sell-sheet-export__select-actions">
                <button
                  className="sell-sheet-export__select-all"
                  onClick={selectAll}
                >
                  Select All
                </button>
                <button
                  className="sell-sheet-export__select-all"
                  onClick={selectNone}
                >
                  Select None
                </button>
              </div>
              <div className="sell-sheet-export__product-list">
                {visibleProducts.map((p) => (
                  <label key={p.id} className="sell-sheet-export__product-row">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="sell-sheet-export__product-name">
                      {p.displayName || p.name}
                    </span>
                    {p.vintage && (
                      <span className="sell-sheet-export__product-vintage">
                        {p.vintage}
                      </span>
                    )}
                  </label>
                ))}
                {visibleProducts.length === 0 && (
                  <div className="sell-sheet-export__no-match">
                    No products match your search.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Export options */}
            <div className="sell-sheet-export__options">
              {/* Format */}
              <div className="sell-sheet-export__option-group">
                <div className="sell-sheet-export__option-label">Format</div>
                <div className="sell-sheet-export__format-row">
                  <button
                    className="sell-sheet-export__format-btn sell-sheet-export__format-btn--active"
                  >
                    XLSX
                  </button>
                  <button
                    className="sell-sheet-export__format-btn sell-sheet-export__format-btn--disabled"
                    disabled
                    title="PDF export coming soon"
                  >
                    PDF (coming soon)
                  </button>
                </div>
              </div>

              {/* Pricing view */}
              <div className="sell-sheet-export__option-group">
                <div className="sell-sheet-export__option-label">
                  Pricing View
                </div>
                {PRICING_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="sell-sheet-export__product-row"
                    style={opt.disabled ? { opacity: 0.5 } : undefined}
                  >
                    <input
                      type="radio"
                      name="pricingView"
                      value={opt.key}
                      checked={pricingView === opt.key}
                      disabled={opt.disabled}
                      onChange={() => setPricingView(opt.key)}
                    />
                    <span>{opt.label}</span>
                    {opt.disabled && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        (placeholder)
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Include fields */}
              <div className="sell-sheet-export__option-group">
                <div className="sell-sheet-export__option-label">
                  Include Fields
                </div>
                {FIELD_DEFS.map((f) => (
                  <label key={f.key} className="sell-sheet-export__product-row">
                    <input
                      type="checkbox"
                      checked={f.always || includedFields.has(f.key)}
                      disabled={f.always}
                      onChange={() => toggleField(f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Company name */}
              <div className="sell-sheet-export__option-group">
                <div className="sell-sheet-export__option-label">
                  Company Name
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sell-sheet-export__footer">
          <div className="sell-sheet-export__summary">
            Exporting {selectedCount} {selectedCount === 1 ? "wine" : "wines"}{" "}
            as {format.toUpperCase()}
          </div>
          <div className="sell-sheet-export__footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={!selectedCount}
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
