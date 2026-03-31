/**
 * Product Service — CRUD for the product hierarchy.
 *
 * Canonical spine: producers/ → masterProducts/ → skus/
 * Portfolio overlay: portfolios/ with producerIds[]
 *
 * Shared helpers handle repetitive patterns (normalization, subscriptions,
 * cascade deletes). Entity-specific CRUD is explicit per collection to
 * keep divergent write logic clear.
 *
 * Storage: tenants/{tenantId}/{collection}/{docId}
 */
import {
  doc, getDoc, updateDoc, deleteDoc, addDoc, getDocs, writeBatch,
  collection, query, orderBy, where, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { buildNormalizedName } from "../utils/productNormalize";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function tenantCol(tenantId, col) {
  return collection(db, "tenants", tenantId, col);
}

function tenantDoc(tenantId, col, docId) {
  return doc(db, "tenants", tenantId, col, docId);
}

function stripUndefined(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

/**
 * Auto-compute normalizedName from a name field.
 */
function withNormalization(data) {
  if (!data.name) return data;
  return { ...data, normalizedName: buildNormalizedName(data.name) };
}

/**
 * Manage sourceNames array: dedupe, cap at 50.
 * On create, initializes with [data.name].
 * On update with new sourceNames, caps at 50.
 */
function withSourceNames(data, isCreate = false) {
  if (isCreate && data.name && !data.sourceNames) {
    return { ...data, sourceNames: [data.name] };
  }
  if (Array.isArray(data.sourceNames) && data.sourceNames.length > 50) {
    return { ...data, sourceNames: data.sourceNames.slice(0, 50) };
  }
  return data;
}

/**
 * Create a real-time Firestore subscription.
 */
function createSubscription(tenantId, collectionName, orderField, callback, onError) {
  const q = query(tenantCol(tenantId, collectionName), orderBy(orderField));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error(`subscribe${collectionName} error:`, err);
    if (onError) onError(err);
  });
}

/**
 * Cascade-delete all docs in a collection matching a parent field.
 * Uses writeBatch in groups of 500.
 */
async function batchCascadeDelete(tenantId, collectionName, field, parentId) {
  const q = query(tenantCol(tenantId, collectionName), where(field, "==", parentId));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Batch-update a denormalized field on all child docs matching a parent field.
 * Used for name propagation on rename.
 */
async function batchUpdateField(tenantId, collectionName, parentField, parentId, patch) {
  const q = query(tenantCol(tenantId, collectionName), where(parentField, "==", parentId));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    docs.slice(i, i + 500).forEach((d) => batch.update(d.ref, patch));
    await batch.commit();
  }
}

/**
 * Batched `in` query for Firestore's 30-element limit.
 * Returns all matching docs across batches.
 */
