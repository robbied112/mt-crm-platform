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
import { runComprehend } from "../utils/runComprehend";
import { clearWorkbookCache } from "../utils/parseFile";

// ─── Constants ──────────────────────────────────────────────────
const AUTO_CONFIRM_THRESHOLD = 0.8;
const MIN_MAPPED_FIELDS = 3;
const MAX_BATCH_SIZE = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const COMPREHEND_TIMEOUT_MS = 45_000; // 45s safety timeout per file

/**
 * Critical fields that MUST be mapped for auto-confirm, per upload type.
 * If any are missing, the file goes to needs-review so the user can fix it.
 */
const TYPE_REQUIRED_FIELDS = {
  depletion: ["qty"],
  sales: ["qty"],
  purchases: ["acct", "qty"],
  inventory: ["oh"],
};

function canAutoConfirm(mapping, confidence, typeObj, file) {
  // PDFs (billback reports) always need manual review
  if (file && /\.pdf$/i.test(file.name)) return false;

  // Product sheets always need manual review
  if (typeObj?.type === "product_sheet") return false;

  // Unknown type always needs review
  if (typeObj?.type === "unknown") return false;

  // Count mapped, non-internal fields and check confidence floor
  const mappedKeys = Object.keys(mapping).filter(
    (k) => !k.startsWith("_") && mapping[k]
  );
  if (mappedKeys.length < MIN_MAPPED_FIELDS) return false;

  // Every mapped field must meet the threshold
  const allHighConfidence = mappedKeys.every(
    (k) => (confidence[k] ?? 0) >= AUTO_CONFIRM_THRESHOLD
  );
  if (!allHighConfidence) return false;

  // Type-specific required fields must be mapped
  const required = TYPE_REQUIRED_FIELDS[typeObj?.type] || [];
  if (required.some((f) => !mapping[f])) return false;

  return true;
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
      // 1. Parse the file (with smart sheet selection for multi-sheet Excel)
      let parsed = await parseFile(file);
      if (!parsed || !parsed.headers || !parsed.rows) {
        throw new Error("Could not parse file — no data found");
      }
      updateItem(id, { parsed, sheetInfo: parsed.sheetInfo || null });

      // 2. Smart import path: call comprehendReport via shared helper
      let analysis = null;
      let smartMapping = null;
      let smartConfidence = null;

      if (smartImportEnabled && comprehendReport) {
        try {
          const comprehendOut = await Promise.race([
            runComprehend({
              file,
              parsed,
              comprehendCallable: comprehendReport,
              tenantId,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Comprehend timed out")), COMPREHEND_TIMEOUT_MS)
            ),
          ]);

          analysis = comprehendOut.analysis;
          updateItem(id, { analysis });

          // Use re-parsed or merged data if available
          if (comprehendOut.parsed !== parsed) {
            parsed = comprehendOut.parsed;
            updateItem(id, { parsed });
          }
          if (comprehendOut.sheetInfo) {
            updateItem(id, { sheetInfo: comprehendOut.sheetInfo });
          }

          if (comprehendOut.mapping) {
            smartMapping = comprehendOut.mapping;
            smartConfidence = comprehendOut.confidence || {};
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

      // Release cached XLSX workbook — the file is fully processed and the
      // heavy workbook object is no longer needed.  Prevents accumulating
      // 6+ workbooks in memory when processing a large batch.
      clearWorkbookCache();

      return id;
    } catch (err) {
      clearWorkbookCache();
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

  // ── claimNextImport ─────────────────────────────────────────
  // Atomically find the first auto-confirmed item and mark it as
  // "importing" inside a single setQueue updater.  This avoids the
  // ref-timing race that caused the queue to stall: the status
  // change is visible to every subsequent effect run, unlike a ref
  // which can clear without triggering a re-render.
  const claimNextImport = useCallback(() => {
    let target = null;
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.status === "auto-confirmed");
      if (idx === -1) return prev;
      target = prev[idx];
      const next = [...prev];
      next[idx] = { ...next[idx], status: "importing" };
      return next;
    });
    return target;
  }, []);

  // ── markImporting / markDone / markError ────────────────────
  // Called by DataImport as it runs the actual import pipeline.
  const markImporting = useCallback(
    (id) => updateItem(id, { status: "importing" }),
    [updateItem]
  );

  const markDone = useCallback(
    (id, result) =>
      // Clear heavy payload (parsed rows, analysis) to free memory once
      // the file is done — only the lightweight result summary is kept.
      updateItem(id, { status: "done", result, parsed: null, analysis: null }),
    [updateItem]
  );

  const markError = useCallback(
    (id, error) =>
      updateItem(id, {
        status: "error",
        error: typeof error === "string" ? error : error?.message || String(error),
        // Free memory on error too
        parsed: null,
        analysis: null,
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
    claimNextImport,
    markImporting,
    markDone,
    markError,
    activeItem,
    progress,
    batchDone,
    batchResults,
  };
}
