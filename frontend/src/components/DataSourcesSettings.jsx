/**
 * DataSourcesSettings — categorized upload zones in Settings.
 * Each data type section (Depletion, Revenue, Inventory, Products, Pipeline)
 * has a small upload dropzone that pre-fills a dataTypeHint for DataImport.
 */
import { useState, useRef, useCallback } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import parseFile from "../utils/parseFile";
import { autoDetectMapping } from "../utils/semanticMapper";
import { transformAll, generateSummary } from "../utils/transformData";
import { normalizeRows } from "../utils/normalize.js";
import { logUpload } from "../services/firestoreService";

const DATA_TYPES = [
  {
    key: "depletion",
    label: "Depletion / Sales Data",
    description: "Distributor depletion reports showing cases sold to retail accounts",
    accepts: ".csv,.xlsx,.xls,.tsv",
    icon: "📊",
  },
  {
    key: "revenue",
    label: "Revenue / Internal Sales",
    description: "QuickBooks exports, accounting reports, or internal sales data",
    accepts: ".csv,.xlsx,.xls,.tsv",
    icon: "💰",
  },
  {
    key: "inventory",
    label: "Inventory Data",
    description: "Distributor warehouse inventory — on-hand quantities and days on hand",
    accepts: ".csv,.xlsx,.xls,.tsv",
    icon: "📦",
  },
  {
    key: "product_sheet",
    label: "Product Catalog",
    description: "Your wine/spirits portfolio — product names, SKUs, pricing, tasting notes",
    accepts: ".csv,.xlsx,.xls,.tsv",
    icon: "🍷",
  },
  {
    key: "pipeline",
    label: "Pipeline / Prospects",
    description: "Account pipeline, prospect lists, or CRM exports",
    accepts: ".csv,.xlsx,.xls,.tsv",
    icon: "🎯",
  },
];

export default function DataSourcesSettings() {
  const { importDatasets, userRole, tenantId, useNormalized, tenantConfig, updateTenantConfig } = useData();
  const { currentUser } = useAuth();
  const [uploading, setUploading] = useState(null);
  const [results, setResults] = useState({});

  const handleUpload = useCallback(async (dataType, file) => {
    setUploading(dataType);
    setResults(prev => ({ ...prev, [dataType]: null }));

    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) {
        setResults(prev => ({ ...prev, [dataType]: { error: "File is empty or could not be parsed." } }));
        return;
      }

      const { mapping } = autoDetectMapping(result.headers, result.rows, userRole);
      const typeObj = { type: dataType };
      const transformed = transformAll(result.rows, mapping, typeObj, userRole);
      const summaryText = generateSummary(dataType, transformed, userRole);
      const { type: _t, ...datasets } = transformed;

      let importMeta;
      if (useNormalized) {
        const normalized = normalizeRows(result.rows, mapping);
        importMeta = {
          normalizedRows: normalized,
          fileName: file.name,
          type: dataType,
          mapping,
          uploadedBy: currentUser?.email || "unknown",
        };
      }

      await importDatasets(datasets, summaryText, importMeta);

      if (tenantConfig?.demoData) {
        await updateTenantConfig({ demoData: false });
      }

      if (tenantId) {
        await logUpload(tenantId, {
          fileName: file.name,
          rowCount: result.rows.length,
          type: dataType,
          uploadedBy: currentUser?.email || "unknown",
        });
      }

      setResults(prev => ({
        ...prev,
        [dataType]: { success: true, rows: result.rows.length, summary: summaryText },
      }));
    } catch (err) {
      setResults(prev => ({ ...prev, [dataType]: { error: err.message } }));
    } finally {
      setUploading(null);
    }
  }, [importDatasets, userRole, tenantId, useNormalized, tenantConfig, updateTenantConfig, currentUser]);

  return (
    <>
      <p className="settings-section__description">
        Upload files by data type for the most accurate import. Each section tells the system
        exactly what kind of data you&apos;re uploading.
      </p>
      <div className="data-sources">
        {DATA_TYPES.map((dt) => (
          <DataTypeUploadZone
            key={dt.key}
            dataType={dt}
            uploading={uploading === dt.key}
            result={results[dt.key]}
            onUpload={(file) => handleUpload(dt.key, file)}
          />
        ))}
      </div>
    </>
  );
}

function DataTypeUploadZone({ dataType, uploading, result, onUpload }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onUpload(file);
  };

  const handleSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="data-source-zone">
      <div className="data-source-zone__header">
        <span className="data-source-zone__icon">{dataType.icon}</span>
        <div>
          <div className="data-source-zone__label">{dataType.label}</div>
          <div className="data-source-zone__desc">{dataType.description}</div>
        </div>
      </div>
      <div
        className={`data-source-zone__dropzone${dragOver ? " data-source-zone__dropzone--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {uploading ? (
          <span className="data-source-zone__loading">Processing...</span>
        ) : (
          <span className="data-source-zone__prompt">Drop file or click to upload</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={dataType.accepts}
          onChange={handleSelect}
          style={{ display: "none" }}
        />
      </div>
      {result?.success && (
        <div className="data-source-zone__result data-source-zone__result--success">
          Imported {result.rows.toLocaleString()} rows
        </div>
      )}
      {result?.error && (
        <div className="data-source-zone__result data-source-zone__result--error">
          {result.error}
        </div>
      )}
    </div>
  );
}
