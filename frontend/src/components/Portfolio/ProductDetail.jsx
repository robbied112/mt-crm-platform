/**
 * ProductDetail — wine/product detail page with spend data, vintages, and edit.
 */
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCrm } from "../../context/CrmContext";
import { useData } from "../../context/DataContext";
import ProductForm from "./ProductForm";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "--";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { products, updateProduct, createProduct, deleteProduct } = useCrm();
  const { spendByWine } = useData();

  const [editMode, setEditMode] = useState(false);
  const [addVintage, setAddVintage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  // Vintage children (if this is a parent wine)
  const childVintages = useMemo(
    () => products.filter((p) => p.type === "vintage" && p.parentId === productId),
    [products, productId]
  );

  // Sibling vintages (if this IS a vintage)
  const siblingVintages = useMemo(() => {
    if (!product || product.type !== "vintage" || !product.parentId) return [];
    return products.filter(
      (p) => p.type === "vintage" && p.parentId === product.parentId && p.id !== productId
    );
  }, [products, product, productId]);

  const vintageList = childVintages.length > 0 ? childVintages : siblingVintages;
  const isParentWine = product && product.type !== "vintage";

  // Match spend data by wine name
  const spendData = useMemo(() => {
    if (!product || !Array.isArray(spendByWine)) return null;
    const name = (product.displayName || product.name || "").toLowerCase();
    return spendByWine.find((s) => (s.wine || "").toLowerCase() === name) || null;
  }, [product, spendByWine]);

  if (!product) {
    return (
      <div className="product-detail">
        <div className="product-detail__not-found">
          <h3 className="product-detail__not-found-title">Product not found</h3>
          <p className="product-detail__not-found-text">
            This product may have been removed or the link is invalid.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate("/portfolio")}>
            Back to Portfolio
          </button>
        </div>
      </div>
    );
  }

  const handleUpdate = async (data) => {
    await updateProduct(productId, data);
  };

  const handleCreateVintage = async (data) => {
    await createProduct(data);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Cascade: delete child vintages first if this is a parent wine
      if (isParentWine && childVintages.length > 0) {
        await Promise.all(childVintages.map((v) => deleteProduct(v.id)));
      }
      await deleteProduct(productId);
      navigate("/portfolio");
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="product-detail">
      {/* Back nav */}
      <button className="product-detail__back" onClick={() => navigate("/portfolio")}>
        &larr; Back to Portfolio
      </button>

      {/* Header */}
      <div className="product-detail__header">
        <div className="product-detail__header-info">
          <h1 className="product-detail__name">
            {product.displayName || product.name}
          </h1>
          <div className="product-detail__badges">
            {product.vintage && (
              <span className="product-detail__badge product-detail__badge--vintage">
                {product.vintage}
              </span>
            )}
            <span className={`product-detail__badge product-detail__badge--${product.status || "active"}`}>
              {product.status || "active"}
            </span>
          </div>
        </div>
        <div className="product-detail__header-actions">
          {isParentWine && (
            <button className="btn btn-secondary" onClick={() => setAddVintage(true)}>
              Add Vintage
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setEditMode(true)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      {/* Producer / Supplier */}
      {(product.producer || product.supplier) && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">Producer / Supplier</h3>
          <div className="product-detail__meta-row">
            {product.producer && (
              <div className="product-detail__meta-item">
                <span className="product-detail__meta-label">Producer</span>
                <span className="product-detail__meta-value">{product.producer}</span>
              </div>
            )}
            {product.supplier && (
              <div className="product-detail__meta-item">
                <span className="product-detail__meta-label">Supplier</span>
                <span className="product-detail__meta-value">{product.supplier}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wine Details Grid */}
      <div className="product-detail__section">
        <h3 className="product-detail__section-title">Wine Details</h3>
        <div className="product-detail__grid">
          <DetailCell label="Varietal" value={product.varietal} />
          <DetailCell label="Appellation" value={product.appellation} />
          <DetailCell label="Region" value={product.region || product.wineRegion} />
          <DetailCell label="Country" value={product.country} />
          <DetailCell label="Alcohol %" value={product.alcoholPct ? `${product.alcoholPct}%` : null} />
          <DetailCell label="Bottle Size" value={product.bottleSize} />
          <DetailCell label="Case Size" value={product.caseSize} />
          <DetailCell label="SKU" value={product.sku} />
          <DetailCell label="UPC" value={product.upc} />
        </div>
      </div>

      {/* FOB Price */}
      {product.fobPrice != null && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">FOB Price</h3>
          <div className="product-detail__price">{fmt(product.fobPrice)}</div>
        </div>
      )}

      {/* Tasting Notes */}
      {product.tastingNotes && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">Tasting Notes</h3>
          <p className="product-detail__tasting-notes">{product.tastingNotes}</p>
        </div>
      )}

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">Tags</h3>
          <div className="product-detail__tags">
            {product.tags.map((tag, i) => (
              <span key={i} className="product-detail__tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Vintage Timeline */}
      {vintageList.length > 0 && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">
            {childVintages.length > 0 ? "Vintages" : "Sibling Vintages"}
          </h3>
          <div className="product-detail__vintages">
            {vintageList.map((v) => (
              <div
                key={v.id}
                className="product-detail__vintage-card"
                onClick={() => navigate(`/portfolio/${v.id}`)}
              >
                <span className="product-detail__vintage-card-year">
                  {v.vintage || "NV"}
                </span>
                <span className="product-detail__vintage-card-name">
                  {v.displayName || v.name}
                </span>
                <span className="product-detail__vintage-card-price">
                  {fmt(v.fobPrice)}
                </span>
                <span className={`product-detail__badge product-detail__badge--${v.status || "active"}`}>
                  {v.status || "active"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spend Data */}
      {spendData && (
        <div className="product-detail__section">
          <h3 className="product-detail__section-title">Trade Spend</h3>
          <div className="product-detail__grid">
            <DetailCell label="Total Spend" value={fmt(spendData.totalSpend)} />
            <DetailCell label="Cases" value={spendData.totalQty != null ? spendData.totalQty : null} />
            <DetailCell
              label="Spend / Case"
              value={spendData.spendPerCase != null ? fmt(spendData.spendPerCase) : null}
            />
            <DetailCell
              label="Billback Count"
              value={spendData.billbackCount != null ? spendData.billbackCount : null}
            />
          </div>
          {spendData.distributors && spendData.distributors.length > 0 && (
            <div className="product-detail__distributors">
              <span className="product-detail__meta-label">Distributors</span>
              <div className="product-detail__distributor-badges">
                {spendData.distributors.map((d, i) => (
                  <span key={i} className="product-detail__distributor-badge">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editMode && (
        <ProductForm
          product={product}
          onSave={handleUpdate}
          onClose={() => setEditMode(false)}
        />
      )}

      {/* Add Vintage Modal */}
      {addVintage && (
        <ProductForm
          parentProduct={product}
          onSave={handleCreateVintage}
          onClose={() => setAddVintage(false)}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Product</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(false)} disabled={deleting}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Permanently delete <strong>{product.displayName || product.name}</strong>?
                {isParentWine && childVintages.length > 0 && (
                  <span> This will also delete {childVintages.length} vintage{childVintages.length > 1 ? "s" : ""}.</span>
                )}
                {" "}This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Detail cell helper ────────────────────────────────────────── */

function DetailCell({ label, value }) {
  return (
    <div className="product-detail__cell">
      <span className="product-detail__cell-label">{label}</span>
      <span className="product-detail__cell-value">{value || "--"}</span>
    </div>
  );
}
