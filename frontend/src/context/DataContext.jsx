/**
 * DataContext — provides all CRM data from Firestore to the app.
 * Also tracks which datasets have data for adaptive UI.
 *
 * tenantId and userRole are sourced from AuthContext (single source of truth).
 *
 * Supports two storage modes (feature-flagged via tenantConfig.useNormalizedModel):
 *   false → Legacy: read/write to data/ (pre-computed dashboards only)
 *   true  → Normalized: save raw rows to imports/, compute views, read from views/
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  loadAllData,
  loadAllViews,
  saveAllDatasets,
  saveImport,
  loadSummary,
  saveSummary,
  loadTenantConfig,
  saveTenantConfig as saveTenantConfigFS,
  loadBudget,
  saveBudget as saveBudgetFS,
} from "../services/firestoreService";
import { normalizeRows } from "../utils/normalize.js";
import TENANT_CONFIG from "../config/tenant";

const DataContext = createContext(null);

export function useData() {
  return useContext(DataContext);
}

const EMPTY = {
  distScorecard: [],
  reorderData: [],
  accountsTop: [],
  pipelineAccounts: [],
  pipelineMeta: {},
  inventoryData: [],
  newWins: [],
  distHealth: [],
  reEngagementData: [],
  placementSummary: [],
  qbDistOrders: {},
  acctConcentration: {},
  skuBreakdown: [],
  spendByWine: [],
  spendByDistributor: [],
  billbackSummary: {},
  revenueByChannel: [],
  revenueByProduct: [],
  revenueSummary: {},
  arAgingSummary: {},
  apAgingSummary: {},
};

export default function DataProvider({ children }) {
  const { currentUser, tenantId } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [summary, setSummary] = useState(null);
  const [monthAxis, setMonthAxis] = useState(null);
  const [tenantConfig, setTenantConfig] = useState(TENANT_CONFIG);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // userRole for business context (supplier vs distributor) comes from tenant config,
  // distinct from auth role (admin/rep/viewer) which comes from AuthContext.
  const userRole = tenantConfig.userRole || "supplier";
  const useNormalized = tenantConfig.useNormalizedModel === true;

  // Compute which datasets have data (for adaptive UI)
  const availability = {
    depletions: data.distScorecard.length > 0,
    accounts: data.accountsTop.length > 0,
    reorder: data.reorderData.length > 0,
    inventory: data.inventoryData.length > 0,
    pipeline: data.pipelineAccounts.length > 0,
    distributorHealth: data.distHealth.length > 0,
    opportunities: data.newWins.length > 0 || data.reEngagementData.length > 0,
    billbacks: data.spendByWine.length > 0,
    revenue: data.revenueByChannel.length > 0,
    executive: true, // always visible, gracefully hides sections
    hasAnyData: Object.values(data).some((v) =>
      Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0
    ),
  };

  // Load data when tenantId becomes available
  useEffect(() => {
    if (!currentUser || !tenantId) {
      setData(EMPTY);
      setSummary(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const collPath = useNormalized ? "views" : "data";
        const [allData, summaryResult, config, budgetData] = await Promise.all([
          useNormalized ? loadAllViews(tenantId) : loadAllData(tenantId),
          loadSummary(tenantId, collPath),
          loadTenantConfig(tenantId),
          loadBudget(tenantId),
        ]);
        if (cancelled) return;
        setData({ ...EMPTY, ...allData });
        setSummary(summaryResult?.text ?? summaryResult);
        setMonthAxis(summaryResult?.monthAxis ?? null);
        if (config) setTenantConfig((prev) => ({ ...prev, ...config }));
        if (budgetData) setBudget(budgetData);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentUser, tenantId, useNormalized]);

  // Real-time listener for subscription changes (Stripe webhook updates, checkout verification).
  // Also handles grandfathering: existing tenants without subscription get a fresh 14-day trial.
  useEffect(() => {
    if (!tenantId) return;

    const tenantRef = doc(db, "tenants", tenantId);
    const unsubscribe = onSnapshot(tenantRef, (snap) => {
      if (!snap.exists()) return;
      const tenantData = snap.data();

      if (tenantData.subscription) {
        setTenantConfig((prev) => ({
          ...prev,
          subscription: tenantData.subscription,
        }));
      } else {
        // Grandfathering: tenant exists but has no subscription → treat as trial
        // The subscription field will be set on next tenant creation or manual migration.
        // For now, derive a trial that started "now" so existing users get 14 days.
        setTenantConfig((prev) => {
          if (prev.subscription) return prev; // already set from initial load
          const trialStart = new Date();
          const trialEnd = new Date(trialStart);
          trialEnd.setDate(trialEnd.getDate() + 14);
          return {
            ...prev,
            subscription: {
              status: "trial",
              plan: null,
              trialStart: trialStart.toISOString(),
              trialEnd: trialEnd.toISOString(),
              _grandfathered: true,
            },
          };
        });
      }
    }, (err) => {
      console.warn("Subscription listener error:", err.message);
    });

    return unsubscribe;
  }, [tenantId]);

  // Refresh from Firestore (data, summary, and config)
  const refreshData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const collPath = useNormalized ? "views" : "data";
      const [allData, summaryResult, config, budgetData] = await Promise.all([
        useNormalized ? loadAllViews(tenantId) : loadAllData(tenantId),
        loadSummary(tenantId, collPath),
        loadTenantConfig(tenantId),
        loadBudget(tenantId),
      ]);
      setData({ ...EMPTY, ...allData });
      setSummary(summaryResult?.text ?? summaryResult);
      setMonthAxis(summaryResult?.monthAxis ?? null);
      if (config) setTenantConfig((prev) => ({ ...prev, ...config }));
      if (budgetData) setBudget(budgetData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, useNormalized]);

  // Save imported datasets + refresh
  // When useNormalizedModel is true, saves raw rows to imports/ then calls
  // rebuildViews Cloud Function (server-authoritative) to aggregate ALL imports.
  const importDatasets = useCallback(async (datasets, summaryText, importMeta) => {
    if (!tenantId) throw new Error("No tenant context");
    try {
      const collPath = useNormalized ? "views" : "data";
      let importId = null;

      // Billback imports always need an import record for downstream extraction.
      if (importMeta && (useNormalized || importMeta.type === "billback")) {
        const { normalizedRows, rawRows, ...meta } = importMeta;
        importId = await saveImport(tenantId, meta, normalizedRows, rawRows);
      }

      if (useNormalized) {
        // Server-authoritative rebuild: rebuildViews reads ALL imports,
        // runs transformAll across combined data, and writes to views/.
        const fns = getFunctions();
        const rebuild = httpsCallable(fns, "rebuildViews");
        await rebuild({ tenantId });

        // Reload views from Firestore (server is source of truth)
        await refreshData();
      } else {
        // Legacy path: frontend writes directly to data/
        await saveAllDatasets(tenantId, datasets);

        // Merge new data into state for legacy path
        setData((prev) => {
          const next = { ...prev };
          for (const [key, val] of Object.entries(datasets)) {
            if (val !== undefined) next[key] = val;
          }
          return next;
        });
      }

      if (summaryText) {
        await saveSummary(tenantId, summaryText, collPath);
        setSummary(summaryText);
      }

      return { importId };
    } catch (err) {
      throw new Error(`Failed to save data: ${err.message}`);
    }
  }, [tenantId, useNormalized, refreshData]);

  // Save tenant config
  const updateTenantConfig = useCallback(async (patch) => {
    if (!tenantId) throw new Error("No tenant context");
    try {
      await saveTenantConfigFS(tenantId, patch);
      setTenantConfig((prev) => ({ ...prev, ...patch }));
    } catch (err) {
      throw new Error(`Failed to save config: ${err.message}`);
    }
  }, [tenantId]);

  // Save budget
  const updateBudget = useCallback(async (budgetData) => {
    if (!tenantId) throw new Error("No tenant context");
    try {
      await saveBudgetFS(tenantId, budgetData);
      setBudget(budgetData);
    } catch (err) {
      throw new Error(`Failed to save budget: ${err.message}`);
    }
  }, [tenantId]);

  // Sync static TENANT_CONFIG so t() reads current values in non-React code
  useEffect(() => {
    Object.assign(TENANT_CONFIG, tenantConfig);
  }, [tenantConfig]);

  const value = {
    ...data,
    summary,
    monthAxis,
    budget,
    tenantId,
    tenantConfig,
    userRole,
    useNormalized,
    availability,
    loading,
    error,
    importDatasets,
    refreshData,
    updateTenantConfig,
    updateBudget,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
