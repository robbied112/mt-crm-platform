/**
 * ExecutiveSummary — displays the AI-generated summary banner
 * at the top of the dashboard after data is imported.
 */
import { useState } from "react";
import { useData } from "../context/DataContext";
import { t } from "../utils/terminology";

export default function ExecutiveSummary() {
  const { summary, availability } = useData();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("data-intel-dismissed") === "true"; } catch { return false; }
  });

  if (!summary || !availability.hasAnyData || dismissed) return null;

  // Build list of missing data types (role-aware)
  const missing = [];
  if (!availability.depletions) missing.push(`${t("depletion")} Data`);
  if (!availability.inventory) missing.push("Inventory Data");
  if (!availability.reorder) missing.push("Purchase History");
  if (!availability.pipeline) missing.push("Pipeline Data");

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("data-intel-dismissed", "true"); } catch {}
  };

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={styles.icon}>&#9889;</span>
          <span style={styles.title}>Data Intelligence</span>
        </div>
        <button
          onClick={handleDismiss}
          title="Dismiss"
          aria-label="Dismiss data intelligence banner"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#6B6B6B", padding: 4, lineHeight: 1, borderRadius: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
      <p style={styles.text}>{summary}</p>
      {missing.length > 0 && missing.length < 4 && (
        <div style={styles.missingRow}>
          <span style={styles.missingLabel}>Unlock more tabs:</span>
          {missing.map((m) => (
            <span key={m} style={styles.missingBadge}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: "linear-gradient(135deg, #FDF8F0 0%, #F5EDE3 100%)",
    border: "1px solid rgba(107, 30, 30, 0.08)",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: "#6B1E1E",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  text: {
    fontSize: 14,
    color: "#2E2E2E",
    lineHeight: 1.6,
    margin: 0,
  },
  missingRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  missingLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6B6B6B",
  },
  missingBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    background: "rgba(192, 123, 1, 0.08)",
    color: "#C07B01",
    borderRadius: 10,
  },
};
