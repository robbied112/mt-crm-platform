/**
 * DataImport — full import flow with drag-drop, semantic mapping,
 * format detection, preview, and Firestore persistence.
 */
import { useState, useRef, useCallback } from "react";
import { useData } from "../context/DataContext";
import parseFile from "../utils/parseFile";
import { autoDetectMapping, detectUploadType, getFieldDefs } from "../utils/semanticMapper";
import { getUserRole, t } from "../utils/terminology";
import { aiAutoDetectMapping } from "../utils/aiMapper";
import { transformAll, generateSummary } from "../utils/transformData";
import { logUpload } from "../services/firestoreService";
import { useAuth } from "../context/AuthContext";

const STEPS = ["upload", "mapping", "preview", "done"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DataImport() {
  const { importDatasets, userRole, tenantId } = useData();
  const { currentUser } = useAuth();
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);       // { headers, rows }
  const [mapping, setMapping] = useState({});
  const [confidence, setConfidence] = useState({});
  const [uploadType, setUploadType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef();

  // ── Step 1: File Drop / Select ──

  const handleFile = useCallback(async (f) => {
    setError("");
    if (f.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
      return;
    }
    if (f.size === 0) {
      setError("File is empty.");
      return;
    }
    setFile(f);
    try {
      const result = await parseFile(f);
      if (result.rows.length === 0) {
        setError("File is empty or could not be parsed.");
        return;
      }
      setParsed(result);

      let autoMap, conf;

      // Try AI mapper first, fall back to rule-based
      if (useAI) {
        setAiLoading(true);
        try {
          const aiResult = await aiAutoDetectMapping(result.headers, result.rows);
          autoMap = aiResult.mapping;
          conf = aiResult.confidence;
        } catch {
          // AI failed, fall back
          const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
          autoMap = ruleResult.mapping;
          conf = ruleResult.confidence;
        } finally {
          setAiLoading(false);
        }
      } else {
        const ruleResult = autoDetectMapping(result.headers, result.rows, userRole);
        autoMap = ruleResult.mapping;
        conf = ruleResult.confidence;
      }

      setMapping(autoMap);
      setConfidence(conf);

      // Detect type
      const type = detectUploadType(result.headers, result.rows, autoMap);
      setUploadType(type);

      setStep("mapping");
    } catch (err) {
      setError(err.message);
    }
  }, [useAI]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Step 2: Update mapping ──

  const updateMapping = (field, column) => {
    setMapping((m) => ({ ...m, [field]: column || undefined }));
  };

  const proceedToPreview = () => {
    try {
      const result = transformAll(parsed.rows, mapping, uploadType, userRole);
      setPreview(result);
      const summaryText = generateSummary(result.type || uploadType.type, result, userRole);
      setSummary(summaryText);
      setStep("preview");
    } catch (err) {
      setError(`Transform error: ${err.message}`);
    }
  };

  // ── Step 3: Confirm & Save ──

  const confirmImport = async () => {
    setSaving(true);
    setError("");
    try {
      const { type, ...datasets } = preview;
      await importDatasets(datasets, summary);
      await logUpload(tenantId, {
        fileName: file.name,
        rowCount: parsed.rows.length,
        type: uploadType.type,
        uploadedBy: currentUser?.email || "unknown",
      });
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──
  const reset = () => {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setMapping({});
    setConfidence({});
    setUploadType(null);
    setPreview(null);
    setSummary("");
    setError("");
  };

  // ── Render ──

  return (
    <div>
      {error && (
        <div style={s.error}>
          {error}
          <span onClick={() => setError("")} style={{ cursor: "pointer", marginLeft: 8, fontWeight: 700 }}>&times;</span>
        </div>
      )}

      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            ...s.dropZone,
            borderColor: dragOver ? "#0f766e" : "#D1D5DB",
            background: dragOver ? "#f0fdfa" : "#fafafa",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#128202;</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
            Drop your data file here, or click to browse
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
            Supports .csv, .xlsx, .xls &mdash; up to 10MB
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            QuickBooks exports, {t("distributor").toLowerCase()} reports, inventory files, pipeline data
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12 }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: useAI ? "#0f766e" : "#9CA3AF" }}>
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                style={{ accentColor: "#0f766e" }}
              />
              AI-Powered Mapping
            </label>
            {useAI && <span style={{ color: "#0f766e", fontSize: 10 }}>(Claude)</span>}
          </div>
          {aiLoading && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#0f766e", fontWeight: 600 }}>
              AI is analyzing your data...
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            onChange={onFileSelect}
            style={{ display: "none" }}
          />
        </div>
      )}

      {step === "mapping" && parsed && (
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
      )}

      {step === "preview" && preview && (
        <PreviewStep
          summary={summary}
          preview={preview}
          uploadType={uploadType}
          saving={saving}
          onConfirm={confirmImport}
          onBack={() => setStep("mapping")}
        />
      )}

      {step === "done" && (
        <div style={s.doneBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#9989;</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#166534", margin: "0 0 8px" }}>
            Import Complete
          </h3>
          <p style={{ fontSize: 14, color: "#4B5563", marginBottom: 16 }}>{summary}</p>
          <button className="btn btn-primary" onClick={reset}>
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mapping Step Sub-Component ─────────────────────────────────

function MappingStep({ fileName, headers, rows, mapping, confidence, uploadType, onUpdateMapping, onProceed, onBack }) {
  const sampleRows = rows.slice(0, 3);
  const isQB = uploadType?.type === "quickbooks";

  return (
    <div>
      <div style={s.stepHeader}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Column Mapping</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
            {fileName} &mdash; {rows.length} rows
            {isQB && <span style={s.qbBadge}>QuickBooks Detected</span>}
            {!isQB && uploadType?.type && (
              <span style={s.typeBadge}>{uploadType.type}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button className="btn btn-primary" onClick={onProceed}>Preview &amp; Import</button>
        </div>
      </div>

      {isQB && (
        <div style={s.qbNotice}>
          QuickBooks format detected. Column mapping has been optimized for QB exports.
          Account Insights and Pipeline will be prioritized.
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f0fdfa" }}>
              <th style={s.th}>Internal Field</th>
              <th style={s.th}>Mapped To</th>
              <th style={s.th}>Confidence</th>
              <th style={s.th}>Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {getFieldDefs(getUserRole()).map((def) => {
              const currentCol = mapping[def.field];
              const conf = confidence[def.field] || 0;
              const samples = currentCol
                ? sampleRows.map((r) => r[currentCol]).filter(Boolean).join(", ")
                : "";
              return (
                <tr key={def.field} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>{def.label}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 6 }}>{def.field}</span>
                  </td>
                  <td style={s.td}>
                    <select
                      value={currentCol || ""}
                      onChange={(e) => onUpdateMapping(def.field, e.target.value)}
                      style={{ ...s.select, borderColor: currentCol ? "#0f766e" : "#d1d5db" }}
                    >
                      <option value="">-- Not mapped --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td style={s.td}>
                    {currentCol && (
                      <span style={{
                        ...s.confBadge,
                        background: conf >= 0.8 ? "#d1f5e8" : conf >= 0.5 ? "#fef3c7" : "#fee2e2",
                        color: conf >= 0.8 ? "#059669" : conf >= 0.5 ? "#d97706" : "#dc2626",
                      }}>
                        {Math.round(conf * 100)}%
                      </span>
                    )}
                  </td>
                  <td style={{ ...s.td, fontSize: 12, color: "#6B7280", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {samples || <span style={{ color: "#d1d5db" }}>--</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Preview Step Sub-Component ─────────────────────────────────

function PreviewStep({ summary, preview, uploadType, saving, onConfirm, onBack }) {
  const datasets = Object.entries(preview).filter(([k, v]) =>
    k !== "type" && ((Array.isArray(v) && v.length > 0) || (!Array.isArray(v) && Object.keys(v).length > 0))
  );

  return (
    <div>
      <div style={s.stepHeader}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Preview Import</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack} disabled={saving}>Back</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={saving}>
            {saving ? "Saving..." : "Confirm & Import"}
          </button>
        </div>
      </div>

      {/* Executive Summary Preview */}
      <div style={s.summaryBox}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f766e", marginBottom: 6 }}>
          Executive Summary
        </div>
        <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{summary}</p>
      </div>

      {/* Dataset counts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {datasets.map(([name, items]) => {
          const count = Array.isArray(items) ? items.length : Object.keys(items).length;
          return (
            <div key={name} style={s.previewCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0f766e" }}>{count}</div>
              <div style={{ fontSize: 11, color: "#6B7280", textTransform: "capitalize" }}>
                {name.replace(/([A-Z])/g, " $1").trim()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sample rows from first dataset */}
      {datasets.length > 0 && Array.isArray(datasets[0][1]) && datasets[0][1].length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            Sample: {datasets[0][0]} (first 5 rows)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f0fdfa" }}>
                {Object.keys(datasets[0][1][0]).filter((k) => k !== "skus" && k !== "weeks" && k !== "months").slice(0, 8).map((k) => (
                  <th key={k} style={s.th}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasets[0][1].slice(0, 5).map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {Object.entries(row).filter(([k]) => k !== "skus" && k !== "weeks" && k !== "months").slice(0, 8).map(([k, v], j) => (
                    <td key={j} style={s.td}>
                      {typeof v === "number" ? v.toLocaleString() : String(v).slice(0, 30)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = {
  dropZone: {
    border: "2px dashed #D1D5DB",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  th: {
    padding: "8px 10px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    color: "#6B7280",
    letterSpacing: "0.3px",
  },
  td: {
    padding: "8px 10px",
  },
  select: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    minWidth: 180,
    background: "#fff",
  },
  confBadge: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  qbBadge: {
    display: "inline-block",
    marginLeft: 8,
    padding: "2px 8px",
    background: "#dbeafe",
    color: "#1e40af",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  typeBadge: {
    display: "inline-block",
    marginLeft: 8,
    padding: "2px 8px",
    background: "#f0fdfa",
    color: "#0f766e",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  qbNotice: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#1e40af",
    marginBottom: 16,
  },
  summaryBox: {
    background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
    border: "1px solid #99f6e4",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  previewCard: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: "12px 14px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  doneBox: {
    textAlign: "center",
    padding: 40,
    background: "#f0fdf4",
    borderRadius: 12,
    border: "1px solid #bbf7d0",
  },
};
