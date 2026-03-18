/**
 * HealthInventoryTable component
 * Extracted from index.html renderDistributorHealth() inventory table (lines 4128-4155).
 * Shows sell-in vs sell-through by product with inventory actions.
 */

const ACTION_STYLES = {
  "Reorder Now": { bg: "rgba(197, 48, 48, 0.08)", color: "#C53030" },
  Monitor: { bg: "rgba(192, 123, 1, 0.08)", color: "#C07B01" },
  Healthy: { bg: "rgba(31, 134, 90, 0.08)", color: "#1F865A" },
  Reduce: { bg: "rgba(139, 106, 76, 0.1)", color: "#8B6A4C" },
};

function getRatioColor(ratio) {
  if (ratio >= 80) return "#1F865A";
  if (ratio >= 50) return "#C07B01";
  return "#C53030";
}

function getSupplyInfo(wkSupply) {
  if (wkSupply > 26) return { label: "Overstocked", color: "#B87333" };
  if (wkSupply >= 8) return { label: "Healthy", color: "#1F865A" };
  if (wkSupply > 0) return { label: "Reorder Soon", color: "#C53030" };
  return { label: "-", color: "#6B6B6B" };
}

export default function HealthInventoryTable({ skus = [], totalSellIn, totalSellThru, totalRatio, totalOH, doh }) {
  return (
    <div className="table-container" style={{ marginTop: 16 }}>
      <div className="table-header">
        <div className="table-title">Inventory Coverage by Product</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Sell-In (4M CE)</th>
            <th>Sell-Through (13W CE)</th>
            <th>Pull-Through %</th>
            <th>On Hand (CE)</th>
            <th>Weeks Supply</th>
            <th>Inventory Action</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((s, i) => {
            const supply = getSupplyInfo(s.wkSupply);
            const actionStyle = ACTION_STYLES[s.invAction] || { bg: "#F5EDE3", color: "#6B6B6B" };

            return (
              <tr key={i}>
                <td>{s.w}</td>
                <td>{(s.sellIn || 0).toFixed(1)}</td>
                <td>{(s.sellThru || 0).toFixed(1)}</td>
                <td style={{ color: getRatioColor(s.ratio), fontWeight: 600 }}>
                  {s.ratio}%
                </td>
                <td>{(s.oh || 0).toFixed(1)}</td>
                <td>
                  <span style={{ color: supply.color, fontWeight: 500 }}>
                    {(s.wkSupply || 0).toFixed(1)} wks
                  </span>{" "}
                  <span style={{ fontSize: 10, color: supply.color }}>
                    ({supply.label})
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: actionStyle.bg,
                      color: actionStyle.color,
                    }}
                  >
                    {s.invAction || "--"}
                  </span>
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          <tr style={{ fontWeight: 700, borderTop: "2px solid #2E2E2E" }}>
            <td>Total</td>
            <td>{(totalSellIn || 0).toFixed(1)}</td>
            <td>{(totalSellThru || 0).toFixed(1)}</td>
            <td
              style={{
                color: (totalRatio || 0) >= 80 ? "#1F865A" : "#C07B01",
                fontWeight: 700,
              }}
            >
              {totalRatio || 0}%
            </td>
            <td>{(totalOH || 0).toFixed(1)}</td>
            <td>{doh || 0} days on hand</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
