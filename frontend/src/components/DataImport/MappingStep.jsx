import { getFieldDefs } from "../../utils/semanticMapper";
import { getUserRole } from "../../utils/terminology";
import s from "./styles";

export default function MappingStep({ fileName, headers, rows, mapping, confidence, uploadType, onUpdateMapping, onProceed, onBack }) {
  const sampleRows = rows.slice(0, 3);
  const isQB = uploadType?.type === "quickbooks";

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
              return (
                <tr key={def.field} style={{ borderBottom: "1px solid #E5E0DA" }}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>{def.label}</span>
                    <span style={{ fontSize: 10, color: "#6B6B6B", marginLeft: 6 }}>{def.field}</span>
                  </td>
                  <td style={s.td}>
                    <select
                      value={currentCol || ""}
                      onChange={(e) => onUpdateMapping(def.field, e.target.value)}
                      style={{ ...s.select, borderColor: currentCol ? "#6B1E1E" : "#d1d5db" }}
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
