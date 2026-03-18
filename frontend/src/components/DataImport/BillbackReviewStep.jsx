import s from "./styles";

export default function BillbackReviewStep({ fileName, items, metadata, saving, onUpdateItem, onDeleteItem, onConfirm, onBack }) {
  const totalAmount = items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

  return (
    <div>
      <div style={s.stepHeader}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Review Billback Extraction</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B6B6B" }}>
            {fileName} &mdash; {items.length} line items &mdash; ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
            <span style={s.typeBadge}>Billback PDF</span>
          </p>
          {metadata?.distributor && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B6B6B" }}>
              Distributor: {metadata.distributor}
              {metadata.invoiceNo ? ` | Invoice: ${metadata.invoiceNo}` : ""}
              {metadata.date ? ` | Date: ${metadata.date}` : ""}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack} disabled={saving}>Back</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={saving || items.length === 0}>
            {saving ? "Saving..." : `Confirm & Import (${items.length})`}
          </button>
        </div>
      </div>

      <div style={{ background: "rgba(139, 106, 76, 0.08)", border: "1px solid rgba(139, 106, 76, 0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8B6A4C", marginBottom: 16 }}>
        AI extracted these line items from your PDF. Review and edit before importing.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#FDF8F0" }}>
              <th style={s.th}>Wine</th>
              <th style={s.th}>Producer</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Cases</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Date</th>
              <th style={{ ...s.th, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #E5E0DA" }}>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.wine || ""}
                    onChange={(e) => onUpdateItem(idx, "wine", e.target.value)}
                    style={{ ...s.editInput, minWidth: 160 }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.producer || ""}
                    onChange={(e) => onUpdateItem(idx, "producer", e.target.value)}
                    style={{ ...s.editInput, minWidth: 120 }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.amount ?? ""}
                    onChange={(e) => onUpdateItem(idx, "amount", e.target.value)}
                    style={{ ...s.editInput, width: 80, textAlign: "right" }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.qty ?? ""}
                    onChange={(e) => onUpdateItem(idx, "qty", e.target.value)}
                    style={{ ...s.editInput, width: 60, textAlign: "right" }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.type || ""}
                    onChange={(e) => onUpdateItem(idx, "type", e.target.value)}
                    style={{ ...s.editInput, minWidth: 100 }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    type="text"
                    value={item.date || ""}
                    onChange={(e) => onUpdateItem(idx, "date", e.target.value)}
                    style={{ ...s.editInput, width: 100 }}
                  />
                </td>
                <td style={s.td}>
                  <button
                    onClick={() => onDeleteItem(idx)}
                    style={{ background: "none", border: "none", color: "#C53030", cursor: "pointer", fontSize: 16, padding: 4 }}
                    title="Remove row"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
