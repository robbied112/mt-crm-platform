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
import parseFile, { parseFileSheet } from "../../utils/parseFile";
import { autoDetectMapping, detectUploadType } from "../../utils/semanticMapper";
import { t } from "../../utils/terminology";
import { aiAutoDetectMapping } from "../../utils/aiMapper";
import { runComprehend } from "../../utils/runComprehend";
import { transformAll, generateSummary } from "../../utils/transformData";
import { transformBillback } from "../../utils/transformBillback";
import { normalizeRows, preserveRawRows } from "../../utils/normalize.js";
import { clientExactMatch, fuzzyMatchProducts } from "../../utils/productNormalize";
import { matchDistributorByHeaders, matchDistributorByFilename } from "../../config/reportGuides";
import { logUpload, saveLearnedMapping, getLearnedMapping } from "../../services/firestoreService";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useUpload } from "../../context/UploadContext";
import ProductSheetReviewStep from "../ProductSheetReviewStep";
import MappingStep from "./MappingStep";
import PreviewStep from "./PreviewStep";
import BillbackReviewStep from "./BillbackReviewStep";
import ReportAnalysisCard from "./ReportAnalysisCard";
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
  autoCreatedProducts: [],
  // Smart import state
  analyses: new Map(),
  analysis: null,
  integrationPlan: null,
  smartImportEnabled: false,
  // Sheet selection state
  sheetInfo: null,
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
    case "SET_AUTO_CREATED":
      return { ...state, autoCreatedProducts: action.payload };
    case "SET_ANALYSIS":
      return { ...state, analysis: action.payload };
    case "SET_ANALYSES": {
      const next = new Map(state.analyses);
      next.set(action.payload.fileName, action.payload.analysis);
      return { ...state, analyses: next };
    }
    case "SET_INTEGRATION_PLAN":
      return { ...state, integrationPlan: action.payload };
    case "SET_SHEET_INFO":
      return { ...state, sheetInfo: action.payload };
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

