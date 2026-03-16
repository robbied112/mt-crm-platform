/**
 * Firestore Service — CRUD operations for tenant data.
 *
 * ─── Chunked Storage ───────────────────────────────────────
 *
 *  SAVE FLOW (for arrays > CHUNK_SIZE items):
 *  items[] ──▶ chunk into groups of 500
 *           ──▶ write metadata {version: N+1, chunked: true, count}
 *           ──▶ write rows/0, rows/1, ... (parallel, tagged with version)
 *           ──▶ delete rows with version < N+1
 *
 *  LOAD FLOW:
 *  read metadata ──▶ chunked?
 *    ├── false: return items from metadata doc directly
 *    └── true:  read all rows/* docs (parallel)
 *              ──▶ filter to current version
 *              ──▶ sort by chunk index
 *              ──▶ flatten into single array
 *
 *  Small datasets (<= 500 items) stay as single documents for efficiency.
 */
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, getDocs,
  query, orderBy, limit as fbLimit, where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const CHUNK_SIZE = 500;

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

const OBJECT_DATASETS = new Set(["pipelineMeta", "qbDistOrders", "acctConcentration"]);

function emptyForDataset(name) {
  return OBJECT_DATASETS.has(name) ? {} : [];
}

// ─── Dataset Load ────────────────────────────────────────────

/**
 * Load a single dataset, handling both chunked and non-chunked storage.
 */
async function loadDataset(tenantId, name) {
  try {
    const metaRef = doc(db, "tenants", tenantId, "data", name);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return emptyForDataset(name);
    }

    const meta = metaSnap.data();

    // Non-chunked: items stored directly in the metadata doc
    if (!meta.chunked) {
      return meta.items ?? meta;
    }

    // Chunked: read all row documents for the current version
    const rowsRef = collection(db, "tenants", tenantId, "data", name, "rows");
    const rowsQuery = query(rowsRef, where("version", "==", meta.version));
    const rowsSnap = await getDocs(rowsQuery);

    if (rowsSnap.empty) {
      return emptyForDataset(name);
    }

    // Sort by chunk index and flatten
    const chunks = rowsSnap.docs
      .map((d) => ({ idx: d.data().idx, items: d.data().items }))
      .sort((a, b) => a.idx - b.idx);

    return chunks.flatMap((c) => c.items);
  } catch {
    return emptyForDataset(name);
  }
}

/**
 * Load all datasets for a tenant (parallel).
 */
export async function loadAllData(tenantId) {
  const result = {};
  const promises = DATASETS.map(async (name) => {
    result[name] = await loadDataset(tenantId, name);
  });
  await Promise.all(promises);
  return result;
}

// ─── Dataset Save ────────────────────────────────────────────

/**
 * Save a single dataset, chunking if the array exceeds CHUNK_SIZE.
 */
export async function saveDataset(tenantId, name, items) {
  const metaRef = doc(db, "tenants", tenantId, "data", name);
  const isObject = !Array.isArray(items);

  // Object datasets (pipelineMeta, etc.) or small arrays: single document
  if (isObject || items.length <= CHUNK_SIZE) {
    await setDoc(metaRef, {
      ...(isObject ? items : { items }),
      chunked: false,
      updatedAt: serverTimestamp(),
    });
    // Clean up any leftover chunks from a previous chunked save
    await deleteOldChunks(tenantId, name, -1);
    return;
  }

  // Large arrays: chunked storage with version flag
  const metaSnap = await getDoc(metaRef);
  const prevVersion = metaSnap.exists() ? (metaSnap.data().version || 0) : 0;
  const newVersion = prevVersion + 1;

  // Write metadata first
  await setDoc(metaRef, {
    chunked: true,
    version: newVersion,
    count: items.length,
    chunkCount: Math.ceil(items.length / CHUNK_SIZE),
    updatedAt: serverTimestamp(),
  });

  // Write chunks in parallel
  const chunkPromises = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunkIdx = Math.floor(i / CHUNK_SIZE);
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const chunkRef = doc(db, "tenants", tenantId, "data", name, "rows", String(chunkIdx));
    chunkPromises.push(
      setDoc(chunkRef, {
        idx: chunkIdx,
        version: newVersion,
        items: chunk,
        updatedAt: serverTimestamp(),
      })
    );
  }
  await Promise.all(chunkPromises);

  // Delete old version chunks
  await deleteOldChunks(tenantId, name, newVersion);
}

/**
 * Delete chunk documents with version < currentVersion.
 * Silently fails — stale chunks are harmless (filtered on read by version).
 */
async function deleteOldChunks(tenantId, name, currentVersion) {
  try {
    const rowsRef = collection(db, "tenants", tenantId, "data", name, "rows");
    const rowsSnap = await getDocs(rowsRef);
    const deletePromises = [];
    for (const d of rowsSnap.docs) {
      const docVersion = d.data().version || 0;
      if (docVersion < currentVersion) {
        deletePromises.push(deleteDoc(d.ref));
      }
    }
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  } catch {
    // Stale chunks are filtered on read — cleanup failure is non-critical
  }
}

/**
 * Save multiple datasets at once (parallel).
 */
export async function saveAllDatasets(tenantId, datasets) {
  const promises = Object.entries(datasets).map(([name, items]) => {
    if (items !== undefined && DATASETS.includes(name)) {
      return saveDataset(tenantId, name, items);
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
}

// ─── Tenant Config ───────────────────────────────────────────

/**
 * Load tenant config from Firestore (merges config/main with tenant-level subscription).
 */
export async function loadTenantConfig(tenantId) {
  try {
    const [configSnap, tenantSnap] = await Promise.all([
      getDoc(doc(db, "tenants", tenantId, "config", "main")),
      getDoc(doc(db, "tenants", tenantId)),
    ]);
    const config = configSnap.exists() ? configSnap.data() : {};
    const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
    if (tenantData.subscription) {
      config.subscription = tenantData.subscription;
    }
    return Object.keys(config).length > 0 ? config : null;
  } catch {
    return null;
  }
}

/**
 * Save tenant config (merges with existing).
 */
export async function saveTenantConfig(tenantId, config) {
  await setDoc(doc(db, "tenants", tenantId, "config", "main"), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Upload Audit ────────────────────────────────────────────

/**
 * Log an upload event.
 */
export async function logUpload(tenantId, metadata) {
  await addDoc(collection(db, "tenants", tenantId, "uploads"), {
    ...metadata,
    createdAt: serverTimestamp(),
  });
}

// ─── Executive Summary ───────────────────────────────────────

export async function loadSummary(tenantId) {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "data", "_summary"));
    return snap.exists() ? snap.data().text : null;
  } catch {
    return null;
  }
}

export async function saveSummary(tenantId, text) {
  await setDoc(doc(db, "tenants", tenantId, "data", "_summary"), {
    text,
    updatedAt: serverTimestamp(),
  });
}

// ─── Sync History ────────────────────────────────────────────

export async function loadSyncHistory(tenantId, count = 10) {
  try {
    const q = query(
      collection(db, "tenants", tenantId, "syncHistory"),
      orderBy("startedAt", "desc"),
      fbLimit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        startedAt: data.startedAt?.toMillis?.() || null,
        completedAt: data.completedAt?.toMillis?.() || null,
      };
    });
  } catch {
    return [];
  }
}
