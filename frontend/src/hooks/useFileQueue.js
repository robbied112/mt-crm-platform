/**
 * useFileQueue — Multi-file upload queue manager.
 *
 * Owns queue state and processing orchestration. DataImport owns the
 * actual Firestore import logic and calls markImporting / markDone /
 * markError as each file progresses.
 *
 * Auto-confirm threshold: all mapped fields >= 0.8, at least 3 mapped,
 * and the file is not a PDF or product sheet.
 */

import { useState, useCallback, useRef } from "react";

// ─── Constants ──────────────────────────────────────────────────
const AUTO_CONFIRM_THRESHOLD = 0.8;
const MIN_MAPPED_FIELDS = 3;
const MAX_BATCH_SIZE = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ────────────────────────────────────────────────────

/** Build a smart sample of rows for comprehendReport. */
function smartSample(rows) {
  if (rows.length <= 50) return rows;
  const first20 = rows.slice(0, 20);
  const midStart = Math.floor(rows.length / 2) - 10;
  const mid20 = rows.slice(midStart, midStart + 20);
  const last10 = rows.slice(-10);
  return [...first20, ...mid20, ...last10];
}

/**
 * Determine whether a mapping qualifies for auto-confirm.
 * Returns true when every mapped field has confidence >= 0.8,
 * at least 3 non-internal fields are mapped, the detected type is
 * not "product_sheet", and the source file is not a PDF.
 *
 * @param {object} mapping — field → column mapping
 * @param {object} confidence — field → confidence score (0-1)
 * @param {object|null} typeObj — result of detectUploadType, e.g. {type: "quickbooks"}
 * @param {File} file — the File object (checked for .pdf extension)
 */
function canAutoConfirm(mapping, confidence, typeObj, file) {
  // PDFs (billback reports) always need manual review
  if (file && /\.pdf$/i.test(file.name)) return false;

  // Product sheets always need manual review
  if (typeObj?.type === "product_sheet") return false;

  // Count mapped, non-internal fields and check confidence floor
  const mappedKeys = Object.keys(mapping).filter(
    (k) => !k.startsWith("_") && mapping[k]
  );
  if (mappedKeys.length < MIN_MAPPED_FIELDS) return false;

  // Every mapped field must meet the threshold
  return mappedKeys.every(
    (k) => (confidence[k] ?? 0) >= AUTO_CONFIRM_THRESHOLD
  );
}

// ─── Hook ───────────────────────────────────────────────────────

