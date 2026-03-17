import s from "./styles";

const CONFIDENCE_CONFIG = {
  high: { label: "High Confidence", bg: "#d1f5e8", color: "#059669" },
  medium: { label: "Medium Confidence", bg: "#fef3c7", color: "#d97706" },
  low: { label: "Low Confidence", bg: "#fee2e2", color: "#dc2626" },
};

const REPORT_TYPE_LABELS = {
  distributor_velocity: "Distributor Velocity",
  quickbooks_revenue: "QuickBooks Revenue",
  inventory_health: "Inventory Health",
  lost_placements: "Lost Placements",
  new_placements: "New Placements",
  period_comparison: "Period Comparison",
  product_catalog: "Product Catalog",
  ar_aging: "AR Aging",
  ap_aging: "AP Aging",
  depletion: "Depletion Report",
  invoice: "Invoice / Sales",
  inventory: "Inventory",
  billback: "Billback",
  pipeline: "Pipeline",
  product_sheet: "Product Sheet",
  unknown: "Unknown Report Type",
};

const DASHBOARD_LABELS = {
  salesByAccount: "Account Insights",
  depletionByWine: "Depletion by Wine",
  salesByRep: "Sales by Rep",
  pipeline: "Pipeline",
  billbacks: "Trade Spend / Billbacks",
  inventory: "Inventory",
  executiveDashboard: "Executive Dashboard",
  revenueAndSales: "Revenue & Sales",
  // Keys returned by comprehendReport AI (must match comprehend.js prompt)
  depletions: "Depletions",
  distributorScorecard: "Distributor Scorecard",
  inventoryHealth: "Inventory Health",
  placementTracker: "Placement Tracker",
  revenueAnalysis: "Revenue Analysis",
  arAging: "AR Aging",
  apAging: "AP Aging",
  productCatalog: "Product Catalog",
};

export default function ReportAnalysisCard({ analysis, fileName, onRetry }) {
  if (!analysis) return null;

  // Error state with smart recovery messages (TODO-096)
  if (analysis.error) {
    const errorTitle = analysis.errorType === "rate_limited"
      ? "Too Many Requests"
      : analysis.errorType === "api_failure"
      ? "AI Service Unavailable"
      : analysis.errorType === "no_tool_use"
      ? "Could Not Analyze File"
      : "Report Analysis Failed";

    const suggestion = analysis.suggestion
      || "The AI couldn't understand this file structure. Try exporting as CSV or simplifying the layout.";

    return (
      <div style={{
        border: "1px solid #fca5a5",
        borderRadius: 10,
        padding: 20,
        background: "#fef2f2",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#dc2626", marginBottom: 4 }}>
              {errorTitle}
            </div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>
              {suggestion}
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
              Using rule-based column mapping as fallback.
            </div>
          </div>
          {onRetry && (
            <button
              className="btn btn-secondary"
              onClick={onRetry}
              style={{ marginLeft: 16, flexShrink: 0 }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const confidenceLevel = analysis.confidence >= 0.8 ? "high"
    : analysis.confidence >= 0.5 ? "medium"
    : "low";
  const confConfig = CONFIDENCE_CONFIG[confidenceLevel];

  const reportTypeLabel = REPORT_TYPE_LABELS[analysis.reportType] || analysis.reportType || "Unknown";

  const populatesDashboards = analysis.dashboardTargets || analysis.populatesDashboards || [];
  const spec = analysis.extractionSpec || {};

  return (
    <div style={{
      border: "1px solid rgba(107, 30, 30, 0.15)",
      borderRadius: 10,
      background: "linear-gradient(135deg, #FDF8F0 0%, #F5EDE3 100%)",
      marginBottom: 16,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(107, 30, 30, 0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>&#128202;</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>What I Found</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{fileName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            ...s.typeBadge,
            marginLeft: 0,
          }}>
            {reportTypeLabel}
          </span>
          <span style={{
            ...s.confBadge,
            background: confConfig.bg,
            color: confConfig.color,
          }}>
            {confConfig.label}
          </span>
        </div>
      </div>

      {/* Summary */}
      {(analysis.humanSummary || analysis.summary) && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(107, 30, 30, 0.06)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            {analysis.humanSummary || analysis.summary}
          </p>
        </div>
      )}

      {/* Extraction spec details */}
      {(spec.headerRow != null || spec.dataStartRow != null || spec.pivotDetected != null || spec.sheets?.length > 0) && (
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid rgba(107, 30, 30, 0.06)",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}>
          {spec.headerRow != null && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Header row:</span> {spec.headerRow + 1}
            </div>
          )}
          {spec.dataStartRow != null && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Data starts:</span> row {spec.dataStartRow + 1}
            </div>
          )}
          {spec.pivotDetected != null && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Pivot table:</span> {spec.pivotDetected ? "Yes" : "No"}
            </div>
          )}
          {spec.sheets?.length > 0 && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Sheets:</span> {spec.sheets.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Populates dashboards */}
      {populatesDashboards.length > 0 && (
        <div style={{ padding: "10px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 6 }}>
            What this data will populate
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {populatesDashboards.map((key) => (
              <span key={key} style={{
                padding: "3px 10px",
                background: "#fff",
                border: "1px solid rgba(107, 30, 30, 0.15)",
                borderRadius: 20,
                fontSize: 12,
                color: "#6B1E1E",
                fontWeight: 500,
              }}>
                {DASHBOARD_LABELS[key] || key}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
