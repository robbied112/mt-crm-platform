/**
 * PortfolioList — wine portfolio list with search, filters, sort, and grouped view.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../../context/CrmContext";
import { useData } from "../../context/DataContext";
import ProductForm from "./ProductForm";
import SellSheetExport from "./SellSheetExport";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "--";

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "producer", label: "Producer" },
  { key: "vintage", label: "Vintage" },
  { key: "varietal", label: "Varietal" },
];

export default function PortfolioList() {
  const navigate = useNavigate();
  const { products, createProduct } = useCrm();
  const { spendByWine } = useData();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "producer"
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [showForm, setShowForm] = useState(false);
  const [showSellSheet, setShowSellSheet] = useState(false);

  // Filter pills state
  const [filterProducer, setFilterProducer] = useState("");
  const [filterVarietal, setFilterVarietal] = useState("");
  const [filterCountry, setFilterCountry] = useState("");

  // Derive filter options from products
  const filterOptions = useMemo(() => {
    const producers = new Set();
    const varietals = new Set();
    const countries = new Set();
    for (const p of products) {
      if (p.producer) producers.add(p.producer);
      if (p.varietal) varietals.add(p.varietal);
      if (p.country) countries.add(p.country);
    }
    return {
      producers: [...producers].sort(),
      varietals: [...varietals].sort(),
      countries: [...countries].sort(),
    };
  }, [products]);

  const hasActiveFilters = filterProducer || filterVarietal || filterCountry;

  // Filter + sort products
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = products;

    // Search
    if (q) {
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.producer || "").toLowerCase().includes(q) ||
          (p.varietal || "").toLowerCase().includes(q)
      );
    }

    // Filter pills
    if (filterProducer) {
      list = list.filter((p) => p.producer === filterProducer);
    }
    if (filterVarietal) {
      list = list.filter((p) => p.varietal === filterVarietal);
    }
    if (filterCountry) {
      list = list.filter((p) => p.country === filterCountry);
    }

    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortBy] || "";
      const bv = b[sortBy] || "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [products, search, filterProducer, filterVarietal, filterCountry, sortBy, sortDir]);

  // Separate parent wines and vintage SKUs
  const parentWines = useMemo(() => filtered.filter((p) => p.type !== "vintage"), [filtered]);
  const vintagesByParent = useMemo(() => {
    const map = {};
    for (const p of filtered) {
      if (p.type === "vintage" && p.parentId) {
        if (!map[p.parentId]) map[p.parentId] = [];
        map[p.parentId].push(p);
      }
    }
    return map;
  }, [filtered]);

  // Grouped by producer
  const groupedByProducer = useMemo(() => {
    const map = {};
    for (const p of parentWines) {
      const key = p.producer || "Unknown Producer";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [parentWines]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col) =>
    sortBy === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  const clearFilters = () => {
    setFilterProducer("");
    setFilterVarietal("");
    setFilterCountry("");
  };

  const handleSave = async (data) => {
    await createProduct(data);
  };

  // Empty state
  if (!products.length) {
    return (
      <div className="portfolio">
        <div className="portfolio__empty">
          <div className="portfolio__empty-icon">&#127863;</div>
          <h3 className="portfolio__empty-title">Your wine portfolio is empty</h3>
          <p className="portfolio__empty-text">
            Add your first wine to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Add Wine
          </button>
        </div>
        {showForm && (
          <ProductForm onSave={handleSave} onClose={() => setShowForm(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="portfolio">
      {/* Header */}
      <div className="portfolio__header">
        <div className="portfolio__title-row">
          <h2 className="portfolio__title">Portfolio</h2>
          <span className="portfolio__count">{products.length}</span>
        </div>
        <div className="portfolio__actions">
          <button className="btn btn-secondary" onClick={() => setShowSellSheet(true)}>
            Export Sell Sheet
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Add Wine
          </button>
        </div>
      </div>

      {/* Search + View Toggle */}
      <div className="portfolio__toolbar">
        <input
          type="text"
          className="portfolio__search form-input"
          placeholder="Search by name, producer, or varietal..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="portfolio__view-toggle">
          <button
            className={`portfolio__view-btn ${viewMode === "list" ? "portfolio__view-btn--active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            className={`portfolio__view-btn ${viewMode === "producer" ? "portfolio__view-btn--active" : ""}`}
            onClick={() => setViewMode("producer")}
          >
            By Producer
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="portfolio__filters">
        <select
          className="portfolio__filter-select form-input"
          value={filterProducer}
          onChange={(e) => setFilterProducer(e.target.value)}
        >
          <option value="">All Producers</option>
          {filterOptions.producers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          className="portfolio__filter-select form-input"
          value={filterVarietal}
          onChange={(e) => setFilterVarietal(e.target.value)}
        >
          <option value="">All Varietals</option>
          {filterOptions.varietals.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          className="portfolio__filter-select form-input"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="">All Countries</option>
          {filterOptions.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button className="portfolio__filter-clear" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Sort controls (list view) */}
      {viewMode === "list" && (
        <div className="portfolio__sort-row">
          <span className="portfolio__sort-label">Sort by:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`portfolio__sort-btn ${sortBy === opt.key ? "portfolio__sort-btn--active" : ""}`}
              onClick={() => toggleSort(opt.key)}
            >
              {opt.label}{sortIcon(opt.key)}
            </button>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="portfolio-list">
          <div className="portfolio-list__table-wrap">
            <table className="portfolio-list__table">
              <thead>
                <tr className="portfolio-list__thead-row">
                  <th className="portfolio-list__th" onClick={() => toggleSort("name")}>
                    Name{sortIcon("name")}
                  </th>
                  <th className="portfolio-list__th" onClick={() => toggleSort("producer")}>
                    Producer{sortIcon("producer")}
                  </th>
                  <th className="portfolio-list__th" onClick={() => toggleSort("vintage")}>
                    Vintage{sortIcon("vintage")}
                  </th>
                  <th className="portfolio-list__th" onClick={() => toggleSort("varietal")}>
                    Varietal{sortIcon("varietal")}
                  </th>
                  <th className="portfolio-list__th">Region</th>
                  <th className="portfolio-list__th">Case Size</th>
                  <th className="portfolio-list__th">FOB Price</th>
                  <th className="portfolio-list__th">Status</th>
                </tr>
              </thead>
              <tbody>
                {parentWines.map((product) => (
                  <PortfolioRow
                    key={product.id}
                    product={product}
                    vintages={vintagesByParent[product.id]}
                    navigate={navigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="portfolio-list__no-results">
              No wines match your search or filters.
            </div>
          )}
        </div>
      )}

      {/* By Producer View */}
      {viewMode === "producer" && (
        <div className="portfolio-producers">
          {groupedByProducer.map(([producer, wines]) => (
            <ProducerCard
              key={producer}
              producer={producer}
              wines={wines}
              navigate={navigate}
            />
          ))}
          {groupedByProducer.length === 0 && (
            <div className="portfolio-list__no-results">
              No wines match your search or filters.
            </div>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm onSave={handleSave} onClose={() => setShowForm(false)} />
      )}

      {/* Sell Sheet Export Modal */}
      {showSellSheet && (
        <SellSheetExport
          products={products}
          onClose={() => setShowSellSheet(false)}
        />
      )}
    </div>
  );
}

/* ─── Row with indented vintage SKUs ────────────────────────────── */

function PortfolioRow({ product, vintages, navigate }) {
  return (
    <>
      <tr
        className="portfolio-list__row"
        onClick={() => navigate(`/portfolio/${product.id}`)}
      >
        <td className="portfolio-list__td portfolio-list__td--name">
          {product.displayName || product.name}
        </td>
        <td className="portfolio-list__td">{product.producer || "--"}</td>
        <td className="portfolio-list__td">
          {product.vintage ? (
            <span className="portfolio-list__vintage-badge">{product.vintage}</span>
          ) : (
            <span className="portfolio-list__empty">--</span>
          )}
        </td>
        <td className="portfolio-list__td">{product.varietal || "--"}</td>
        <td className="portfolio-list__td">{product.region || product.wineRegion || "--"}</td>
        <td className="portfolio-list__td">{product.caseSize || "--"}</td>
        <td className="portfolio-list__td">{fmt(product.fobPrice)}</td>
        <td className="portfolio-list__td">
          <span className={`portfolio-list__status portfolio-list__status--${product.status || "active"}`}>
            {product.status || "active"}
          </span>
        </td>
      </tr>
      {vintages && vintages.map((v) => (
        <tr
          key={v.id}
          className="portfolio-list__row portfolio-list__row--vintage"
          onClick={() => navigate(`/portfolio/${v.id}`)}
        >
          <td className="portfolio-list__td portfolio-list__td--name portfolio-list__td--indented">
            {v.displayName || v.name}
          </td>
          <td className="portfolio-list__td">{v.producer || "--"}</td>
          <td className="portfolio-list__td">
            <span className="portfolio-list__vintage-badge">{v.vintage}</span>
          </td>
          <td className="portfolio-list__td">{v.varietal || "--"}</td>
          <td className="portfolio-list__td">{v.region || v.wineRegion || "--"}</td>
          <td className="portfolio-list__td">{v.caseSize || "--"}</td>
          <td className="portfolio-list__td">{fmt(v.fobPrice)}</td>
          <td className="portfolio-list__td">
            <span className={`portfolio-list__status portfolio-list__status--${v.status || "active"}`}>
              {v.status || "active"}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ─── Producer card for grouped view ────────────────────────────── */

function ProducerCard({ producer, wines, navigate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="portfolio-producer-card">
      <div
        className="portfolio-producer-card__header"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="portfolio-producer-card__info">
          <h3 className="portfolio-producer-card__name">{producer}</h3>
          <span className="portfolio-producer-card__count">
            {wines.length} {wines.length === 1 ? "wine" : "wines"}
          </span>
        </div>
        <span className="portfolio-producer-card__chevron">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </div>
      {expanded && (
        <div className="portfolio-producer-card__body">
          {wines.map((w) => (
            <div
              key={w.id}
              className="portfolio-producer-card__wine"
              onClick={() => navigate(`/portfolio/${w.id}`)}
            >
              <span className="portfolio-producer-card__wine-name">
                {w.displayName || w.name}
              </span>
              {w.vintage && (
                <span className="portfolio-list__vintage-badge">{w.vintage}</span>
              )}
              <span className="portfolio-producer-card__wine-varietal">
                {w.varietal || ""}
              </span>
              <span className="portfolio-producer-card__wine-price">
                {fmt(w.fobPrice)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
