/**
 * UploadContext — Shared provider for file upload state.
 *
 * Wraps useFileQueue and adds:
 *   - Analysis timing (for SpeedBadge)
 *   - Structured error model
 *   - Shared state between upload homepage and Settings > Data Upload
 *
 * Follows the same provider pattern as DataContext and AuthContext:
 *   createContext(null) → useUpload() hook → UploadProvider component
 *
 * Does NOT own the import pipeline (DataContext.importDatasets handles that).
 * UploadContext owns: file queue, parsing, mapping, comprehension, timing.
 */

import { createContext, useContext, useCallback, useRef, useState, useEffect } from "react";
import { useData } from "./DataContext";
import { useAuth } from "./AuthContext";
import useFileQueue from "../hooks/useFileQueue";
import parseFile from "../utils/parseFile";
import { autoDetectMapping, detectUploadType } from "../utils/semanticMapper";
import { aiAutoDetectMapping } from "../utils/aiMapper";
import { loadRecentUploads } from "../services/firestoreService";
import { getFunctions, httpsCallable } from "firebase/functions";

const UploadContext = createContext(null);

export function useUpload() {
  return useContext(UploadContext);
}

export default function UploadProvider({ children }) {
  const { userRole, tenantId, tenantConfig } = useData();
  const { currentUser } = useAuth();

  const smartImportEnabled = !!tenantConfig?.features?.smartImport;

  // ── Analysis timing (for SpeedBadge) ──
  const [analysisTiming, setAnalysisTiming] = useState(null);
  const timingStart = useRef(null);

  const startTiming = useCallback(() => {
    timingStart.current = performance.now();
    setAnalysisTiming(null);
  }, []);

  const stopTiming = useCallback((rowCount) => {
    if (timingStart.current == null) return null;
    const elapsed = performance.now() - timingStart.current;
    const timing = {
      durationMs: Math.round(elapsed),
      durationSec: +(elapsed / 1000).toFixed(1),
      rowCount: rowCount || 0,
      timestamp: Date.now(),
    };
    setAnalysisTiming(timing);
    timingStart.current = null;
    return timing;
  }, []);

  // ── Comprehend callable ──
  const comprehendCallable = useCallback(async (args) => {
    const fns = getFunctions();
    const comprehendReport = httpsCallable(fns, "comprehendReport");
    return comprehendReport(args);
  }, []);

  // ── File queue ──
  const fq = useFileQueue({
    parseFile,
    autoDetectMapping,
    aiAutoDetectMapping,
    detectUploadType,
    comprehendReport: smartImportEnabled ? comprehendCallable : null,
    loadRecentUploads,
    useAI: true,
    smartImportEnabled,
    userRole,
    tenantId,
  });

  // ── Auto-process queue ──
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    const nextQueued = fq.queue.find((i) => i.status === "queued");
    if (!nextQueued) return;

    processingRef.current = true;
    startTiming();
    fq.processNext().then((id) => {
      if (id != null) {
        const item = fq.queue.find((i) => i.id === id);
        stopTiming(item?.parsed?.rows?.length || 0);
      }
    }).finally(() => {
      processingRef.current = false;
    });
  }, [fq.queue, fq.processNext, startTiming, stopTiming]);

  // ── Value ──
  const value = {
    // File queue (all useFileQueue state + actions)
    queue: fq.queue,
    addFiles: fq.addFiles,
    removeFile: fq.removeFile,
    processNext: fq.processNext,
    confirmFile: fq.confirmFile,
    markImporting: fq.markImporting,
    markDone: fq.markDone,
    markError: fq.markError,
    activeItem: fq.activeItem,
    progress: fq.progress,
    batchDone: fq.batchDone,
    batchResults: fq.batchResults,

    // Analysis timing
    analysisTiming,
    startTiming,
    stopTiming,

    // Config
    smartImportEnabled,
    comprehendCallable,
  };

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