export default function useFileQueue(config = {}) {
  const {
    parseFile,
    autoDetectMapping,
    aiAutoDetectMapping,
    detectUploadType,
    comprehendReport,
    loadRecentUploads,
    useAI = false,
    smartImportEnabled = false,
    userRole,
    tenantId,
  } = config;

  // Queue items: [{id, file, status, type, parsed, mapping, confidence, error, dupWarning, analysis}]
  const [queue, setQueue] = useState([]);

  // Simple incrementing id counter (survives re-renders via ref)
  const nextId = useRef(1);

  // ── Queue item updater (by id) ──────────────────────────────
  const updateItem = useCallback((id, patch) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  // ── addFiles ────────────────────────────────────────────────
  const addFiles = useCallback(
    async (fileList) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      // Load recent uploads for duplicate detection (best-effort)
      let recentNames = [];
      try {
        if (loadRecentUploads && tenantId) {
          const recent = await loadRecentUploads(tenantId);
          recentNames = recent.map((u) => u.fileName);
        }
      } catch {
        // Silently skip dup detection on failure
      }

      setQueue((prev) => {
        // How many slots remain?
        const slotsAvailable = MAX_BATCH_SIZE - prev.length;
        if (slotsAvailable <= 0) return prev;

        const existingNames = new Set(prev.map((q) => q.file.name));
        const addedNames = new Set();
        const newItems = [];

        for (const file of incoming) {
          if (newItems.length >= slotsAvailable) break;

          // Deduplicate within batch and against existing queue
          if (existingNames.has(file.name) || addedNames.has(file.name)) {
            continue;
          }
          addedNames.add(file.name);

          // Validate file size
          const id = nextId.current++;
          if (file.size === 0) {
            newItems.push({
              id,
              file,
              status: "error",
              type: null,
              parsed: null,
              mapping: null,
              confidence: null,
              error: "File is empty",
              dupWarning: false,
              analysis: null,
            });
            continue;
          }
          if (file.size > MAX_FILE_SIZE) {
            newItems.push({
              id,
              file,
              status: "error",
              type: null,
              parsed: null,
              mapping: null,
              confidence: null,
              error: `File exceeds 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
              dupWarning: false,
              analysis: null,
            });
            continue;
          }

          // Check for duplicate against recent uploads
          const dupWarning = recentNames.includes(file.name);

          newItems.push({
            id,
            file,
            status: "queued",
            type: null,
            parsed: null,
            mapping: null,
            confidence: null,
            error: null,
            dupWarning,
            analysis: null,
          });
        }

        return [...prev, ...newItems];
      });
    },
    [loadRecentUploads, tenantId]
  );

  // ── removeFile ──────────────────────────────────────────────
  const removeFile = useCallback((id) => {
    setQueue((prev) =>
      prev.filter((item) => !(item.id === id && item.status === "queued"))
    );
  }, []);

  // ── processNext ─────────────────────────────────────────────
  // Parses the next queued file, runs mapping, detects type, and
  // decides auto-confirm vs needs-review.
  const processNext = useCallback(async () => {
    // Find the first "queued" item
    let target = null;
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.status === "queued");
      if (idx === -1) return prev;
      target = prev[idx];
      // Mark as parsing immediately
      const next = [...prev];
      next[idx] = { ...next[idx], status: "parsing" };
      return next;
    });

    // If nothing was queued, bail
    if (!target) return null;
    const { id, file } = target;

    try {
      // 1. Parse the file
      const parsed = await parseFile(file);
      if (!parsed || !parsed.headers || !parsed.rows) {
        throw new Error("Could not parse file — no data found");
      }
      updateItem(id, { parsed });

      // 2. Smart import path: call comprehendReport if enabled
      let analysis = null;
      let smartMapping = null;
      let smartConfidence = null;

      if (smartImportEnabled && comprehendReport) {
        try {
          const sample = smartSample(parsed.rows);
          const { data } = await comprehendReport({
            tenantId,
            fileName: file.name,
            headers: parsed.headers,
            sampleRows: sample,
          });

          analysis = data;
          updateItem(id, { analysis });

          // If comprehendReport returned a usable mapping, prefer it
          if (data && !data.error && data.mapping) {
            smartMapping = data.mapping;
            // Build confidence from columnSemantics (matching DataImport pattern)
            smartConfidence = {};
            if (data.columnSemantics) {
              for (const [, semantic] of Object.entries(data.columnSemantics)) {
                if (semantic.field) smartConfidence[semantic.field] = semantic.confidence || 0;
              }
            }
          }
        } catch (err) {
          // Smart import failed — fall through to standard mapping
          console.warn("comprehendReport failed, falling back:", err);
        }
      }

      // 3. Determine mapping + confidence
      let mapping, confidence;

      if (smartMapping) {
        mapping = smartMapping;
        confidence = smartConfidence;
      } else if (useAI && aiAutoDetectMapping) {
        try {
          const aiResult = await aiAutoDetectMapping(parsed.headers, parsed.rows);
          mapping = aiResult.mapping || {};
          confidence = aiResult.confidence || {};
        } catch {
          // AI mapper failed — fall back to rule-based
          const rbResult = autoDetectMapping(parsed.headers, parsed.rows, userRole);
          mapping = rbResult.mapping || {};
          confidence = rbResult.confidence || {};
        }
      } else {
        const rbResult = autoDetectMapping(parsed.headers, parsed.rows, userRole);
        mapping = rbResult.mapping || {};
        confidence = rbResult.confidence || {};
      }

      // 4. Detect upload type (signature: headers, rows, mapping)
      const typeObj = detectUploadType
        ? detectUploadType(parsed.headers, parsed.rows, mapping)
        : null;

      // 5. Auto-confirm or needs-review
      const auto = canAutoConfirm(mapping, confidence, typeObj, file);
      const status = auto ? "auto-confirmed" : "needs-review";

      updateItem(id, { mapping, confidence, type: typeObj, status });
      return id;
    } catch (err) {
      updateItem(id, { status: "error", error: err.message || String(err) });
      return id;
    }
  }, [
    parseFile,
    autoDetectMapping,
    aiAutoDetectMapping,
    detectUploadType,
    comprehendReport,
    useAI,
    smartImportEnabled,
    userRole,
    tenantId,
    updateItem,
  ]);

  // ── confirmFile ─────────────────────────────────────────────
  // User manually confirms a needs-review file is ready for import.
  const confirmFile = useCallback(
    (id) => {
      updateItem(id, { status: "auto-confirmed" });
    },
    [updateItem]
  );

  // ── markImporting / markDone / markError ────────────────────
  // Called by DataImport as it runs the actual import pipeline.
  const markImporting = useCallback(
    (id) => updateItem(id, { status: "importing" }),
    [updateItem]
  );

  const markDone = useCallback(
    (id, result) => updateItem(id, { status: "done", result }),
    [updateItem]
  );

  const markError = useCallback(
    (id, error) =>
      updateItem(id, {
        status: "error",
        error: typeof error === "string" ? error : error?.message || String(error),
      }),
    [updateItem]
  );

  // ── Derived state ──────────────────────────────────────────

  // The currently active item: first that is not done/error.
  const activeItem =
    queue.find(
      (i) => i.status !== "done" && i.status !== "error"
    ) || null;

  // Progress counters
  const total = queue.length;
  const done = queue.filter((i) => i.status === "done").length;
  const failed = queue.filter((i) => i.status === "error").length;
  const current = done + failed + 1; // 1-indexed position
  const progress = {
    current: Math.min(current, total),
    total,
    done,
    failed,
  };

  // Batch is complete when every file has a terminal status
  const batchDone =
    total > 0 && queue.every((i) => i.status === "done" || i.status === "error");

  // Summary for the done screen
  const batchResults = queue
    .filter((i) => i.status === "done" || i.status === "error")
    .map((i) => ({
      fileName: i.file.name,
      type: i.type?.type || i.result?.type || null,
      rowCount: i.result?.rowCount ?? null,
      status: i.status,
      error: i.error || null,
    }));

  return {
    queue,
    addFiles,
    removeFile,
    processNext,
    confirmFile,
    markImporting,
    markDone,
    markError,
    activeItem,
    progress,
    batchDone,
    batchResults,
  };
}
