/**
 * ProductSheetReviewStep — editable review table for product-sheet uploads.
 *
 * Rendered by DataImport when the detected upload type is "product_sheet".
 * Transforms raw parsed rows into product objects, shows dedup status against
 * existing catalog, and lets the user select which products to import.
 */
import { useState, useMemo } from "react";
import { useCrm } from "../context/CrmContext";
import { extractVintage, clientExactMatch, buildNormalizedName } from "../utils/productNormalize";

// Grape / varietal keywords — if the category value contains one of these, treat it as a varietal.
const VARIETAL_KEYWORDS = [
  "cabernet", "merlot", "pinot", "chardonnay", "sauvignon", "syrah", "shiraz",
  "zinfandel", "riesling", "malbec", "tempranillo", "grenache", "sangiovese",
  "nebbiolo", "viognier", "chenin", "semillon", "mourvedre", "barbera",
  "gamay", "gruner", "albarino", "verdejo", "garnacha", "carignan",
  "blend", "rose", "rosé", "sparkling", "prosecco", "champagne",
];

function looksLikeVarietal(value) {
  if (!value || typeof value !== "string") return false;
  const lower = value.toLowerCase();
  return VARIETAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Transform raw rows + mapping into product objects.
 */
function buildProducts(rows, mapping) {
  return rows.map((row) => {
    const categoryVal = row[mapping.category] || "";
    const skuVal = row[mapping.sku] || "";

    return {
      name: skuVal || row[mapping.acct] || "",
      producer: row[mapping.producer] || row[mapping.dist] || "",
      vintage: extractVintage(categoryVal) || extractVintage(skuVal) || null,
      varietal: looksLikeVarietal(categoryVal) ? categoryVal : "",
      region: row[mapping.region] || row[mapping.wineRegion] || "",
      sku: skuVal,
      fobPrice: parseFloat(row[mapping.unitPrice] || row[mapping.revenue]) || null,
      caseSize: parseInt(row[mapping.size] || row[mapping.caseSize]) || 12,
      bottleSize: row[mapping.bottleSize] || "750ml",
    };
  }).filter((p) => p.name); // drop rows with no name
}

export default function ProductSheetReviewStep({ rows, headers, mapping, onConfirm, onCancel }) {
  const { products: existingProducts } = useCrm();

  // Build initial product list from rows
  const initialProducts = useMemo(() => buildProducts(rows, mapping), [rows, mapping]);

  const [products, setProducts] = useState(initialProducts);

  // Dedup check: find which product names match existing catalog
  const duplicateSet = useMemo(() => {
    const names = products.map((p) => p.name);
    const { matched } = clientExactMatch(names, existingProducts);
    return new Set(matched.keys());
  }, [products, existingProducts]);

  // Selection state: all selected by default, duplicates unchecked
  const [selected, setSelected] = useState(() => {
    const init = {};
    initialProducts.forEach((p, i) => {
      const isDup = (() => {
        const names = [p.name];
        const { matched } = clientExactMatch(names, existingProducts);
        return matched.size > 0;
      })();
      init[i] = !isDup;
    });
    return init;
  });

  const [importing, setImporting] = useState(false);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const duplicateCount = products.filter((p) => duplicateSet.has(p.name)).length;

  // Inline edit handler
  const updateField = (idx, field, value) => {
    setProducts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleAll = () => {
    const allSelected = selectedCount === products.length;
    const next = {};
    products.forEach((_, i) => { next[i] = !allSelected; });
    setSelected(next);
  };

  const handleConfirm = () => {
    if (importing) return;
    setImporting(true);
    const selectedProducts = products.filter((_, i) => selected[i]);
    // Enrich with normalizedName before saving
    const enriched = selectedProducts.map((p) => ({
      ...p,
      normalizedName: buildNormalizedName(p.name),
      fobPrice: p.fobPrice ? parseFloat(p.fobPrice) : null,
      caseSize: parseInt(p.caseSize) || 12,
      vintage: p.vintage || null,
    }));
    onConfirm(enriched);
  };

  return (
    <div>
      <div className="product-sheet-review__header">
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Review Product Sheet</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B6B6B" }}>
            {products.length} products extracted
            {duplicateCount > 0 && (
              <span className="product-sheet-review__badge--duplicate">
                {duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Back</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0 || importing}
          >
            {importing ? "Importing…" : `Import ${selectedCount} Product${selectedCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      <div style={{ background: "rgba(139, 106, 76, 0.08)", border: "1px solid rgba(139, 106, 76, 0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8B6A4C", marginBottom: 16 }}>
        Review extracted products before adding them to your portfolio. Duplicates are unchecked by default.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="product-sheet-review__table">
          <thead>
            <tr>
              <th className="product-sheet-review__th">
                <input
                  type="checkbox"
                  checked={selectedCount === products.length}
                  onChange={toggleAll}
                  className="product-sheet-review__checkbox"
                />
              </th>
              <th className="product-sheet-review__th">Name</th>
              <th className="product-sheet-review__th">Producer</th>
              <th className="product-sheet-review__th">Vintage</th>
              <th className="product-sheet-review__th">Varietal</th>
              <th className="product-sheet-review__th">SKU</th>
              <th className="product-sheet-review__th">FOB Price</th>
              <th className="product-sheet-review__th">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => {
              const isDuplicate = duplicateSet.has(product.name);
              return (
                <tr
                  key={idx}
                  className={`product-sheet-review__row${isDuplicate ? " product-sheet-review__row--duplicate" : ""}`}
                >
                  <td className="product-sheet-review__cell">
                    <input
                      type="checkbox"
                      checked={!!selected[idx]}
                      onChange={() => toggleSelect(idx)}
                      className="product-sheet-review__checkbox"
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => updateField(idx, "name", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ minWidth: 180 }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.producer}
                      onChange={(e) => updateField(idx, "producer", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ minWidth: 120 }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.vintage || ""}
                      onChange={(e) => updateField(idx, "vintage", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ width: 70, textAlign: "center" }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.varietal}
                      onChange={(e) => updateField(idx, "varietal", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ minWidth: 110 }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.sku}
                      onChange={(e) => updateField(idx, "sku", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ minWidth: 100 }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    <input
                      type="text"
                      value={product.fobPrice ?? ""}
                      onChange={(e) => updateField(idx, "fobPrice", e.target.value)}
                      className="product-sheet-review__input"
                      style={{ width: 80, textAlign: "right" }}
                    />
                  </td>
                  <td className="product-sheet-review__cell">
                    {isDuplicate && (
                      <span className="product-sheet-review__badge--duplicate">Duplicate</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="product-sheet-review__summary">
        <span style={{ fontSize: 13, color: "#2E2E2E" }}>
          {selectedCount} product{selectedCount !== 1 ? "s" : ""} selected
          {duplicateCount > 0 && `, ${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} found`}
        </span>
        <div className="product-sheet-review__actions">
          <button className="btn btn-secondary" onClick={onCancel}>Back</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0 || importing}
          >
            {importing ? "Importing…" : "Confirm & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
