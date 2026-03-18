import { useState } from "react";
import { useData } from "../context/DataContext";

export default function DemoBanner({ onGoToSettings, onClearDemo }) {
  const { tenantConfig } = useData();
  const [clearing, setClearing] = useState(false);

  if (!tenantConfig?.demoData) return null;

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearDemo();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <span style={styles.message}>
          You're viewing sample data. Upload your own data to replace it.
        </span>
        <div style={styles.actions}>
          <button
            className="btn btn-primary"
            style={styles.uploadBtn}
            onClick={onGoToSettings}
          >
            Upload Data
          </button>
          <button
            style={styles.clearBtn}
            onClick={handleClear}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Clear Demo Data"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    background: "rgba(192, 123, 1, 0.08)",
    border: "1px solid rgba(192, 123, 1, 0.2)",
    borderRadius: 7,
    padding: "12px 20px",
    marginBottom: 16,
  },
  content: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  message: {
    fontSize: 14,
    color: "#C07B01",
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  uploadBtn: {
    padding: "6px 16px",
    fontSize: 13,
  },
  clearBtn: {
    background: "transparent",
    border: "1px solid #C07B01",
    borderRadius: 6,
    color: "#C07B01",
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
