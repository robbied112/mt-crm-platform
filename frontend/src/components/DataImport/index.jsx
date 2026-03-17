/**
 * DataImport — full import flow with drag-drop, semantic mapping,
 * format detection, preview, and Firestore persistence.
 */
import { useReducer, useRef, useCallback } from "react";
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
import { logUpload } from "../../services/firestoreService";
import { useAuth } from "../../context/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import ProductSheetReviewStep from "../ProductSheetReviewStep";
import MappingStep from "./MappingStep";
import PreviewStep from "./PreviewStep";
import BillbackReviewStep from "./BillbackReviewStep";
import ReportAnalysisCard from "./ReportAnalysisCard";
import s from "./styles";

const STEPS = ["upload", "mapping", "preview", "done"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Reducer ────────────────────────────────────────────────────

const initialState = {
  step: "upload",
  file: null,
  files: [],
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
    case "SET_FILES":
      return { ...state, files: action.payload };
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

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    smartImportEnabled: !!tenantConfig?.features?.smartImport,
  });

  const {
    step, file, files, parsed, mapping, confidence, uploadType,
    preview, summary, error, saving, dragOver, useAI, aiLoading,
    billbackItems, billbackMeta, unmatchedProducts,
    analysis, analyses, integrationPlan, smartImportEnabled,
  } = state;

  const isBillbackEnabled = tenantConfig?.features?.billbacks;

  // ── Step 1: File Drop / Select ──

  const handleFile = useCallback(async (f) => {
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

      // Smart import path: call comprehendReport Cloud Function
      if (smartImportEnabled) {
        dispatch({ type: "SET_AI_LOADING", payload: true });
        let comprehendResult = null;
        try {
          const fns = getFunctions();
          const comprehendReport = httpsCallable(fns, "comprehendReport");
          // Smart sampling: first 20 + middle 20 + last 10 rows
          const rows = result.rows;
          const totalRows = rows.length;
          let smartSample;
          if (totalRows <= 50) {
            smartSample = rows;
          } else {
            const first20 = rows.slice(0, 20);
            const midStart = Math.floor(totalRows / 2) - 10;
            const mid20 = rows.slice(midStart, midStart + 20);
            const last10 = rows.slice(-10);
            smartSample = [...first20, ...mid20, ...last10];
          }
          const { data } = await comprehendReport({
            tenantId,
            fileName: f.name,
            headers: result.headers,
            sampleRows: smartSample,
          });
          if (data.error) {
            // comprehendReport returned a structured error (not a throw)
            dispatch({ type: "SET_ANALYSIS", payload: data });
            dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: data } });
          } else {
            comprehendResult = data;
            dispatch({ type: "SET_ANALYSIS", payload: data });
            dispatch({ type: "SET_ANALYSES", payload: { fileName: f.name, analysis: data } });
          }
        } catch (err) {
          // AI comprehension failed — store error state, fall through to rule-based
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

        // Use extraction spec from AI if available
        let autoMap, conf;
        if (comprehendResult?.mapping) {
          autoMap = comprehendResult.mapping;
          // Build confidence map from columnSemantics
          conf = {};
          if (comprehendResult.columnSemantics) {
            for (const [, semantic] of Object.entries(comprehendResult.columnSemantics)) {
              if (semantic.field) conf[semantic.field] = semantic.confidence || 0;
            }
          }
        } else {
          // Fall back to rule-based or regular AI mapper
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
        }

        dispatch({ type: "SET_MAPPING", payload: autoMap });
        dispatch({ type: "SET_CONFIDENCE", payload: conf });

        const type = detectUploadType(result.headers, result.rows, autoMap);
        dispatch({ type: "SET_UPLOAD_TYPE", payload: type });

        if (type?.type === "product_sheet") {
          dispatch({ type: "SET_STEP", payload: "product-sheet-review" });
        } else {
          dispatch({ type: "SET_STEP", payload: "mapping" });
        }
        return;
      }

      // Standard path (smart import disabled)
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

      if (type?.type === "product_sheet") {
        dispatch({ type: "SET_STEP", payload: "product-sheet-review" });
      } else {
        dispatch({ type: "SET_STEP", payload: "mapping" });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    }
  }, [useAI, isBillbackEnabled, tenantId, smartImportEnabled, userRole]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    dispatch({ type: "SET_DRAG_OVER", payload: false });
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

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

      // Product matching — extract SKU names, run client exact match, then AI for remainder
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
      handleFile(file);
    }
  }, [file, handleFile]);

  // ── Render ──

  return (
    <div>
      {error && (
        <div style={s.error}>
          {error}
          <span onClick={() => dispatch({ type: "SET_ERROR", payload: "" })} style={{ cursor: "pointer", marginLeft: 8, fontWeight: 700 }}>&times;</span>
        </div>
      )}

      {step === "upload" && (
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
          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
            Drop your data file here, or click to browse
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
            Supports .csv, .xlsx, .xls{isBillbackEnabled ? ", .pdf (billbacks)" : ""} &mdash; up to 10MB
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            QuickBooks exports, {t("distributor").toLowerCase()} reports, inventory files, pipeline data
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12 }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: useAI ? "#6B1E1E" : "#9CA3AF" }}>
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
            onChange={onFileSelect}
            style={{ display: "none" }}
          />
        </div>
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
          onBack={reset}
        />
      )}

      {step === "product-sheet-review" && parsed && (
        <ProductSheetReviewStep
          rows={parsed.rows}
          headers={parsed.headers}
          mapping={mapping}
          onConfirm={confirmProductSheetImport}
          onCancel={reset}
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
            onBack={reset}
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

      {step === "done" && (
        <div style={s.doneBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#9989;</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#166534", margin: "0 0 8px" }}>
            Import Complete
          </h3>
          <p style={{ fontSize: 14, color: "#4B5563", marginBottom: 16 }}>{summary}</p>
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
