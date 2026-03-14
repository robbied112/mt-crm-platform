/**
 * Firestore Service — CRUD operations for tenant data.
 */
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const DATASETS = [
  "distScorecard",
  "reorderData",
  "accountsTop",
  "pipelineAccounts",
  "pipelineMeta",
  "inventoryData",
  "newWins",
  "distHealth",
  "reEngagementData",
  "placementSummary",
  "qbDistOrders",
  "acctConcentration",
];

/**
 * Load all datasets for a tenant.
 * Returns an object keyed by dataset name.
 */
export async function loadAllData(tenantId = "default") {
  const result = {};
  const promises = DATASETS.map(async (name) => {
    try {
      const snap = await getDoc(doc(db, "tenants", tenantId, "data", name));
      if (snap.exists()) {
        const data = snap.data();
        result[name] = data.items ?? data;
      } else {
        result[name] = name === "pipelineMeta" || name === "qbDistOrders" || name === "acctConcentration"
          ? {} : [];
      }
    } catch {
      result[name] = name === "pipelineMeta" || name === "qbDistOrders" || name === "acctConcentration"
        ? {} : [];
    }
  });
  await Promise.all(promises);
  return result;
}

/**
 * Save a single dataset.
 */
export async function saveDataset(tenantId = "default", name, items) {
  const isObject = !Array.isArray(items);
  await setDoc(doc(db, "tenants", tenantId, "data", name), {
    ...(isObject ? items : { items }),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Save multiple datasets at once.
 */
export async function saveAllDatasets(tenantId = "default", datasets) {
  const promises = Object.entries(datasets).map(([name, items]) => {
    if (items !== undefined && DATASETS.includes(name)) {
      return saveDataset(tenantId, name, items);
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
}

/**
 * Load tenant config from Firestore.
 */
export async function loadTenantConfig(tenantId = "default") {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "config", "main"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Save tenant config (merges with existing).
 */
export async function saveTenantConfig(tenantId = "default", config) {
  await setDoc(doc(db, "tenants", tenantId, "config", "main"), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Log an upload event.
 */
export async function logUpload(tenantId = "default", metadata) {
  await addDoc(collection(db, "tenants", tenantId, "uploads"), {
    ...metadata,
    createdAt: serverTimestamp(),
  });
}

/**
 * Load the executive summary.
 */
export async function loadSummary(tenantId = "default") {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "data", "_summary"));
    return snap.exists() ? snap.data().text : null;
  } catch {
    return null;
  }
}

/**
 * Save the executive summary.
 */
export async function saveSummary(tenantId = "default", text) {
  await setDoc(doc(db, "tenants", tenantId, "data", "_summary"), {
    text,
    updatedAt: serverTimestamp(),
  });
}
