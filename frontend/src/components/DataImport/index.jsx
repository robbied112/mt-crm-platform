/**
 * DataImport — full import flow with drag-drop, semantic mapping,
 * format detection, preview, and Firestore persistence.
 *
 * Supports multi-file upload: drop N files, the queue processes them
 * sequentially. High-confidence mappings auto-confirm; low-confidence
 * files pause for manual review. PDFs and product sheets always pause.
 */
import { useReducer, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useCrm } from "../../context/CrmContext";
import parseFile from "../../utils/parseFile";
import { autoDetectMapping, detectUploadType } from "../../utils/semanticMapper";
import { t } from "../../utils/terminology";
import { aiAutoDetectMapping } from "../../utils/aiMapper";
import { transformAll, generateSummary } from "../../utils/transformData";
import { transformBillback } from "../../utils/transformBillback";
import { normalizeRows } from "../../utils/normalize.js";
import { clientExactMatch } from "../../utils/productNormalize";
import { logUpload, loadRecentUploads } from "../../services/firestoreService";
import { useAuth } from "../../context/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import ProductSheetReviewStep from "../ProductSheetReviewStep";
import MappingStep from "./MappingStep";
import PreviewStep from "./PreviewStep";
import BillbackReviewStep from "./BillbackReviewStep";
import ReportAnalysisCard from "./ReportAnalysisCard";
import useFileQueue from "../../hooks/useFileQueue";
import s from "./styles";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Reducer ────────────────────────────────────────────────────

const initialState = {
  step: "upload",
  file: null,
  parsed: null,
  mapping: {},
  confidence: {},
  uploadType: null,
  preview: null,
  summary: "",
  error: "",
  saving: false,
  dragOver: false,
  useAI: true,
  aiLoading: false,
  billbackItems: null,
  billbackMeta: null,
  unmatchedProducts: [],
  // Smart import state
  analyses: new Map(),
  analysis: null,
  integrationPlan: null,
  smartImportEnabled: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "SET_FILE":
      return { ...state, file: action.payload };
    case "SET_PARSED":
      return { ...state, parsed: action.payload };
    case "SET_MAPPING":
      return { ...state, mapping: action.payload };
    case "SET_CONFIDENCE":
      return { ...state, confidence: action.payload };
    case "SET_UPLOAD_TYPE":
      return { ...state, uploadType: action.payload };
    case "SET_PREVIEW":
      return { ...state, preview: action.payload };
    case "SET_SUMMARY":
      return { ...state, summary: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "SET_DRAG_OVER":
      return { ...state, dragOver: action.payload };
    case "SET_AI_LOADING":
      return { ...state, aiLoading: action.payload };
    case "SET_BILLBACK":
      return { ...state, billbackItems: action.payload.items, billbackMeta: action.payload.meta };
    case "SET_UNMATCHED":
      return { ...state, unmatchedProducts: action.payload };
    case "SET_ANALYSIS":
      return { ...state, analysis: action.payload };
    case "SET_ANALYSES": {
      const next = new Map(state.analyses);
      next.set(action.payload.fileName, action.payload.analysis);
      return { ...state, analyses: next };
    }
    case "SET_INTEGRATION_PLAN":
      return { ...state, integrationPlan: action.payload };
    case "TOGGLE_AI":
      return { ...state, useAI: action.payload };
    case "RESET":
      return {
        ...initialState,
        useAI: state.useAI,
        smartImportEnabled: state.smartImportEnabled,
      };
    default:
      return state;
  }
}

// ─── Component ──────────────────────────────────────────────────

