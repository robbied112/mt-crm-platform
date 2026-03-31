/**
 * BlueprintContext — provides AI-generated dashboard blueprint and computed data.
 *
 * Loads the active blueprint from Firestore and provides lazy-loaded
 * computed data per tab. Real-time listener detects new blueprints.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";

const BlueprintContext = createContext(null);

export function useBlueprint() {
  return useContext(BlueprintContext);
}

export function BlueprintProvider({ children }) {
  const { tenantId } = useAuth();
  const [blueprint, setBlueprint] = useState(null);
  const [computedData, setComputedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [filters, setFilters] = useState({});
  const blueprintIdRef = useRef(null);
  const loadedTabsRef = useRef(new Set());

  // Listen for active blueprint changes
  useEffect(() => {
    if (!tenantId) {
      setBlueprint(null);
      setComputedData({});
      setLoading(false);
      return;
    }

    const activeRef = doc(db, "tenants", tenantId, "reportBlueprints", "active");

    const unsub = onSnapshot(activeRef, async (snap) => {
      const data = snap.data();
      if (!data?.blueprintId) {
        setBlueprint(null);
        setLoading(false);
        return;
      }

      // Only reload if blueprint ID changed
      if (data.blueprintId === blueprintIdRef.current) return;
      blueprintIdRef.current = data.blueprintId;
      loadedTabsRef.current = new Set();
      setComputedData({});

      try {
        const bpRef = doc(db, "tenants", tenantId, "reportBlueprints", data.blueprintId);
        const bpSnap = await getDoc(bpRef);

        if (bpSnap.exists()) {
          const bpData = bpSnap.data();
          setBlueprint(bpData);
          // Set first tab as active if none selected
          if (bpData.tabs?.length > 0) {
            setActiveTab(bpData.tabs[0].id);
          }
        } else {
          setBlueprint(null);
        }
      } catch (err) {
        console.error("[BlueprintContext] Failed to load blueprint:", err.message);
        setBlueprint(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [tenantId]);

  // Lazy-load computed data for the active tab
  useEffect(() => {
    if (!tenantId || !blueprintIdRef.current || !activeTab) return;
    if (loadedTabsRef.current.has(activeTab)) return;

    const loadTabData = async () => {
      try {
        const tabRef = doc(
          db,
          "tenants", tenantId,
          "reportBlueprints", blueprintIdRef.current,
          "computedData", activeTab
        );
        const tabSnap = await getDoc(tabRef);

        if (tabSnap.exists()) {
          const data = tabSnap.data();

          // Check if chunked
          if (data.chunked) {
            const rowsRef = collection(tabRef, "rows");
            const rowsSnap = await getDocs(rowsRef);
            const chunks = [];
            rowsSnap.forEach((d) => chunks.push({ id: d.id, ...d.data() }));
            chunks.sort((a, b) => Number(a.id) - Number(b.id));

            const allItems = [];
            for (const chunk of chunks) {
              if (chunk.items) allItems.push(...chunk.items);
            }

            setComputedData((prev) => ({ ...prev, [activeTab]: { sections: data.sections || allItems } }));
          } else {
            setComputedData((prev) => ({ ...prev, [activeTab]: data }));
          }

          loadedTabsRef.current.add(activeTab);
        }
      } catch (err) {
        console.error(`[BlueprintContext] Failed to load tab data for ${activeTab}:`, err.message);
      }
    };

    loadTabData();
  }, [tenantId, activeTab]);

  // Apply client-side filters to computed data
  const getFilteredData = useCallback(
    (sectionId) => {
      const tabData = computedData[activeTab];
      if (!tabData?.sections) return [];

      let rows = tabData.sections[sectionId] || [];
      if (!Array.isArray(rows)) return rows;

      // Apply active filters
      const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== "all");
      if (activeFilters.length === 0) return rows;

      return rows.filter((row) =>
        activeFilters.every(([filterId, filterValue]) => {
          const filterDef = blueprint?.globalFilters?.find((f) => f.id === filterId);
          if (!filterDef) return true;
          const rowVal = String(row[filterDef.sourceColumn] || "");
          if (Array.isArray(filterValue)) return filterValue.includes(rowVal);
          return rowVal === filterValue;
        })
      );
    },
    [computedData, activeTab, filters, blueprint]
  );

  const value = {
    blueprint,
    computedData,
    loading,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    getFilteredData,
    hasBlueprint: !!blueprint,
  };

  return (
    <BlueprintContext.Provider value={value}>
      {children}
    </BlueprintContext.Provider>
  );
}
