/**
 * PipelineSummary component
 * Extracted from index.html renderMyTerritory() pipeline table (lines 3533-3550).
 * Shows top pipeline deals in a compact table.
 */

const STAGE_COLORS = {
  Identified: "#6B6B6B",
  "Outreach Sent": "#8B6A4C",
  "Meeting Set": "#8B6A4C",
  "RFP/Proposal": "#C07B01",
  Negotiation: "#B87333",
  "Closed Won": "#1F865A",
  "Closed Lost": "#C53030",
};

export default function PipelineSummary({ deals = [] }) {
  if (deals.length === 0) return null;

  return (
    <div
      style={{
        background: "#F5EDE3",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>
        My Pipeline
      </h3>
      <table
        style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #d1d5db" }}>
            <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600 }}>
              Account
            </th>
            <th
              style={{ textAlign: "center", padding: "6px 0", fontWeight: 600 }}
            >
              Stage
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 0", fontWeight: 600 }}
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.slice(0, 8).map((deal, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #E5E0DA" }}>
              <td style={{ padding: "8px 0", fontWeight: 600 }}>
                {deal.acct}
              </td>
              <td style={{ textAlign: "center", padding: "8px 0" }}>
                <span
                  style={{
                    background: STAGE_COLORS[deal.stage] || "#6B6B6B",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {deal.stage}
                </span>
              </td>
              <td style={{ textAlign: "right", padding: "8px 0" }}>
                ${(deal.estValue || 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