export default function DataImport({ dataTypeHint } = {}) {
  const { importDatasets, userRole, tenantId, useNormalized, tenantConfig, updateTenantConfig, refreshData } = useData();
  const { products, createProduct } = useCrm();
  const { currentUser, isAdmin } = useAuth();
  const { memberCount } = useTeam();
  const navigate = useNavigate();
  const inputRef = useRef();
  // importingRef removed — auto-import now uses the atomic
  // claimNextImport() + status-based guard (same pattern as processNext).

  const smartImportEnabled = !!tenantConfig?.features?.smartImport;

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    smartImportEnabled,
  });

  const {
    step, file, parsed, mapping, confidence, uploadType,
    preview, summary, error, saving, dragOver, useAI, aiLoading,
    billbackItems, billbackMeta, unmatchedProducts, autoCreatedProducts,
    analysis, analyses, sheetInfo,
  } = state;

  const isBillbackEnabled = tenantConfig?.features?.billbacks;

  // ── Shared mapping helper (DRY across all import paths) ──
  // Tries AI mapper → falls back to rule-based → dispatches mapping + type.

  const runMapping = useCallback(async (headers, rows, fileName) => {
    let autoMap, conf;

    // Layer 0: Learned mapping lookup (instant)
    if (tenantId) {
      try {
        const learned = await getLearnedMapping(tenantId, headers);
        if (learned) {
          autoMap = learned.mapping;
          conf = { _learned: true };
          const type = learned.uploadType ? { type: learned.uploadType } : detectUploadType(headers, rows, autoMap);
          dispatch({ type: "SET_MAPPING", payload: autoMap });
          dispatch({ type: "SET_CONFIDENCE", payload: conf });
          dispatch({ type: "SET_UPLOAD_TYPE", payload: type });
          return { mapping: autoMap, confidence: conf, type };
        }
      } catch (err) {
        console.warn("[DataImport] Learned mapping lookup failed:", err.message);
      }
    }

    // Layer 1: Report guide signature matching (instant, 0ms)
    const guidMatch = matchDistributorByHeaders(headers) || matchDistributorByFilename(fileName);

    if (useAI) {
      dispatch({ type: "SET_AI_LOADING", payload: true });
      try {
        const aiResult = await aiAutoDetectMapping(headers, rows);
        autoMap = aiResult.mapping;
        conf = aiResult.confidence;
      } catch {
        const ruleResult = autoDetectMapping(headers, rows, userRole);
        autoMap = ruleResult.mapping;
        conf = ruleResult.confidence;
      } finally {
        dispatch({ type: "SET_AI_LOADING", payload: false });
      }
    } else {
      const ruleResult = autoDetectMapping(headers, rows, userRole);
      autoMap = ruleResult.mapping;
      conf = ruleResult.confidence;
    }

    // Enrich confidence with guide match info
    if (guidMatch) {
      conf._detectedSystem = guidMatch;
    }

    dispatch({ type: "SET_MAPPING", payload: autoMap });
    dispatch({ type: "SET_CONFIDENCE", payload: conf });
    const detectedType = detectUploadType(headers, rows, autoMap);
    const type = dataTypeHint ? { type: dataTypeHint, ...(detectedType || {}) } : detectedType;
    dispatch({ type: "SET_UPLOAD_TYPE", payload: type });
    return { mapping: autoMap, confidence: conf, type };
  }, [useAI, userRole, dataTypeHint, tenantId]);

  // ── Multi-file queue (from shared UploadContext) ──

  const fq = useUpload();
  const { comprehendCallable } = fq;
  const isBatchMode = fq.queue.length > 0;

  // ── Auto-process queue: when a file is queued, process it ──
  // Guard with queue status instead of a ref — ref clears after the queue
  // state change, so the effect may miss the re-trigger window.

  useEffect(() => {
    const isParsing = fq.queue.some((i) => i.status === "parsing");
    if (isParsing) return;
    const nextQueued = fq.queue.find((i) => i.status === "queued");
    if (!nextQueued) return;

    fq.processNext();
  }, [fq.queue, fq.processNext]);


  // ── Import a queue item (auto-confirmed or user-confirmed) ──

  const importQueueFile = useCallback(async (item) => {
    // Note: caller (claimNextImport) already marked item as "importing".
    try {
      const { parsed: itemParsed, mapping: itemMapping, type: itemType, file: itemFile } = item;

      // Product sheet — cannot auto-import, should be in needs-review
      if (itemType?.type === "product_sheet") {
        fq.markError(item.id, "Product sheets require manual review");
        return;
      }

      // Billback PDF — cannot auto-import
      if (itemFile && /\.pdf$/i.test(itemFile.name)) {
        fq.markError(item.id, "PDF files require manual review");
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
          rawRows: preserveRawRows(itemParsed.rows),
          rawHeaders: itemParsed.headers || Object.keys(itemParsed.rows[0] || {}),
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
  }, [fq.markDone, fq.markError, userRole, useNormalized, importDatasets, tenantConfig, updateTenantConfig, tenantId, currentUser]);

  // ── Auto-import: when a file is auto-confirmed, import it ──
  // Guard with queue status (not a ref) — same fix as auto-process.
  // claimNextImport() atomically finds + marks the next item so
  // concurrent effect runs can never start a double-import.

  useEffect(() => {
    const isImporting = fq.queue.some((i) => i.status === "importing");
    if (isImporting) return;
    const hasAutoConfirmed = fq.queue.some((i) => i.status === "auto-confirmed");
    if (!hasAutoConfirmed) return;

    const item = fq.claimNextImport();
    if (!item) return;
    importQueueFile(item);
  }, [fq.queue, fq.claimNextImport, importQueueFile]);

  // ── Handle files dropped or selected ──

  const handleFiles = useCallback(async (fileList) => {
    dispatch({ type: "SET_ERROR", payload: "" });
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Single PDF billback: use legacy flow (needs specialized extraction UI)
    if (files.length === 1 && fq.queue.length === 0 && /\.pdf$/i.test(files[0].name) && isBillbackEnabled) {
      handleSingleFile(files[0]);
      return;
    }

    // All files (single or multiple) go through the queue
    await fq.addFiles(files);
  }, [fq, isBillbackEnabled]);

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
      let result = await parseFile(f);
      if (result.rows.length === 0) {
        dispatch({ type: "SET_ERROR", payload: "File is empty or could not be parsed." });
        return;
      }
      dispatch({ type: "SET_PARSED", payload: result });
      const originalSheetInfo = result.sheetInfo;
      if (originalSheetInfo) {
        dispatch({ type: "SET_SHEET_INFO", payload: originalSheetInfo });
      }

      // Smart import path — uses shared runComprehend helper
      if (smartImportEnabled) {
        dispatch({ type: "SET_AI_LOADING", payload: true });
        try {
          const comprehendOut = await runComprehend({
            file: f,
            parsed: result,
            comprehendCallable,
            tenantId,
          });

          // Update state from comprehend results
          dispatch({ type: "SET_ANALYSIS", payload: comprehendOut.analysis });
          dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: comprehendOut.analysis } });

          if (comprehendOut.sheetInfo) {
            dispatch({ type: "SET_SHEET_INFO", payload: comprehendOut.sheetInfo });
          }

          // Use merged or re-parsed data if available
          if (comprehendOut.parsed !== result) {
            result = comprehendOut.parsed;
            dispatch({ type: "SET_PARSED", payload: result });
          }

          // Use AI mapping if available, otherwise run standard mapping
          if (comprehendOut.mapping) {
            dispatch({ type: "SET_MAPPING", payload: comprehendOut.mapping });
            dispatch({ type: "SET_CONFIDENCE", payload: comprehendOut.confidence || {} });
            const type = detectUploadType(result.headers, result.rows, comprehendOut.mapping);
            dispatch({ type: "SET_UPLOAD_TYPE", payload: type });
            dispatch({ type: "SET_STEP", payload: type?.type === "product_sheet" ? "product-sheet-review" : "mapping" });
          } else {
            const { type } = await runMapping(result.headers, result.rows, f.name);
            dispatch({ type: "SET_STEP", payload: type?.type === "product_sheet" ? "product-sheet-review" : "mapping" });
          }
        } catch (err) {
          const errorAnalysis = {
            error: true,
            errorType: err.code || "unknown",
            suggestion: err.message || "AI comprehension failed. Using rule-based mapping.",
          };
          dispatch({ type: "SET_ANALYSIS", payload: errorAnalysis });
          dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: errorAnalysis } });
          // Fallback to standard mapping
          const { type } = await runMapping(result.headers, result.rows, f.name);
          dispatch({ type: "SET_STEP", payload: type?.type === "product_sheet" ? "product-sheet-review" : "mapping" });
        } finally {
          dispatch({ type: "SET_AI_LOADING", payload: false });
        }
        return;
      }

      // Standard path
      const { type } = await runMapping(result.headers, result.rows, f.name);
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
          rawRows: preserveRawRows(parsed.rows),
          rawHeaders: parsed.headers || Object.keys(parsed.rows[0] || {}),
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

      // Save confirmed mapping for future recognition
      if (tenantId && parsed?.headers?.length > 0) {
        saveLearnedMapping(tenantId, parsed.headers, mapping, uploadType).catch(err =>
          console.warn("[DataImport] Failed to save learned mapping:", err.message)
        );
      }

      // Product auto-creation: create new products from import
      if (mapping.sku && parsed?.rows?.length > 0) {
        const skuCol = mapping.sku;
        const rawProductNames = [...new Set(
          parsed.rows.map((r) => (r[skuCol] || "").trim()).filter(Boolean)
        )];

        // Also include productNames from QB transform if available
        const qbProductNames = preview?.productNames || [];
        const allProductNames = [...new Set([...rawProductNames, ...qbProductNames])];

        if (allProductNames.length > 0) {
          const { unmatched: clientUnmatched } = clientExactMatch(allProductNames, products);

          if (clientUnmatched.length > 0) {
            // Try fuzzy matching before auto-creating — prevents duplicates from name variations
            const { matched: fuzzyMatched, unmatched: trulyUnmatched } = fuzzyMatchProducts(clientUnmatched, products);

            // Auto-create only truly unmatched products
            const created = [];
            for (const name of trulyUnmatched) {
              try {
                await createProduct({
                  name,
                  type: "wine",
                  status: "active",
                  source: "import",
                  importedFrom: file.name,
                });
                created.push(name);
              } catch (err) {
                console.error(`[DataImport] Failed to create product "${name}":`, err.message);
              }
            }

            if (created.length > 0 || fuzzyMatched.length > 0) {
              dispatch({ type: "SET_AUTO_CREATED", payload: created });
              dispatch({ type: "SET_UNMATCHED", payload: trulyUnmatched.filter(n => !created.includes(n)) });
            } else {
              dispatch({ type: "SET_UNMATCHED", payload: trulyUnmatched });
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

      // Generate AI narration (fire and forget — don't block the done step)
      if (tenantId) {
        try {
          const fns = getFunctions();
          const generateNarration = httpsCallable(fns, "generateImportNarration");
          const narrationStats = {
            rowCount: parsed.rows.length,
            type: uploadType?.type,
            fileName: file.name,
            // Include key metrics from the transform result
            ...(preview?.revenueSummary ? {
              ytdTotal: preview.revenueSummary.ytdTotal,
              topChannel: preview.revenueSummary.topChannel,
              topSku: preview.revenueSummary.topSku,
              channelCount: preview.revenueSummary.channelCount,
            } : {}),
            ...(preview?.accountsTop ? {
              accountCount: preview.accountsTop.length,
              topAccount: preview.accountsTop[0]?.acct,
              totalRevenue: preview.accountsTop.reduce((s, a) => s + (a.total || 0), 0),
            } : {}),
            ...(preview?.distScorecard ? {
              distributorCount: preview.distScorecard.length,
              totalCE: preview.distScorecard.reduce((s, d) => s + (d.ce || 0), 0),
            } : {}),
          };

          generateNarration({ tenantId, dataType: uploadType?.type, stats: narrationStats })
            .then(({ data }) => {
              if (data?.narration) {
                dispatch({ type: "SET_SUMMARY", payload: data.narration });
              }
            })
            .catch(err => console.warn("[DataImport] Narration failed:", err.message));
        } catch (err) {
          console.warn("[DataImport] Narration setup failed:", err.message);
        }
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

  // ── Switch to a different sheet in the same Excel file ──

  const handleSheetChange = useCallback(async (sheetName) => {
    if (!file || !sheetInfo || sheetName === sheetInfo.selectedSheet) return;
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_AI_LOADING", payload: true });
    try {
      const result = await parseFileSheet(file, sheetName);
      if (result.rows.length === 0) {
        dispatch({ type: "SET_ERROR", payload: `Sheet "${sheetName}" has no data rows.` });
        dispatch({ type: "SET_AI_LOADING", payload: false });
        return;
      }
      // Preserve sheet scoring from the original parse, just update selectedSheet
      dispatch({ type: "SET_SHEET_INFO", payload: { ...sheetInfo, selectedSheet: sheetName } });
      dispatch({ type: "SET_PARSED", payload: result });

      // Re-run mapping on the new sheet
      await runMapping(result.headers, result.rows, file.name);
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_AI_LOADING", payload: false });
    }
  }, [file, sheetInfo, runMapping]);

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
          {sheetInfo?.multiSheet && (
            <SheetSelector
              sheetInfo={sheetInfo}
              onSheetChange={handleSheetChange}
              loading={aiLoading}
            />
          )}
          {smartImportEnabled && analysis && (
            <ReportAnalysisCard
              analysis={analysis}
              fileName={file?.name}
              onRetry={analysis.error ? retryAnalysis : undefined}
              analysisTiming={fq.analysisTiming}
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
          {autoCreatedProducts.length > 0 && (
            <div className="import-unmatched" style={{ borderColor: "#1F865A", background: "rgba(31, 134, 90, 0.04)" }}>
              <div className="import-unmatched__header" style={{ color: "#1F865A" }}>
                <span className="import-unmatched__icon">&#10003;</span>
                <span>{autoCreatedProducts.length} new product{autoCreatedProducts.length !== 1 ? "s" : ""} added to your portfolio</span>
              </div>
              <div className="import-unmatched__list">
                {autoCreatedProducts.slice(0, 10).map((name) => (
                  <div key={name} className="import-unmatched__item">{name}</div>
                ))}
                {autoCreatedProducts.length > 10 && (
                  <div className="import-unmatched__more">+{autoCreatedProducts.length - 10} more</div>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => navigate("/portfolio")}>
                View Portfolio &rarr;
              </button>
            </div>
          )}
          {unmatchedProducts.length > 0 && (
            <div className="import-unmatched">
              <div className="import-unmatched__header">
                <span className="import-unmatched__icon">&#128203;</span>
                <span>{unmatchedProducts.length} products could not be added to your catalog</span>
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
          {isAdmin && memberCount <= 1 && !tenantConfig?.teamPromptDismissed && (
            <div style={{
              marginBottom: 16, padding: "12px 16px",
              background: "rgba(107, 30, 30, 0.04)", border: "1px solid #E5E0DA",
              borderRadius: 8, textAlign: "left",
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#2E2E2E", margin: "0 0 4px" }}>
                Your data is live! Invite your team.
              </p>
              <p style={{ fontSize: 13, color: "#6B6B6B", margin: "0 0 8px" }}>
                Share this with reps and managers so they can see their territories.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-small" onClick={() => navigate("/settings#team")}>
                  Invite Teammates
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => updateTenantConfig({ teamPromptDismissed: true })}
                >
                  Later
                </button>
              </div>
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

function SheetSelector({ sheetInfo, onSheetChange, loading }) {
  const { sheets, selectedSheet, sheetNames } = sheetInfo;
  if (!sheetNames || sheetNames.length <= 1) return null;

  // Use scored order if available, otherwise fall back to workbook order
  const orderedSheets = sheets && sheets.length > 0
    ? sheets
    : sheetNames.map((name) => ({ name, rowCount: null, headerCount: null }));

  return (
    <div style={{
      background: "#FDF8F0",
      border: "1px solid #E5E0DA",
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 16,
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "#2E2E2E", whiteSpace: "nowrap" }}>
          &#128203; {sheetNames.length} sheets detected
        </span>
        <select
          value={selectedSheet}
          onChange={(e) => onSheetChange(e.target.value)}
          disabled={loading}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #D1CBC4",
            fontSize: 13,
            background: "#fff",
            minWidth: 200,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {orderedSheets.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.rowCount != null ? ` (${s.rowCount.toLocaleString()} rows, ${s.headerCount} cols)` : ""}
            </option>
          ))}
        </select>
        {loading && (
          <span style={{ fontSize: 12, color: "#6B1E1E", fontWeight: 500 }}>Re-analyzing...</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 8 }}>
        AI auto-selected the sheet with the most data. Switch if this isn&apos;t the right one.
      </div>
    </div>
  );
}

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
