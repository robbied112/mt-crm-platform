import s from "./styles";

export default function PreviewStep({ summary, preview, uploadType, saving, onConfirm, onBack }) {
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "#6B1E1E", marginBottom: 6 }}>
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
              <div style={{ fontSize: 20, fontWeight: 700, color: "#6B1E1E" }}>{count}</div>
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
              <tr style={{ background: "#FDF8F0" }}>
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