export default function DataImport() {
  const { importDatasets, userRole, tenantId, useNormalized, tenantConfig, updateTenantConfig, refreshData } = useData();
  const { products, createProduct } = useCrm();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef();
  const processingRef = useRef(false);

  const smartImportEnabled = !!tenantConfig?.features?.smartImport;

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    smartImportEnabled,
  });

  const {
    step, file, parsed, mapping, confidence, uploadType,
    preview, summary, error, saving, dragOver, useAI, aiLoading,
    billbackItems, billbackMeta, unmatchedProducts,
    analysis, analyses,
  } = state;

  const isBillbackEnabled = tenantConfig?.features?.billbacks;

  // ── Multi-file queue ──

  const comprehendCallable = useCallback(async (args) => {
    const fns = getFunctions();
    const comprehendReport = httpsCallable(fns, "comprehendReport");
    return comprehendReport(args);
  }, []);

  const fq = useFileQueue({
    parseFile,
    autoDetectMapping,
    aiAutoDetectMapping,
    detectUploadType,
    comprehendReport: smartImportEnabled ? comprehendCallable : null,
    loadRecentUploads,
    useAI,
    smartImportEnabled,
    userRole,
    tenantId,
  });

  const isBatchMode = fq.queue.length > 0;

  // ── Auto-process queue: when a file is queued, process it ──

  useEffect(() => {
    if (processingRef.current) return;
    const nextQueued = fq.queue.find((i) => i.status === "queued");
    if (!nextQueued) return;

    processingRef.current = true;
    fq.processNext().finally(() => {
      processingRef.current = false;
    });
  }, [fq.queue, fq.processNext]);

  // ── Import a queue item (auto-confirmed or user-confirmed) ──

  const importQueueFile = useCallback(async (item) => {
    fq.markImporting(item.id);
    try {
      const { parsed: itemParsed, mapping: itemMapping, type: itemType, file: itemFile } = item;

      // Product sheet — cannot auto-import, should be in needs-review
      if (itemType?.type === "product_sheet") {
        // This shouldn't happen for auto-confirmed, but guard anyway
        return;
      }

      // Billback PDF — cannot auto-import
      if (itemFile && /\.pdf$/i.test(itemFile.name)) {
        return;
      }

      const result = transformAll(itemParsed.rows, itemMapping, itemType, userRole);
      const summaryText = generateSummary(result.type || itemType?.type, result, userRole);
      const { type: _t, ...datasets } = result;

      let importMeta;
      if (useNormalized) {
        const normalized = normalizeRows(itemParsed.rows, itemMapping);
        importMeta = {
          normalizedRows: normalized,
          fileName: itemFile.name,
          type: itemType?.type,
          mapping: itemMapping,
          uploadedBy: currentUser?.email || "unknown",
        };
      }

      await importDatasets(datasets, summaryText, importMeta);

      if (tenantConfig?.demoData) {
        await updateTenantConfig({ demoData: false });
      }

      if (tenantId) {
        await logUpload(tenantId, {
          fileName: itemFile.name,
          rowCount: itemParsed.rows.length,
          type: itemType?.type,
          uploadedBy: currentUser?.email || "unknown",
        });
      }

      fq.markDone(item.id, { rowCount: itemParsed.rows.length, type: itemType?.type });
    } catch (err) {
      fq.markError(item.id, err.message || String(err));
    }
  }, [fq, userRole, useNormalized, importDatasets, tenantConfig, updateTenantConfig, tenantId, currentUser]);

  // ── Auto-import: when a file is auto-confirmed, import it ──

  useEffect(() => {
    const autoItem = fq.queue.find((i) => i.status === "auto-confirmed");
    if (!autoItem) return;

    importQueueFile(autoItem);
  }, [fq.queue, importQueueFile]);

  // ── Handle files dropped or selected ──

  const handleFiles = useCallback(async (fileList) => {
    dispatch({ type: "SET_ERROR", payload: "" });
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Single file: use existing single-file flow (preserves billback/product-sheet review UX)
    if (files.length === 1 && fq.queue.length === 0) {
      handleSingleFile(files[0]);
      return;
    }

    // Multi-file: add to queue
    await fq.addFiles(files);
  }, [fq]);

  // ── Single file flow (original behavior) ──

  const handleSingleFile = useCallback(async (f) => {
    dispatch({ type: "SET_ERROR", payload: "" });

    if (f.size > MAX_FILE_SIZE) {
      dispatch({ type: "SET_ERROR", payload: `File is too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.` });
      return;
    }
    if (f.size === 0) {
      dispatch({ type: "SET_ERROR", payload: "File is empty." });
      return;
    }

    dispatch({ type: "SET_FILE", payload: f });

    // PDF billback flow
    if (f.type === "application/pdf" && isBillbackEnabled) {
      dispatch({ type: "SET_AI_LOADING", payload: true });
      try {
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

        const fns = getFunctions();
        const parseBillback = httpsCallable(fns, "parseBillbackPDF");
        const { data: result } = await parseBillback({ tenantId, pdfBase64: base64 });

        if (!result.lineItems || result.lineItems.length === 0) {
          dispatch({ type: "SET_ERROR", payload: "No billback line items could be extracted from this PDF. Try a different file." });
          return;
        }

        dispatch({ type: "SET_BILLBACK", payload: { items: result.lineItems, meta: result.metadata || {} } });
        dispatch({ type: "SET_STEP", payload: "billback-review" });
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: `PDF extraction failed: ${err.message}` });
      } finally {
        dispatch({ type: "SET_AI_LOADING", payload: false });
      }
      return;
    }

    try {
      const result = await parseFile(f);
      if (result.rows.length === 0) {
        dispatch({ type: "SET_ERROR", payload: "File is empty or could not be parsed." });
        return;
      }
      dispatch({ type: "SET_PARSED", payload: result });

      // Smart import path
      if (smartImportEnabled) {
        dispatch({ type: "SET_AI_LOADING", payload: true });
        let comprehendResult = null;
        try {
          const { data } = await comprehendCallable({
            tenantId,
            fileName: f.name,
            headers: result.headers,
            sampleRows: smartSampleRows(result.rows),
          });
          if (!data.error) comprehendResult = data;
          dispatch({ type: "SET_ANALYSIS", payload: data });
          dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: data } });
        } catch (err) {
          const errorAnalysis = {
            error: true,
            errorType: err.code || "unknown",
            suggestion: err.message || "AI comprehension failed. Using rule-based mapping.",
          };
          dispatch({ type: "SET_ANALYSIS", payload: errorAnalysis });
          dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: errorAnalysis } });
        } finally {
          dispatch({ type: "SET_AI_LOADING", payload: false });
        }

        let autoMap, conf;
        if (comprehendResult?.mapping) {
          autoMap = comprehendResult.mapping;
          conf = {};
          if (comprehendResult.columnSemantics) {
            for (const [, semantic] of Object.entries(comprehendResult.columnSemantics)) {
              if (semantic.field) conf[semantic.field] = semantic.confidence || 0;
            }
          }
        } else if (useAI) {
          dispatch({ type: "SET_AI_LOADING", payload: true });
          try {
            const aiResult = await aiAutoDetectMapping(result.headers, result.rows);
            autoMap = aiResult.mapping;
            conf = aiResult.confidence;
          } catch {
            const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
            autoMap = ruleResult.mapping;
            conf = ruleResult.confidence;
          } finally {
            dispatch({ type: "SET_AI_LOADING", payload: false });
          }
        } else {
          const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
          autoMap = ruleResult.mapping;
          conf = ruleResult.confidence;
        }

        dispatch({ type: "SET_MAPPING", payload: autoMap });
        dispatch({ type: "SET_CONFIDENCE", payload: conf });
        const type = detectUploadType(result.headers, result.rows, autoMap);
        dispatch({ type: "SET_UPLOAD_TYPE", payload: type });
        dispatch({ type: "SET_STEP", payload: type?.type === "product_sheet" ? "product-sheet-review" : "mapping" });
        return;
      }

      // Standard path
      let autoMap, conf;
      if (useAI) {
        dispatch({ type: "SET_AI_LOADING", payload: true });
        try {
          const aiResult = await aiAutoDetectMapping(result.headers, result.rows);
          autoMap = aiResult.mapping;
          conf = aiResult.confidence;
        } catch {
          const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
          autoMap = ruleResult.mapping;
          conf = ruleResult.confidence;
        } finally {
          dispatch({ type: "SET_AI_LOADING", payload: false });
        }
      } else {
        const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
        autoMap = ruleResult.mapping;
        conf = ruleResult.confidence;
      }

      dispatch({ type: "SET_MAPPING", payload: autoMap });
      dispatch({ type: "SET_CONFIDENCE", payload: conf });
      const type = detectUploadType(result.headers, result.rows, autoMap);
      dispatch({ type: "SET_UPLOAD_TYPE", payload: type });
      dispatch({ type: "SET_STEP", payload: type?.type === "product_sheet" ? "product-sheet-review" : "mapping" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    }
  }, [useAI, isBillbackEnabled, tenantId, smartImportEnabled, userRole, comprehendCallable]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    dispatch({ type: "SET_DRAG_OVER", payload: false });
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles?.length > 0) handleFiles(droppedFiles);
  }, [handleFiles]);

  const onFileSelect = useCallback((e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles?.length > 0) handleFiles(selectedFiles);
    // Reset input so re-selecting the same file works
    if (inputRef.current) inputRef.current.value = "";
  }, [handleFiles]);

  // ── Mapping step: handle a needs-review queue item ──

  const handleReviewFile = useCallback((item) => {
    dispatch({ type: "SET_FILE", payload: item.file });
    dispatch({ type: "SET_PARSED", payload: item.parsed });
    dispatch({ type: "SET_MAPPING", payload: item.mapping });
    dispatch({ type: "SET_CONFIDENCE", payload: item.confidence });
    dispatch({ type: "SET_UPLOAD_TYPE", payload: item.type });
    if (item.analysis) {
      dispatch({ type: "SET_ANALYSIS", payload: item.analysis });
    }

    if (item.type?.type === "product_sheet") {
      dispatch({ type: "SET_STEP", payload: "product-sheet-review" });
    } else if (item.file && /\.pdf$/i.test(item.file.name) && isBillbackEnabled) {
      // PDF billback in queue — need to run through billback extraction
      handleSingleFile(item.file);
    } else {
      dispatch({ type: "SET_STEP", payload: "mapping" });
    }
  }, [isBillbackEnabled, handleSingleFile]);

  // ── Step 2: Update mapping ──

  const updateMapping = (field, column) => {
    dispatch({ type: "SET_MAPPING", payload: { ...mapping, [field]: column || undefined } });
  };

  const proceedToPreview = () => {
    try {
      const result = transformAll(parsed.rows, mapping, uploadType, userRole);
      dispatch({ type: "SET_PREVIEW", payload: result });
      const summaryText = generateSummary(result.type || uploadType.type, result, userRole);
      dispatch({ type: "SET_SUMMARY", payload: summaryText });
      dispatch({ type: "SET_STEP", payload: "preview" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: `Transform error: ${err.message}` });
    }
  };

  // ── Step 3: Confirm & Save ──

  const confirmImport = async () => {
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });
    try {
      const { type, ...datasets } = preview;

      let importMeta;
      if (useNormalized) {
        const normalized = normalizeRows(parsed.rows, mapping);
        importMeta = {
          normalizedRows: normalized,
          fileName: file.name,
          type: uploadType.type,
          mapping,
          uploadedBy: currentUser?.email || "unknown",
        };
      }

      const { importId } = await importDatasets(datasets, summary, importMeta);

      if (tenantConfig?.demoData) {
        await updateTenantConfig({ demoData: false });
      }

      if (tenantId) {
        await logUpload(tenantId, {
          fileName: file.name,
          rowCount: parsed.rows.length,
          type: uploadType.type,
          uploadedBy: currentUser?.email || "unknown",
        });
      }

      // Product matching
      if (mapping.sku && parsed?.rows?.length > 0) {
        const skuCol = mapping.sku;
        const rawProductNames = [...new Set(
          parsed.rows.map((r) => (r[skuCol] || "").trim()).filter(Boolean)
        )];

        if (rawProductNames.length > 0) {
          const { unmatched: clientUnmatched } = clientExactMatch(rawProductNames, products);

          if (clientUnmatched.length > 0 && importId && tenantId) {
            try {
              const fns = getFunctions();
              const matchProducts = httpsCallable(fns, "matchProductsFromImport");
              const { data: matchResult } = await matchProducts({
                tenantId,
                importId,
                unmatchedNames: clientUnmatched,
              });
              dispatch({ type: "SET_UNMATCHED", payload: matchResult.unmatched || [] });
            } catch (err) {
              console.error("[DataImport] Product matching failed:", err.message);
              dispatch({ type: "SET_UNMATCHED", payload: clientUnmatched });
            }
          }
        }
      }

      // If this was a queue item being reviewed, mark it done and go back to queue
      const reviewingItem = fq.queue.find((i) => i.status === "needs-review" && i.file.name === file.name);
      if (reviewingItem) {
        fq.markDone(reviewingItem.id, { rowCount: parsed.rows.length, type: uploadType.type });
        dispatch({ type: "SET_STEP", payload: "upload" });
        return;
      }

      dispatch({ type: "SET_STEP", payload: "done" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  // ── Billback Confirm ──

  const confirmBillbackImport = async () => {
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });
    try {
      const normalizedRows = billbackItems.map((item) => ({
        wine: item.wine || "",
        producer: item.producer || "",
        dist: item.distributor || billbackMeta?.distributor || "",
        amount: item.amount || 0,
        qty: item.qty || 0,
        date: item.date || billbackMeta?.date || "",
        type: item.type || "other",
        invoiceNo: item.invoiceNo || billbackMeta?.invoiceNo || "",
      }));

      const importMeta = {
        normalizedRows,
        fileName: file.name,
        type: "billback",
        mapping: { wine: "wine", producer: "producer", dist: "dist", amount: "amount", qty: "qty", date: "date", type: "type", invoiceNo: "invoiceNo" },
        uploadedBy: currentUser?.email || "unknown",
      };

      const datasets = transformBillback(normalizedRows, importMeta.mapping);
      const { importId } = await importDatasets(
        datasets,
        `Imported ${normalizedRows.length} billback line items from ${file.name}.`,
        importMeta
      );

      if (importId) {
        const fns = getFunctions();
        const extractWines = httpsCallable(fns, "extractWines");
        await extractWines({ tenantId, importId });
      }

      if (tenantConfig?.demoData) {
        await updateTenantConfig({ demoData: false });
      }

      if (tenantId) {
        await logUpload(tenantId, {
          fileName: file.name,
          rowCount: normalizedRows.length,
          type: "billback",
          uploadedBy: currentUser?.email || "unknown",
        });
      }
      await refreshData();

      // If in queue, mark done
      const reviewingItem = fq.queue.find((i) => i.status === "needs-review" && i.file.name === file.name);
      if (reviewingItem) {
        fq.markDone(reviewingItem.id, { rowCount: normalizedRows.length, type: "billback" });
        dispatch({ type: "SET_STEP", payload: "upload" });
        return;
      }

      dispatch({ type: "SET_SUMMARY", payload: `Imported ${normalizedRows.length} billback line items from ${file.name}.` });
      dispatch({ type: "SET_STEP", payload: "done" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  // ── Product Sheet Confirm ──

  const confirmProductSheetImport = async (selectedProducts) => {
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: "" });
    try {
      await Promise.all(selectedProducts.map((p) => createProduct(p)));

      if (tenantConfig?.demoData) {
        await updateTenantConfig({ demoData: false });
      }

      if (tenantId) {
        await logUpload(tenantId, {
          fileName: file.name,
          rowCount: selectedProducts.length,
          type: "product_sheet",
          uploadedBy: currentUser?.email || "unknown",
        });
      }

      // If in queue, mark done
      const reviewingItem = fq.queue.find((i) => i.status === "needs-review" && i.file.name === file.name);
      if (reviewingItem) {
        fq.markDone(reviewingItem.id, { rowCount: selectedProducts.length, type: "product_sheet" });
        dispatch({ type: "SET_STEP", payload: "upload" });
        return;
      }

      dispatch({ type: "SET_SUMMARY", payload: `${selectedProducts.length} wine${selectedProducts.length !== 1 ? "s" : ""} added to your portfolio.` });
      dispatch({ type: "SET_STEP", payload: "done" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  // ── Reset ──

  const reset = () => {
    dispatch({ type: "RESET" });
  };

  // ── Retry smart import analysis ──

  const retryAnalysis = useCallback(() => {
    if (file) {
      dispatch({ type: "SET_ANALYSIS", payload: null });
      handleSingleFile(file);
    }
  }, [file, handleSingleFile]);

  // ── Render ──

  return (
    <div>
      {error && (
        <div style={s.error}>
          {error}
          <span onClick={() => dispatch({ type: "SET_ERROR", payload: "" })} style={{ cursor: "pointer", marginLeft: 8, fontWeight: 700 }}>&times;</span>
        </div>
      )}

      {/* ── Queue Panel (shown when multiple files are queued) ── */}
      {isBatchMode && step === "upload" && (
        <QueuePanel
          queue={fq.queue}
          progress={fq.progress}
          batchDone={fq.batchDone}
          batchResults={fq.batchResults}
          onRemove={fq.removeFile}
          onReview={handleReviewFile}
          onReset={reset}
          onAddMore={() => inputRef.current?.click()}
        />
      )}

      {/* ── Drop Zone (shown when no batch is active, or batch is done) ── */}
      {step === "upload" && !isBatchMode && (
        <div
          onDragOver={(e) => { e.preventDefault(); dispatch({ type: "SET_DRAG_OVER", payload: true }); }}
          onDragLeave={() => dispatch({ type: "SET_DRAG_OVER", payload: false })}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            ...s.dropZone,
            borderColor: dragOver ? "#6B1E1E" : "#D1D5DB",
            background: dragOver ? "#FDF8F0" : "#fafafa",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#128202;</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#2E2E2E" }}>
            Drop your data files here, or click to browse
          </div>
          <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 6 }}>
            Supports .csv, .xlsx, .xls{isBillbackEnabled ? ", .pdf (billbacks)" : ""} &mdash; up to 10MB &mdash; multiple files supported
          </div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 4 }}>
            QuickBooks exports, {t("distributor").toLowerCase()} reports, inventory files, pipeline data
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12 }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: useAI ? "#6B1E1E" : "#6B6B6B" }}>
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => dispatch({ type: "TOGGLE_AI", payload: e.target.checked })}
                style={{ accentColor: "#6B1E1E" }}
              />
              AI-Powered Mapping
            </label>
            {useAI && <span style={{ color: "#6B1E1E", fontSize: 10 }}>(Claude)</span>}
          </div>
          {aiLoading && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6B1E1E", fontWeight: 600 }}>
              {smartImportEnabled ? "AI is comprehending your report..." : "AI is analyzing your data..."}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={isBillbackEnabled ? ".csv,.xlsx,.xls,.tsv,.pdf" : ".csv,.xlsx,.xls,.tsv"}
            multiple
            onChange={onFileSelect}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* Hidden file input for "add more" in batch mode */}
      {isBatchMode && (
        <input
          ref={inputRef}
          type="file"
          accept={isBillbackEnabled ? ".csv,.xlsx,.xls,.tsv,.pdf" : ".csv,.xlsx,.xls,.tsv"}
          multiple
          onChange={onFileSelect}
          style={{ display: "none" }}
        />
      )}

      {step === "billback-review" && billbackItems && (
        <BillbackReviewStep
          fileName={file.name}
          items={billbackItems}
          metadata={billbackMeta}
          saving={saving}
          onUpdateItem={(idx, field, value) => {
            const next = [...billbackItems];
            next[idx] = { ...next[idx], [field]: value };
            dispatch({ type: "SET_BILLBACK", payload: { items: next, meta: billbackMeta } });
          }}
          onDeleteItem={(idx) => {
            dispatch({ type: "SET_BILLBACK", payload: { items: billbackItems.filter((_, i) => i !== idx), meta: billbackMeta } });
          }}
          onConfirm={confirmBillbackImport}
          onBack={() => {
            if (isBatchMode) {
              // Skip this file back to queue
              const item = fq.queue.find((i) => i.status === "needs-review" && i.file.name === file.name);
              if (item) fq.markError(item.id, "Skipped by user");
              dispatch({ type: "SET_STEP", payload: "upload" });
            } else {
              reset();
            }
          }}
        />
      )}

      {step === "product-sheet-review" && parsed && (
        <ProductSheetReviewStep
          rows={parsed.rows}
          headers={parsed.headers}
          mapping={mapping}
          onConfirm={confirmProductSheetImport}
          onCancel={() => {
            if (isBatchMode) {
              const item = fq.queue.find((i) => i.status === "needs-review" && i.file.name === file.name);
              if (item) fq.markError(item.id, "Skipped by user");
              dispatch({ type: "SET_STEP", payload: "upload" });
            } else {
              reset();
            }
          }}
        />
      )}

      {step === "mapping" && parsed && (
        <>
          {smartImportEnabled && analysis && (
            <ReportAnalysisCard
              analysis={analysis}
              fileName={file?.name}
              onRetry={analysis.error ? retryAnalysis : undefined}
            />
          )}
          <MappingStep
            fileName={file.name}
            headers={parsed.headers}
            rows={parsed.rows}
            mapping={mapping}
            confidence={confidence}
            uploadType={uploadType}
            onUpdateMapping={updateMapping}
            onProceed={proceedToPreview}
            onBack={() => {
              if (isBatchMode) {
                // Go back to queue view (file stays needs-review)
                dispatch({ type: "SET_STEP", payload: "upload" });
              } else {
                reset();
              }
            }}
          />
        </>
      )}

      {step === "preview" && preview && (
        <PreviewStep
          summary={summary}
          preview={preview}
          uploadType={uploadType}
          saving={saving}
          onConfirm={confirmImport}
          onBack={() => dispatch({ type: "SET_STEP", payload: "mapping" })}
        />
      )}

      {step === "done" && !isBatchMode && (
        <div style={s.doneBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#9989;</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1F865A", margin: "0 0 8px" }}>
            Import Complete
          </h3>
          <p style={{ fontSize: 14, color: "#6B6B6B", marginBottom: 16 }}>{summary}</p>
          {unmatchedProducts.length > 0 && (
            <div className="import-unmatched">
              <div className="import-unmatched__header">
                <span className="import-unmatched__icon">&#128203;</span>
                <span>{unmatchedProducts.length} products not in your catalog</span>
              </div>
              <div className="import-unmatched__list">
                {unmatchedProducts.slice(0, 10).map((name) => (
                  <div key={name} className="import-unmatched__item">{name}</div>
                ))}
                {unmatchedProducts.length > 10 && (
                  <div className="import-unmatched__more">+{unmatchedProducts.length - 10} more</div>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => navigate("/portfolio")}>
                Add to Portfolio &rarr;
              </button>
            </div>
          )}
          <button className="btn btn-primary" onClick={reset}>
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Smart sampling helper ──────────────────────────────────────

function smartSampleRows(rows) {
  if (rows.length <= 50) return rows;
  const first20 = rows.slice(0, 20);
  const midStart = Math.floor(rows.length / 2) - 10;
  const mid20 = rows.slice(midStart, midStart + 20);
  const last10 = rows.slice(-10);
  return [...first20, ...mid20, ...last10];
}

// ─── Queue Panel Sub-Component ──────────────────────────────────

const STATUS_LABELS = {
  queued: "Queued",
  parsing: "Analyzing...",
  "auto-confirmed": "Auto-confirmed",
  "needs-review": "Needs Review",
  importing: "Importing...",
  done: "Imported",
  error: "Failed",
};

const STATUS_COLORS = {
  queued: { bg: "#f3f4f6", color: "#6B7280" },
  parsing: { bg: "#dbeafe", color: "#1e40af" },
  "auto-confirmed": { bg: "#d1f5e8", color: "#059669" },
  "needs-review": { bg: "#fef3c7", color: "#d97706" },
  importing: { bg: "#dbeafe", color: "#1e40af" },
  done: { bg: "#d1f5e8", color: "#059669" },
  error: { bg: "#fee2e2", color: "#dc2626" },
};

function QueuePanel({ queue, progress, batchDone, batchResults, onRemove, onReview, onReset, onAddMore }) {
  const totalRows = batchResults
    .filter((r) => r.status === "done")
    .reduce((sum, r) => sum + (r.rowCount || 0), 0);

  return (
    <div style={s.queuePanel}>
      {/* Header */}
      <div style={s.queueHeader}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {batchDone ? "Import Complete" : "Importing Files"}
          </h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
            {batchDone
              ? `${progress.done} of ${progress.total} files imported${totalRows > 0 ? ` \u2014 ${totalRows.toLocaleString()} rows` : ""}${progress.failed > 0 ? ` \u2014 ${progress.failed} failed` : ""}`
              : `Processing ${progress.current} of ${progress.total} files...`
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!batchDone && (
            <button className="btn btn-secondary" onClick={onAddMore} style={{ fontSize: 12 }}>
              + Add Files
            </button>
          )}
          {batchDone && (
            <button className="btn btn-primary" onClick={onReset}>
              Import More
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!batchDone && (
        <div style={s.progressBar}>
          <div style={{
            ...s.progressFill,
            width: `${Math.round(((progress.done + progress.failed) / progress.total) * 100)}%`,
          }} />
        </div>
      )}

      {/* File list */}
      <div style={s.queueList}>
        {queue.map((item) => {
          const statusConf = STATUS_COLORS[item.status] || STATUS_COLORS.queued;
          return (
            <div key={item.id} style={s.queueItem}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.file.name}
                  </span>
                  {item.dupWarning && (
                    <span style={{ ...s.typeBadge, background: "#fef3c7", color: "#d97706", marginLeft: 0, fontSize: 10 }}>
                      Duplicate?
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{
                    padding: "1px 8px",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 600,
                    background: statusConf.bg,
                    color: statusConf.color,
                  }}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  {item.type?.type && (
                    <span style={{ ...s.typeBadge, marginLeft: 0, fontSize: 10 }}>
                      {item.type.type}
                    </span>
                  )}
                  {item.error && (
                    <span style={{ fontSize: 11, color: "#dc2626" }}>{item.error}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {item.status === "needs-review" && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onReview(item)}
                    style={{ fontSize: 11, padding: "3px 10px" }}
                  >
                    Review
                  </button>
                )}
                {item.status === "queued" && (
                  <button
                    onClick={() => onRemove(item.id)}
                    style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16, padding: 4 }}
                    title="Remove from queue"
                  >
                    &times;
                  </button>
                )}
                {item.status === "done" && (
                  <span style={{ fontSize: 14, color: "#059669" }}>&#10003;</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
