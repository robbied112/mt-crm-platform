/**
 * WarehousePanel component
 * Extracted from index.html renderWarehousePanel() (lines 4393-4445).
 * Shows company warehouse inventory broken out by product line.
 */

import TENANT_CONFIG from "../config/tenant";

export default function WarehousePanel({ warehouseInventory }) {
  if (!warehouseInventory) return null;

  const wh = warehouseInventory;
  const ct = (wh.classic || {})["Warehouse Total"] || {};
  const nt = (wh.contemporary || {})["Warehouse Total"] || {};
  const gt = wh.grandTotal || {};

  // Detect product columns from data or use defaults
  const sampleRow =
    Object.values(wh.classic || wh.contemporary || {})[0] || {};
  const detectedKeys = Object.keys(sampleRow).filter(
    (k) => k !== "total" && typeof sampleRow[k] === "number"
  );
  const defaultKeys = ["sw", "sr", "rd", "spw", "spr"];
  const wines = detectedKeys.length > 0 ? detectedKeys : defaultKeys;

  // Map short codes to catalog names
  const catalogNames = {};
  (TENANT_CONFIG.productCatalog || []).forEach((p) => {
    if (p.shortCode) catalogNames[p.shortCode] = p.name;
  });
  const productNames = wines.map((w) => catalogNames[w] || w.toUpperCase());
  const line1Name = (TENANT_CONFIG.productLines || [])[0] || "Line 1";
  const line2Name = (TENANT_CONFIG.productLines || [])[1] || "Line 2";

  function renderLineTable(lineData, lineName, badgeBg, badgeColor) {
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: badgeBg,
              color: badgeColor,
              marginRight: 6,
            }}
          >
            {lineName}
          </span>
        </div>
        <table
          style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>
                Location
              </th>
              {productNames.map((w) => (
                <th key={w} style={{ textAlign: "right", padding: "4px 6px" }}>
                  {w}
                </th>
              ))}
              <th
                style={{
                  textAlign: "right",
                  padding: "4px 6px",
                  fontWeight: 700,
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(lineData || {}).map(([loc, vals]) => {
              const isBold =
                loc === "Warehouse Total" || loc === "Zephyr Total";
              return (
                <tr
                  key={loc}
                  style={
                    isBold
                      ? {
                          fontWeight: 700,
                          borderTop: "1px solid #E5E0DA",
                        }
                      : undefined
                  }
                >
                  <td style={{ padding: "3px 6px" }}>{loc}</td>
                  {wines.map((w) => (
                    <td
                      key={w}
                      style={{ textAlign: "right", padding: "3px 6px" }}
                    >
                      {(vals[w] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td
                    style={{
                      textAlign: "right",
                      padding: "3px 6px",
                      fontWeight: 600,
                    }}
                  >
                    {(vals.total || 0).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ marginBottom: 20 }}>
      <div className="table-header">
        <div className="table-title">
          Company Warehouse Inventory (by Product Line)
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {renderLineTable(wh.classic, line1Name, "rgba(184, 115, 51, 0.08)", "#B87333")}
        {renderLineTable(wh.contemporary, line2Name, "rgba(139, 106, 76, 0.15)", "#8B6A4C")}
      </div>

      {/* Grand total summary */}
      <div
        style={{
          marginTop: 12,
          padding: "8px 12px",
          background: "#f9fafb",
          borderRadius: 6,
          display: "flex",
          gap: 24,
          fontSize: 13,
        }}
      >
        <span>
          <strong>Grand Total:</strong> {(gt.total || 0).toLocaleString()} cases
        </span>
        <span>
          {line1Name}: {(ct.total || 0).toLocaleString()}
        </span>
        <span>
          {line2Name}: {(nt.total || 0).toLocaleString()}
        </span>
        {wh.batch4Est && wh.batch4Est.total > 0 && (
          <span style={{ color: "#6B6B6B" }}>
            Batch 4 Est: +{wh.batch4Est.total.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