async function batchedInQuery(tenantId, collectionName, field, ids) {
  if (!ids?.length) return [];
  const results = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const q = query(tenantCol(tenantId, collectionName), where(field, "in", chunk));
    const snap = await getDocs(q);
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Producers
// ---------------------------------------------------------------------------

export function subscribeProducers(tenantId, callback, onError) {
  return createSubscription(tenantId, "producers", "name", callback, onError);
}

export async function loadProducers(tenantId) {
  const q = query(tenantCol(tenantId, "producers"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createProducer(tenantId, data) {
  const clean = withSourceNames(withNormalization(stripUndefined(data)), true);
  const ref = await addDoc(tenantCol(tenantId, "producers"), {
    ...clean,
    skuCount: 0,
    masterProductCount: 0,
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProducer(tenantId, id, patch) {
  const clean = stripUndefined(patch);
  if (patch.name) {
    clean.normalizedName = buildNormalizedName(patch.name);
    // Propagate name change to all children
    await Promise.all([
      batchUpdateField(tenantId, "masterProducts", "producerId", id, {
        producerName: patch.name,
        updatedAt: serverTimestamp(),
      }),
      batchUpdateField(tenantId, "skus", "producerId", id, {
        producerName: patch.name,
        updatedAt: serverTimestamp(),
      }),
    ]);
  }
  await updateDoc(tenantDoc(tenantId, "producers", id), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProducer(tenantId, id) {
  // Cascade delete children
  await Promise.all([
    batchCascadeDelete(tenantId, "masterProducts", "producerId", id),
    batchCascadeDelete(tenantId, "skus", "producerId", id),
  ]);
  await deleteDoc(tenantDoc(tenantId, "producers", id));
}

// ---------------------------------------------------------------------------
// Master Products
// ---------------------------------------------------------------------------

export function subscribeMasterProducts(tenantId, callback, onError) {
  return createSubscription(tenantId, "masterProducts", "name", callback, onError);
}

export async function loadMasterProducts(tenantId) {
  const q = query(tenantCol(tenantId, "masterProducts"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMasterProduct(tenantId, data) {
  const clean = withSourceNames(withNormalization(stripUndefined(data)), true);

  // Denormalize producer name
  if (data.producerId && !data.producerName) {
    const producerSnap = await getDoc(tenantDoc(tenantId, "producers", data.producerId));
    if (producerSnap.exists()) {
      clean.producerName = producerSnap.data().name;
    }
  }

  const ref = await addDoc(tenantCol(tenantId, "masterProducts"), {
    ...clean,
    skuCount: 0,
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMasterProduct(tenantId, id, patch) {
  const clean = stripUndefined(patch);
  if (patch.name) {
    clean.normalizedName = buildNormalizedName(patch.name);
    // Propagate name change to SKUs
    await batchUpdateField(tenantId, "skus", "masterProductId", id, {
      masterProductName: patch.name,
      updatedAt: serverTimestamp(),
    });
  }
  await updateDoc(tenantDoc(tenantId, "masterProducts", id), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMasterProduct(tenantId, id) {
  await batchCascadeDelete(tenantId, "skus", "masterProductId", id);
  await deleteDoc(tenantDoc(tenantId, "masterProducts", id));
}

// ---------------------------------------------------------------------------
// SKUs
// ---------------------------------------------------------------------------

export function subscribeSkus(tenantId, callback, onError) {
  return createSubscription(tenantId, "skus", "name", callback, onError);
}

export async function loadSkus(tenantId) {
  const q = query(tenantCol(tenantId, "skus"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSku(tenantId, data) {
  const clean = withSourceNames(withNormalization(stripUndefined(data)), true);

  // Denormalize parent names
  if (data.producerId && !data.producerName) {
    const producerSnap = await getDoc(tenantDoc(tenantId, "producers", data.producerId));
    if (producerSnap.exists()) {
      clean.producerName = producerSnap.data().name;
    }
  }
  if (data.masterProductId && !data.masterProductName) {
    const mpSnap = await getDoc(tenantDoc(tenantId, "masterProducts", data.masterProductId));
    if (mpSnap.exists()) {
      clean.masterProductName = mpSnap.data().name;
    }
  }

  // Auto-generate display name if not provided
  if (!clean.displayName) {
    const parts = [clean.producerName, clean.masterProductName, clean.vintage, clean.bottleSize].filter(Boolean);
    clean.displayName = parts.join(" ") || clean.name;
  }

  const ref = await addDoc(tenantCol(tenantId, "skus"), {
    ...clean,
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // NOTE: skuCount on parent docs is maintained by Cloud Function trigger (productTriggers.js)
  return ref.id;
}

export async function updateSku(tenantId, id, patch) {
  const clean = stripUndefined(patch);
  if (patch.name) {
    clean.normalizedName = buildNormalizedName(patch.name);
  }
  await updateDoc(tenantDoc(tenantId, "skus", id), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSku(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "skus", id));
  // NOTE: skuCount on parent docs is decremented by Cloud Function trigger (productTriggers.js)
}

// ---------------------------------------------------------------------------
// Portfolios
// ---------------------------------------------------------------------------

export function subscribePortfolios(tenantId, callback, onError) {
  return createSubscription(tenantId, "portfolios", "name", callback, onError);
}

export async function loadPortfolios(tenantId) {
  const q = query(tenantCol(tenantId, "portfolios"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPortfolio(tenantId, data) {
  const clean = stripUndefined(data);
  const ref = await addDoc(tenantCol(tenantId, "portfolios"), {
    ...clean,
    producerIds: data.producerIds || [],
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePortfolio(tenantId, id, patch) {
  await updateDoc(tenantDoc(tenantId, "portfolios", id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePortfolio(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "portfolios", id));
}

export async function addProducerToPortfolio(tenantId, portfolioId, producerId) {
  await updateDoc(tenantDoc(tenantId, "portfolios", portfolioId), {
    producerIds: arrayUnion(producerId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeProducerFromPortfolio(tenantId, portfolioId, producerId) {
  await updateDoc(tenantDoc(tenantId, "portfolios", portfolioId), {
    producerIds: arrayRemove(producerId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all producers in a portfolio, handling Firestore's 30-element `in` limit.
 */
export async function getPortfolioProducers(tenantId, portfolioId) {
  const portfolioSnap = await getDoc(tenantDoc(tenantId, "portfolios", portfolioId));
  if (!portfolioSnap.exists()) return [];
  const { producerIds } = portfolioSnap.data();
  if (!producerIds?.length) return [];
  return batchedInQuery(tenantId, "producers", "__name__", producerIds);
}

/**
 * Get all SKUs belonging to producers in a portfolio.
 */
export async function getPortfolioSkus(tenantId, portfolioId) {
  const portfolioSnap = await getDoc(tenantDoc(tenantId, "portfolios", portfolioId));
  if (!portfolioSnap.exists()) return [];
  const { producerIds } = portfolioSnap.data();
  if (!producerIds?.length) return [];
  return batchedInQuery(tenantId, "skus", "producerId", producerIds);
}
