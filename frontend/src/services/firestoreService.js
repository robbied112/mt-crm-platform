/**
 * Firestore Service — CRUD operations for tenant data.
 *
 * ─── Storage Layout ──────────────────────────────────────────
 *
 *  tenants/{tenantId}/
 *  ├── data/{name}/rows/{chunk}     # Legacy pre-computed dashboards
 *  ├── imports/{importId}/          # Normalized model: source of truth
 *  │   └── rows/{chunk}            #   Raw normalized rows
 *  ├── views/{name}/rows/{chunk}   # Normalized model: pre-computed dashboards
 *  └── config/main                 # Tenant settings
 *
 *  Feature flag: tenantConfig.useNormalizedModel
 *    false → read/write to data/ (legacy)
 *    true  → write imports/ + views/, read from views/
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
  serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  DATASETS,
  OBJECT_DATASETS,
} from "../../../packages/pipeline/src/constants.js";
import {
  writeChunked,
  readChunked,
  createModularFirestoreAdapter,
} from "../../../packages/pipeline/src/firestore.js";

const firestoreAdapter = createModularFirestoreAdapter({
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
}, db);

function emptyForDataset(name) {
  return OBJECT_DATASETS.has(name) ? {} : [];
}

// ─── Internal Chunked Load/Save ─────────────────────────────
//
// Parameterized by collPath (e.g. "data", "views") so the same
// chunking logic serves both legacy and normalized model paths.

/**
 * Load a single dataset from tenants/{tenantId}/{collPath}/{name}.
 * Handles both chunked and non-chunked storage.
 */
async function _loadDataset(tenantId, collPath, name) {
  try {
    return await readChunked(db, ["tenants", tenantId, collPath, name], {
      adapter: firestoreAdapter,
      emptyValue: emptyForDataset(name),
    });
  } catch {
    return emptyForDataset(name);
  }
}

/**
 * Save a single dataset to tenants/{tenantId}/{collPath}/{name}.
 * Chunks if the array exceeds CHUNK_SIZE.
 */
async function _saveDataset(tenantId, collPath, name, items) {
  await writeChunked(db, ["tenants", tenantId, collPath, name], items, {
    adapter: firestoreAdapter,
  });
}

/**
 * Save/load multiple datasets at once (parallel).
 */
