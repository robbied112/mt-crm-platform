/**
 * DataFreshnessBadge — shows how fresh a dataset is.
 * Displays "Updated Xh ago", "3 days old", or "Stale" with color coding.
 */

export default function DataFreshnessBadge({ lastUpdated, variant = "compact" }) {
  if (!lastUpdated) return null;

  const now = Date.now();
  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : lastUpdated;
  const diffMs = now - ts;
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let label;
  let status;

  if (diffDays < 1) {
    label = diffHours < 1 ? "Just now" : `${diffHours}h ago`;
    status = "fresh";
  } else if (diffDays <= 3) {
    label = `${diffDays}d ago`;
    status = "fresh";
  } else if (diffDays <= 7) {
    label = `${diffDays}d old`;
    status = "aging";
  } else {
    label = `${diffDays}d old`;
    status = "stale";
  }

  if (variant === "dot") {
    const colors = { fresh: "#1F865A", aging: "#C07B01", stale: "#C53030" };
    return (
      <span
        className="freshness-dot"
        style={{ background: colors[status] }}
        title={`Data ${label}`}
      />
    );
  }

  return (
    <span className={`freshness-badge freshness-badge--${status}`} title={`Last updated ${label}`}>
      <span className="freshness-dot" style={{
        background: status === "fresh" ? "#1F865A" : status === "aging" ? "#C07B01" : "#C53030",
      }} />
      {label}
    </span>
  );
}
