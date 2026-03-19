import { useMemo } from "react";
import { getFieldDefs } from "../../utils/semanticMapper";
import { getUserRole } from "../../utils/terminology";
import s from "./styles";

/**
 * Critical fields per upload type — if these are unmapped, the dashboard
 * will show broken/empty data. We warn the user and block auto-confirm.
 */
const CRITICAL_FIELDS = {
  depletion: {
    required: [
      { field: "qty", label: "Quantity / Volume", impact: "All volume and trend calculations will be zero" },
    ],
    important: [
      { field: "dist", label: "Distributor", impact: "All distributors will show as 'Unknown'" },
      { field: "sku", label: "Product / SKU", impact: "SKU breakdown chart will be empty" },
      { field: "st", label: "State", impact: "Market filtering won't work" },
    ],
  },
  sales: {
    required: [
      { field: "qty", label: "Quantity / Volume", impact: "Volume calculations will be zero" },
    ],
    important: [
      { field: "acct", label: "Account Name", impact: "Account insights won't populate" },
    ],
  },
  purchases: {
    required: [
      { field: "acct", label: "Account Name", impact: "Reorder data won't populate" },
      { field: "qty", label: "Quantity", impact: "Volume calculations will be zero" },
    ],
    important: [
      { field: "date", label: "Date", impact: "Reorder cycle calculations won't work" },
    ],
  },
  inventory: {
    required: [
      { field: "oh", label: "On Hand", impact: "Inventory data won't populate" },
    ],
    important: [
      { field: "st", label: "State", impact: "State-level breakdown won't work" },
    ],
  },
};

function getMissingFields(mapping, uploadType) {
  const type = uploadType?.type;
  const critical = CRITICAL_FIELDS[type];
  if (!critical) return { required: [], important: [] };

  const missingRequired = critical.required.filter((f) => !mapping[f.field]);
  const missingImportant = critical.important.filter((f) => !mapping[f.field]);
  return { required: missingRequired, important: missingImportant };
}

export default function MappingStep({ fileName, headers, rows, mapping, confidence, uploadType, onUpdateMapping, onProceed, onBack }) {
  const sampleRows = rows.slice(0, 3);
  const isQB = uploadType?.type === "quickbooks";

  const { required: missingRequired, important: missingImportant } = useMemo(
    () => getMissingFields(mapping, uploadType),
    [mapping, uploadType]
  );

  const hasCriticalIssues = missingRequired.length > 0;
  const hasWarnings = missingImportant.length > 0;

  // Get unmapped columns for suggestions (flatten arrays like _monthColumns)
  const mappedCols = new Set(
    Object.entries(mapping)
      .filter(([k]) => !k.startsWith("_"))
      .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
      .filter(Boolean)
  );
  const unmappedCols = headers.filter((h) => !mappedCols.has(h));

  return (
    <div>
      <div style={s.stepHeader}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Column Mapping</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B6B6B" }}>
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

      {/* Critical field warnings */}
      {(hasCriticalIssues || hasWarnings) && (
        <div style={{
          margin: "12px 0",
          padding: "12px 16px",
          borderRadius: 8,
          border: hasCriticalIssues ? "1px solid #C53030" : "1px solid #D97706",
          background: hasCriticalIssues ? "rgba(197, 48, 48, 0.06)" : "rgba(217, 119, 6, 0.06)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: hasCriticalIssues ? "#C53030" : "#D97706", marginBottom: 8 }}>
            {hasCriticalIssues ? "Missing critical fields" : "Missing recommended fields"}
          </div>
          {missingRequired.map((f) => (
            <div key={f.field} style={{ fontSize: 12, color: "#C53030", marginBottom: 4 }}>
              <strong>{f.label}</strong> is not mapped &mdash; {f.impact}
            </div>
          ))}
          {missingImportant.map((f) => (
            <div key={f.field} style={{ fontSize: 12, color: "#D97706", marginBottom: 4 }}>
              <strong>{f.label}</strong> is not mapped &mdash; {f.impact}
            </div>
          ))}
          {unmappedCols.length > 0 && (
            <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 8 }}>
              Unmapped columns in your file: <strong>{unmappedCols.slice(0, 8).join(", ")}</strong>
              {unmappedCols.length > 8 && ` (+${unmappedCols.length - 8} more)`}
              . Check if any of these should be mapped to the fields above.
            </div>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#FDF8F0" }}>
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
              const isMissingCritical = missingRequired.some((f) => f.field === def.field);
              const isMissingImportant = missingImportant.some((f) => f.field === def.field);
              return (
                <tr key={def.field} style={{
                  borderBottom: "1px solid #E5E0DA",
                  background: isMissingCritical ? "rgba(197, 48, 48, 0.04)" : isMissingImportant ? "rgba(217, 119, 6, 0.03)" : undefined,
                }}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>{def.label}</span>
                    <span style={{ fontSize: 10, color: "#6B6B6B", marginLeft: 6 }}>{def.field}</span>
                    {isMissingCritical && <span style={{ fontSize: 10, color: "#C53030", marginLeft: 6 }}>required</span>}
                    {isMissingImportant && <span style={{ fontSize: 10, color: "#D97706", marginLeft: 6 }}>recommended</span>}
                  </td>
                  <td style={s.td}>
                    <select
                      value={currentCol || ""}
                      onChange={(e) => onUpdateMapping(def.field, e.target.value)}
                      style={{
                        ...s.select,
                        borderColor: isMissingCritical ? "#C53030" : isMissingImportant ? "#D97706" : currentCol ? "#6B1E1E" : "#d1d5db",
                      }}
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
                        background: conf >= 0.8 ? "rgba(31, 134, 90, 0.1)" : conf >= 0.5 ? "rgba(192, 123, 1, 0.08)" : "rgba(197, 48, 48, 0.08)",
                        color: conf >= 0.8 ? "#1F865A" : conf >= 0.5 ? "#C07B01" : "#C53030",
                      }}>
                        {Math.round(conf * 100)}%
                      </span>
                    )}
                  </td>
                  <td style={{ ...s.td, fontSize: 12, color: "#6B6B6B", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