async function _saveAllDatasets(tenantId, collPath, datasets) {
  const promises = Object.entries(datasets).map(([name, items]) => {
    if (items !== undefined && DATASETS.includes(name)) {
      return _saveDataset(tenantId, collPath, name, items);
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
}

async function _loadAllDatasets(tenantId, collPath) {
  const result = {};
  const promises = DATASETS.map(async (name) => {
    result[name] = await _loadDataset(tenantId, collPath, name);
  });
  await Promise.all(promises);
  return result;
}

// ─── Legacy Data Path (data/) ───────────────────────────────

export async function loadAllData(tenantId) {
  return _loadAllDatasets(tenantId, "data");
}

export async function saveDataset(tenantId, name, items) {
  return _saveDataset(tenantId, "data", name, items);
}

export async function saveAllDatasets(tenantId, datasets) {
  return _saveAllDatasets(tenantId, "data", datasets);
}

// ─── Views Path (views/) — Normalized Model ─────────────────

export async function loadAllViews(tenantId) {
  return _loadAllDatasets(tenantId, "views");
}

export async function saveAllViews(tenantId, datasets) {
  return _saveAllDatasets(tenantId, "views", datasets);
}

// ─── Imports (imports/) — Normalized Model ──────────────────
//
//  tenants/{tenantId}/imports/{importId}       ← meta doc
//  tenants/{tenantId}/imports/{importId}/rows/  ← chunked normalized rows

/**
 * Save a new import: metadata + chunked normalized rows.
 * @returns {string} The generated import ID.
 */
export async function saveImport(tenantId, meta, normalizedRows) {
  const importsRef = collection(db, "tenants", tenantId, "imports");
  const importRef = doc(importsRef);
  const importId = importRef.id;
  await writeChunked(db, ["tenants", tenantId, "imports", importId], normalizedRows, {
    adapter: firestoreAdapter,
    forceChunked: true,
    version: 1,
    cleanupStaleChunks: false,
    updatedAtField: null,
    meta: {
      ...meta,
      rowCount: normalizedRows.length,
      createdAt: serverTimestamp(),
    },
  });

  return importId;
}

/**
 * Load all import metadata for a tenant (most recent first).
 */
export async function loadImports(tenantId) {
  try {
    const q = query(
      collection(db, "tenants", tenantId, "imports"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Load all normalized rows for a specific import.
 */
export async function loadImportRows(tenantId, importId) {
  return readChunked(db, ["tenants", tenantId, "imports", importId], {
    adapter: firestoreAdapter,
    emptyValue: [],
    preferRows: true,
  });
}

/**
 * Delete an import and all its row chunks.
 */
export async function deleteImport(tenantId, importId) {
  const rowsRef = collection(db, "tenants", tenantId, "imports", importId, "rows");
  const rowsSnap = await getDocs(rowsRef);
  await Promise.all(rowsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "tenants", tenantId, "imports", importId));
}

/**
 * Delete an upload log entry.
 */
export async function deleteUploadLog(tenantId, uploadId) {
  await deleteDoc(doc(db, "tenants", tenantId, "uploads", uploadId));
}

// ─── Delete All Data ─────────────────────────────────────────

/**
 * Delete all tenant data: datasets (data/ + views/), imports, uploads, blueprints,
 * digests, learned mappings, import configs, sync/rebuild history, and summary.
 * Does NOT delete config, accounts, contacts, tasks, activities, opportunities, or products
 * — those are handled by the caller via CrmContext.
 */
export async function deleteAllData(tenantId) {
  // Delete all docs and their row subcollections in a chunked collection
  async function deleteChunkedCollection(collPath) {
    const colRef = collection(db, "tenants", tenantId, collPath);
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map(async (d) => {
      const rowsRef = collection(db, "tenants", tenantId, collPath, d.id, "rows");
      const rowsSnap = await getDocs(rowsRef);
      await Promise.all(rowsSnap.docs.map((r) => deleteDoc(r.ref)));
      await deleteDoc(d.ref);
    }));
  }

  // Delete all docs in a flat collection (no subcollections)
  async function deleteFlatCollection(collPath) {
    const colRef = collection(db, "tenants", tenantId, collPath);
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // Delete reportBlueprints with nested computedData/{tab}/rows/{chunk} subcollections
  async function deleteBlueprints() {
    const bpColRef = collection(db, "tenants", tenantId, "reportBlueprints");
    const bpSnap = await getDocs(bpColRef);
    await Promise.all(bpSnap.docs.map(async (bpDoc) => {
      const cdRef = collection(db, "tenants", tenantId, "reportBlueprints", bpDoc.id, "computedData");
      const cdSnap = await getDocs(cdRef);
      await Promise.all(cdSnap.docs.map(async (cdDoc) => {
        const rowsRef = collection(db, "tenants", tenantId, "reportBlueprints", bpDoc.id, "computedData", cdDoc.id, "rows");
        const rowsSnap = await getDocs(rowsRef);
        await Promise.all(rowsSnap.docs.map((r) => deleteDoc(r.ref)));
        await deleteDoc(cdDoc.ref);
      }));
      await deleteDoc(bpDoc.ref);
    }));
  }

  await Promise.all([
    deleteChunkedCollection("data"),
    deleteChunkedCollection("views"),
    deleteChunkedCollection("imports"),
    deleteFlatCollection("uploads"),
    deleteFlatCollection("uploadAudit"),
    deleteFlatCollection("pendingMatches"),
    deleteFlatCollection("pendingWineMatches"),
    deleteFlatCollection("briefings"),
    deleteFlatCollection("digests"),
    deleteFlatCollection("learnedMappings"),
    deleteFlatCollection("importConfigs"),
    deleteFlatCollection("syncState"),
    deleteFlatCollection("syncHistory"),
    deleteFlatCollection("rebuildHistory"),
    deleteBlueprints(),
  ]);
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
    if (!config.userRole && tenantData.userRole) {
      config.userRole = tenantData.userRole;
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

// ─── Budget Config ───────────────────────────────────────────

/**
 * Load budget config from tenants/{tenantId}/config/budget.
 */
export async function loadBudget(tenantId) {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "config", "budget"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Save budget config (merges with existing).
 */
export async function saveBudget(tenantId, budget) {
  await setDoc(doc(db, "tenants", tenantId, "config", "budget"), {
    ...budget,
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

/**
 * Load recent upload records for a tenant.
 * @param {string} tenantId
 * @param {number} count - max records to return (default 100)
 * @returns {Promise<Array<{fileName: string, type: string, createdAt: any}>>}
 */
export async function loadRecentUploads(tenantId, count = 100) {
  try {
    const q = query(
      collection(db, "tenants", tenantId, "uploads"),
      orderBy("createdAt", "desc"),
      fbLimit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { fileName: data.fileName, type: data.type, createdAt: data.createdAt };
    });
  } catch (err) {
    console.error("loadRecentUploads failed:", err);
    return [];
  }
}

/**
 * Get the most recent import of a given type for comparison.
 * Returns the import metadata and row count, or null if no prior import.
 */
export async function getPreviousImport(tenantId, uploadType) {
  if (!tenantId || !uploadType) return null;
  const q = query(
    collection(db, `tenants/${tenantId}/uploads`),
    where("type", "==", uploadType),
    orderBy("createdAt", "desc"),
    fbLimit(2) // Get 2 — the current one being saved + the previous
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Return the second one (the previous import, not the one just created)
  return docs.length >= 2 ? docs[1] : null;
}

export async function loadWines(tenantId) {
  const snap = await getDocs(collection(db, "tenants", tenantId, "wines"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aName = a.displayName || a.name || "";
      const bName = b.displayName || b.name || "";
      return aName.localeCompare(bName);
    });
}

// ─── Executive Summary ───────────────────────────────────────

/**
 * Load/save executive summary.
 * @param {string} collPath - "data" (legacy) or "views" (normalized)
 */
export async function loadSummary(tenantId, collPath = "data") {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, collPath, "_summary"));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { text: data.text || null, monthAxis: data.monthAxis || null };
  } catch {
    return null;
  }
}

export async function saveSummary(tenantId, text, collPath = "data") {
  await setDoc(doc(db, "tenants", tenantId, collPath, "_summary"), {
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

// ─── Learned Column Mappings ──────────────────────────────────

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'lm_' + Math.abs(hash).toString(36);
}

/**
 * Save a learned column mapping for a tenant.
 * Key: hash of sorted header names → mapping object.
 */
export async function saveLearnedMapping(tenantId, headers, mapping, uploadType) {
  if (!tenantId || !headers?.length) return;
  const key = headers.slice().sort().join("|").toLowerCase();
  const docRef = doc(db, `tenants/${tenantId}/learnedMappings`, hashCode(key));
  await setDoc(docRef, {
    headerSignature: key,
    headers: headers.slice(0, 100),
    mapping,
    uploadType: uploadType?.type || uploadType || null,
    updatedAt: serverTimestamp(),
    useCount: increment(1),
  }, { merge: true });

  // LRU eviction (fire-and-forget)
  evictLearnedMappings(tenantId).catch(() => {});
}

/**
 * Look up a learned mapping by header signature.
 * Returns { mapping, uploadType } or null if no match.
 */
export async function getLearnedMapping(tenantId, headers) {
  if (!tenantId || !headers?.length) return null;
  const key = headers.slice().sort().join("|").toLowerCase();
  const docRef = doc(db, `tenants/${tenantId}/learnedMappings`, hashCode(key));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();

  // Touch updatedAt for LRU (fire-and-forget)
  setDoc(docRef, { updatedAt: serverTimestamp(), useCount: increment(1) }, { merge: true })
    .catch(() => {});

  return { mapping: data.mapping, uploadType: data.uploadType };
}

// ─── Learned Mappings LRU Eviction ──────────────────────────────

export const MAX_LEARNED_MAPPINGS = 200;

/**
 * Evict least-recently-used learned mappings if count exceeds MAX_LEARNED_MAPPINGS.
 */
export async function evictLearnedMappings(tenantId) {
  const colRef = collection(db, `tenants/${tenantId}/learnedMappings`);
  const snap = await getDocs(colRef);
  if (snap.size <= MAX_LEARNED_MAPPINGS) return 0;

  const sorted = snap.docs
    .map(d => ({
      id: d.id,
      ref: d.ref,
      updatedAt: d.data().updatedAt?.toMillis?.() || d.data().updatedAt || 0,
    }))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  const toDelete = sorted.slice(0, sorted.length - MAX_LEARNED_MAPPINGS);
  await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
  return toDelete.length;
}

// ─── Import Configuration Memory ────────────────────────────────

/**
 * Generate a hash key for import config cache.
 * Based on sorted column headers + first 3 data rows structure.
 */
function importConfigHash(headers, sampleRows) {
  const headerKey = headers.slice().sort().join("|").toLowerCase();
  const structureKey = (sampleRows || []).slice(0, 3).map(row => {
    return headers.map(h => {
      const v = row[h];
      if (v == null || v === "") return "e";
      if (typeof v === "number" || /^-?\d+\.?\d*$/.test(String(v).trim())) return "n";
      return "s";
    }).join("");
  }).join("|");
  return hashCode(headerKey + ":" + structureKey);
}

/**
 * Save a cached import configuration (AI analysis result).
 * Path: tenants/{tenantId}/importConfigs/{hash}
 */
export async function saveImportConfig(tenantId, headers, sampleRows, config) {
  if (!tenantId || !headers?.length || !config) return;
  const key = importConfigHash(headers, sampleRows);
  const docRef = doc(db, `tenants/${tenantId}/importConfigs`, key);
  await setDoc(docRef, {
    analysis: config.analysis || null,
    mapping: config.mapping || null,
    uploadType: config.uploadType || null,
    reportType: config.analysis?.reportType || null,
    humanSummary: config.analysis?.humanSummary || null,
    headerCount: headers.length,
    savedAt: serverTimestamp(),
    useCount: increment(1),
  }, { merge: true });
}

/**
 * Look up a cached import configuration by file structure.
 * Returns { analysis, mapping, uploadType } or null if no cache hit.
 */
export async function getImportConfig(tenantId, headers, sampleRows) {
  if (!tenantId || !headers?.length) return null;
  const key = importConfigHash(headers, sampleRows);
  const docRef = doc(db, `tenants/${tenantId}/importConfigs`, key);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    analysis: data.analysis || null,
    mapping: data.mapping || null,
    uploadType: data.uploadType || null,
    reportType: data.reportType || null,
    humanSummary: data.humanSummary || null,
  };
}
