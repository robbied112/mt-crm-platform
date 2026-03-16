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
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  loadAllData,
  loadAllViews,
  saveAllDatasets,
  saveAllViews,
  saveImport,
  loadSummary,
  saveSummary,
  loadTenantConfig,
  saveTenantConfig as saveTenantConfigFS,
} from "../services/firestoreService";
import { normalizeRows } from "../../../packages/pipeline/src/normalize.js";
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
};

export default function DataProvider({ children }) {
  const { currentUser, tenantId } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [summary, setSummary] = useState(null);
  const [tenantConfig, setTenantConfig] = useState(TENANT_CONFIG);
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
        const [allData, summaryText, config] = await Promise.all([
          useNormalized ? loadAllViews(tenantId) : loadAllData(tenantId),
          loadSummary(tenantId, collPath),
          loadTenantConfig(tenantId),
        ]);
        if (cancelled) return;
        setData({ ...EMPTY, ...allData });
        setSummary(summaryText);
        if (config) setTenantConfig((prev) => ({ ...prev, ...config }));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentUser, tenantId, useNormalized]);

  // Save imported datasets + refresh
  // When useNormalizedModel is true, also saves raw rows to imports/.
  const importDatasets = useCallback(async (datasets, summaryText, importMeta) => {
    if (!tenantId) throw new Error("No tenant context");
    try {
      const collPath = useNormalized ? "views" : "data";

      // Save raw normalized rows when using normalized model
      if (useNormalized && importMeta) {
        const { normalizedRows, ...meta } = importMeta;
        await saveImport(tenantId, meta, normalizedRows);
      }

      // Save pre-computed views/data
      if (useNormalized) {
        await saveAllViews(tenantId, datasets);
      } else {
        await saveAllDatasets(tenantId, datasets);
      }

      if (summaryText) {
        await saveSummary(tenantId, summaryText, collPath);
        setSummary(summaryText);
      }

      // Merge new data into state
      setData((prev) => {
        const next = { ...prev };
        for (const [key, val] of Object.entries(datasets)) {
          if (val !== undefined) next[key] = val;
        }
        return next;
      });
    } catch (err) {
      throw new Error(`Failed to save data: ${err.message}`);
    }
  }, [tenantId, useNormalized]);

  // Refresh from Firestore
  const refreshData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const collPath = useNormalized ? "views" : "data";
      const allData = useNormalized ? await loadAllViews(tenantId) : await loadAllData(tenantId);
      setData({ ...EMPTY, ...allData });
      const summaryText = await loadSummary(tenantId, collPath);
      setSummary(summaryText);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, useNormalized]);

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

  // Sync static TENANT_CONFIG so t() reads current values in non-React code
  useEffect(() => {
    Object.assign(TENANT_CONFIG, tenantConfig);
  }, [tenantConfig]);

  const value = {
    ...data,
    summary,
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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
