/**
 * Product Context — producers, master products, SKUs, and portfolios
 * with real-time Firestore listeners and CRUD.
 *
 * Lazy subscription: Firestore listeners only activate on first
 * useProducts() call, not on app boot. This avoids loading product
 * data on non-portfolio routes.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeProducers, subscribeMasterProducts, subscribeSkus, subscribePortfolios,
  createProducer as _createProducer, updateProducer as _updateProducer, deleteProducer as _deleteProducer,
  createMasterProduct as _createMasterProduct, updateMasterProduct as _updateMasterProduct, deleteMasterProduct as _deleteMasterProduct,
  createSku as _createSku, updateSku as _updateSku, deleteSku as _deleteSku,
  createPortfolio as _createPortfolio, updatePortfolio as _updatePortfolio, deletePortfolio as _deletePortfolio,
  addProducerToPortfolio as _addProducerToPortfolio,
  removeProducerFromPortfolio as _removeProducerFromPortfolio,
  getPortfolioProducers as _getPortfolioProducers,
  getPortfolioSkus as _getPortfolioSkus,
} from "../services/productService";

const ProductContext = createContext(null);

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts must be used within ProductProvider");
  // Trigger lazy subscription on first access
  ctx._activate();
  return ctx;
}

export default function ProductProvider({ children }) {
  const { tenantId } = useAuth();

  const [producers, setProducers] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [skus, setSkus] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);

  const subscribedRef = useRef(false);
  const [activated, setActivated] = useState(false);

  const _activate = useCallback(() => {
    if (!subscribedRef.current) {
      subscribedRef.current = true;
      setActivated(true);
    }
  }, []);

  // Real-time listeners — only activate after first useProducts() call
  useEffect(() => {
    if (!tenantId || !activated) return;

    setLoading(true);
    let loadCount = 0;
    const total = 4;
    const checkLoaded = () => { if (++loadCount >= total) setLoading(false); };

    const unsubs = [
      subscribeProducers(tenantId, (data) => { setProducers(data); checkLoaded(); }, checkLoaded),
      subscribeMasterProducts(tenantId, (data) => { setMasterProducts(data); checkLoaded(); }, checkLoaded),
      subscribeSkus(tenantId, (data) => { setSkus(data); checkLoaded(); }, checkLoaded),
      subscribePortfolios(tenantId, (data) => { setPortfolios(data); checkLoaded(); }, checkLoaded),
    ];

    return () => unsubs.forEach((u) => u());
  }, [tenantId, activated]);

  // ─── Derived data helpers ──────────────────────────────────────

  const getSkusForProducer = useCallback((producerId) => {
    return skus.filter((s) => s.producerId === producerId);
  }, [skus]);

  const getSkusForMasterProduct = useCallback((masterProductId) => {
    return skus.filter((s) => s.masterProductId === masterProductId);
  }, [skus]);

  const getMasterProductsForProducer = useCallback((producerId) => {
    return masterProducts.filter((mp) => mp.producerId === producerId);
  }, [masterProducts]);

  const getProducersInPortfolio = useCallback((portfolioId) => {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (!portfolio?.producerIds?.length) return [];
    const idSet = new Set(portfolio.producerIds);
    return producers.filter((p) => idSet.has(p.id));
  }, [portfolios, producers]);

  // ─── Producer CRUD ─────────────────────────────────────────────

  const createProducer = useCallback(async (data) => {
    return _createProducer(tenantId, data);
  }, [tenantId]);

  const updateProducer = useCallback(async (id, patch) => {
    return _updateProducer(tenantId, id, patch);
  }, [tenantId]);

  const deleteProducer = useCallback(async (id) => {
    return _deleteProducer(tenantId, id);
  }, [tenantId]);

  // ─── Master Product CRUD ───────────────────────────────────────

  const createMasterProduct = useCallback(async (data) => {
    return _createMasterProduct(tenantId, data);
  }, [tenantId]);

  const updateMasterProduct = useCallback(async (id, patch) => {
    return _updateMasterProduct(tenantId, id, patch);
  }, [tenantId]);

  const deleteMasterProduct = useCallback(async (id) => {
    return _deleteMasterProduct(tenantId, id);
  }, [tenantId]);

  // ─── SKU CRUD ──────────────────────────────────────────────────

  const createSku = useCallback(async (data) => {
    return _createSku(tenantId, data);
  }, [tenantId]);

  const updateSku = useCallback(async (id, patch) => {
    return _updateSku(tenantId, id, patch);
  }, [tenantId]);

  const deleteSku = useCallback(async (id) => {
    return _deleteSku(tenantId, id);
  }, [tenantId]);

  // ─── Portfolio CRUD ────────────────────────────────────────────

  const createPortfolio = useCallback(async (data) => {
    return _createPortfolio(tenantId, data);
  }, [tenantId]);

  const updatePortfolio = useCallback(async (id, patch) => {
    return _updatePortfolio(tenantId, id, patch);
  }, [tenantId]);

  const deletePortfolio = useCallback(async (id) => {
    return _deletePortfolio(tenantId, id);
  }, [tenantId]);

  const addProducerToPortfolio = useCallback(async (portfolioId, producerId) => {
    return _addProducerToPortfolio(tenantId, portfolioId, producerId);
  }, [tenantId]);

  const removeProducerFromPortfolio = useCallback(async (portfolioId, producerId) => {
    return _removeProducerFromPortfolio(tenantId, portfolioId, producerId);
  }, [tenantId]);

  const fetchPortfolioProducers = useCallback(async (portfolioId) => {
    return _getPortfolioProducers(tenantId, portfolioId);
  }, [tenantId]);

  const fetchPortfolioSkus = useCallback(async (portfolioId) => {
    return _getPortfolioSkus(tenantId, portfolioId);
  }, [tenantId]);

  const value = {
    producers, masterProducts, skus, portfolios, loading,
    _activate,
    getSkusForProducer, getSkusForMasterProduct, getMasterProductsForProducer,
    getProducersInPortfolio,
    createProducer, updateProducer, deleteProducer,
    createMasterProduct, updateMasterProduct, deleteMasterProduct,
    createSku, updateSku, deleteSku,
    createPortfolio, updatePortfolio, deletePortfolio,
    addProducerToPortfolio, removeProducerFromPortfolio,
    fetchPortfolioProducers, fetchPortfolioSkus,
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}
