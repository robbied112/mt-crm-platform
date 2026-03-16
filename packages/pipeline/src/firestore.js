const { CHUNK_SIZE } = require("./constants");

function toPathSegments(path) {
  if (Array.isArray(path)) return path.filter(Boolean);
  return String(path)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getAdapter(opts) {
  if (!opts.adapter) {
    throw new Error("Firestore adapter required");
  }
  return opts.adapter;
}

function resolveVersion(prevMeta, opts) {
  if (opts.version !== undefined) {
    return opts.version;
  }

  if (typeof opts.versionStrategy === "function") {
    return opts.versionStrategy(prevMeta);
  }

  if (opts.versionStrategy === "timestamp") {
    return Date.now();
  }

  const prevVersion = Number(prevMeta?.version);
  return Number.isFinite(prevVersion) ? prevVersion + 1 : 1;
}

async function deleteStaleChunks(adapter, rowsPath, currentVersion, deleteAll = false) {
  const rowDocs = await adapter.getDocs(rowsPath);
  const staleDocs = rowDocs.filter((rowDoc) => {
    if (deleteAll) return true;
    return rowDoc.data()?.version !== currentVersion;
  });

  await Promise.all(
    staleDocs.map((rowDoc) => adapter.deleteDoc([...rowsPath, rowDoc.id]))
  );
}

async function writeChunked(db, path, items, opts = {}) {
  void db;
  const adapter = getAdapter(opts);
  const docPath = toPathSegments(path);
  const rowsPath = [...docPath, "rows"];
  const chunkSize = opts.chunkSize || CHUNK_SIZE;
  const extraMeta = opts.meta || {};
  const updatedAtField = opts.updatedAtField === undefined ? "updatedAt" : opts.updatedAtField;
  const timestampValue = updatedAtField && adapter.serverTimestamp
    ? { [updatedAtField]: adapter.serverTimestamp() }
    : {};
  const isObject = !Array.isArray(items);
  const forceChunked = opts.forceChunked === true;

  if (isObject || (!forceChunked && items.length <= chunkSize)) {
    await adapter.setDoc(
      docPath,
      {
        ...(isObject ? items : { items }),
        ...extraMeta,
        chunked: false,
        ...timestampValue,
      },
      opts.writeOptions
    );

    if (opts.cleanupStaleChunks !== false) {
      await deleteStaleChunks(adapter, rowsPath, undefined, true);
    }

    return { chunked: false, count: isObject ? 0 : items.length };
  }

  const prevMetaSnap = await adapter.getDoc(docPath);
  const prevMeta = prevMetaSnap.exists() ? prevMetaSnap.data() : null;
  const version = resolveVersion(prevMeta, opts);
  const chunkCount = Math.ceil(items.length / chunkSize);

  await adapter.setDoc(
    docPath,
    {
      ...extraMeta,
      chunked: true,
      version,
      count: items.length,
      chunkCount,
      ...timestampValue,
    },
    opts.writeOptions
  );

  const writePromises = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunkIdx = Math.floor(i / chunkSize);
    const chunk = items.slice(i, i + chunkSize);
    writePromises.push(
      adapter.setDoc(
        [...rowsPath, String(chunkIdx)],
        {
          idx: chunkIdx,
          version,
          items: chunk,
          ...timestampValue,
        }
      )
    );
  }

  await Promise.all(writePromises);

  if (opts.cleanupStaleChunks !== false) {
    await deleteStaleChunks(adapter, rowsPath, version);
  }

  return { chunked: true, version, count: items.length, chunkCount };
}

async function readChunked(db, path, opts = {}) {
  void db;
  const adapter = getAdapter(opts);
  const docPath = toPathSegments(path);
  const metaSnap = await adapter.getDoc(docPath);

  if (!metaSnap.exists()) {
    if (opts.preferRows === true) {
      const rowDocs = await adapter.getDocs([...docPath, "rows"]);
      if (rowDocs.length > 0) {
        return rowDocs
          .map((rowDoc) => ({ idx: rowDoc.data()?.idx || 0, items: rowDoc.data()?.items || [] }))
          .sort((a, b) => a.idx - b.idx)
          .flatMap((chunk) => chunk.items);
      }
    }
    return opts.emptyValue ?? [];
  }

  const meta = metaSnap.data() || {};
  const shouldReadRows = meta.chunked === true || opts.preferRows === true;

  if (!shouldReadRows) {
    return meta.items ?? meta;
  }

  const queryOptions = meta.version === undefined
    ? undefined
    : { where: { field: "version", op: "==", value: meta.version } };
  const rowDocs = await adapter.getDocs([...docPath, "rows"], queryOptions);

  if (rowDocs.length === 0) {
    return opts.emptyValue ?? [];
  }

  return rowDocs
    .map((rowDoc) => ({ idx: rowDoc.data()?.idx || 0, items: rowDoc.data()?.items || [] }))
    .sort((a, b) => a.idx - b.idx)
    .flatMap((chunk) => chunk.items);
}

function createModularFirestoreAdapter(api, db) {
  return {
    serverTimestamp: () => api.serverTimestamp(),
    getDoc: (path) => api.getDoc(api.doc(db, ...path)),
    setDoc: (path, data, options) => api.setDoc(api.doc(db, ...path), data, options),
    deleteDoc: (path) => api.deleteDoc(api.doc(db, ...path)),
    async getDocs(path, options) {
      const collRef = api.collection(db, ...path);
      const queryRef = options?.where
        ? api.query(collRef, api.where(options.where.field, options.where.op, options.where.value))
        : collRef;
      const snap = await api.getDocs(queryRef);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        data: () => docSnap.data(),
      }));
    },
  };
}

function createAdminFirestoreAdapter({ admin, db }) {
  return {
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    getDoc: (path) => db.doc(path.join("/")).get(),
    setDoc: (path, data, options) => db.doc(path.join("/")).set(data, options),
    deleteDoc: (path) => db.doc(path.join("/")).delete(),
    async getDocs(path, options) {
      let collRef = db.collection(path.join("/"));
      if (options?.where) {
        collRef = collRef.where(options.where.field, options.where.op, options.where.value);
      }
      const snap = await collRef.get();
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        data: () => docSnap.data(),
      }));
    },
  };
}

module.exports = {
  writeChunked,
  readChunked,
  createModularFirestoreAdapter,
  createAdminFirestoreAdapter,
};
