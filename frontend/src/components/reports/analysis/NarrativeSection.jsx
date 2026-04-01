/**
 * NarrativeSection — renders AI narrative with visual weight.
 *
 * Parses **bold** markers, metric pills (+47%, -12%, 38 DOH),
 * and displays a hook line + body paragraphs + timestamp.
 */

/**
 * Parse a text segment into React elements with bold and metric pill formatting.
 *
 * 1. Split by **...** for bold markers
 * 2. Within each segment, find metric patterns and wrap in pill spans
 */
function parseNarrative(text) {
  if (!text) return text;

  // Split on **...** markers
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

  return boldParts.map((part, i) => {
    // Bold segment
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return <strong key={i}>{inner}</strong>;
    }

    // Plain text — scan for metric patterns
    return parseMetrics(part, i);
  });
}

/**
 * Find metric patterns like +47%, -12%, 38 DOH, 1,200 cases
 * and wrap them in colored pill spans.
 */
function parseMetrics(text, keyPrefix) {
  // Two patterns:
  // 1. Any number + % or DOH (always pillify — these are unambiguous metrics)
  // 2. Sign-prefixed or comma-formatted numbers + unit words (avoids bare "3 accounts")
  const metricRegex = /([+-]?\d[\d,]*\.?\d*)\s*(%|DOH\b)|([+-]\d[\d,]*\.?\d*|\d{1,3}(?:,\d{3})+)\s*(cases?\b|units?\b|pts\b|points\b|placements\b|accounts\b)/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = metricRegex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const numberPart = match[1] || match[3] || "";
    const isNegative = numberPart.startsWith("-");
    const isPositive = numberPart.startsWith("+");

    let pillClass = "metric-pill metric-pill--neutral";
    let label = "metric";
    if (isNegative) {
      pillClass = "metric-pill metric-pill--negative";
      label = "negative change";
    } else if (isPositive) {
      pillClass = "metric-pill metric-pill--positive";
      label = "positive change";
    }

    parts.push(
      <span key={`${keyPrefix}-m-${match.index}`} className={pillClass} aria-label={`${fullMatch}, ${label}`}>
        {fullMatch}
      </span>
    );

    lastIndex = match.index + fullMatch.length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no metrics found, return plain text
  if (parts.length === 0) return text;

  return parts.length === 1 && typeof parts[0] === "string"
    ? parts[0]
    : parts.map((p, i) => (typeof p === "string" ? <span key={`${keyPrefix}-t-${i}`}>{p}</span> : p));
}

/**
 * Format a Firestore timestamp or Date into relative time string.
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return null;

  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NarrativeSection({ narrative, updatedAt }) {
  if (!narrative?.segments?.length) {
    return (
      <div className="narrative-section narrative-section--empty" aria-live="polite">
        <p className="narrative-section__label">AI ANALYSIS</p>
        <p className="narrative-section__empty-text">
          Your analyst is still processing your data. Upload more reports or check back shortly for insights.
        </p>
      </div>
    );
  }

  const hookLine = narrative.segments[0]?.content || "";
  const bodySegments = narrative.segments.slice(1);
  const relativeTime = formatRelativeTime(updatedAt);

  return (
    <div className="narrative-section" aria-live="polite">
      <p className="narrative-section__label">AI ANALYSIS</p>
      <h1 className="narrative-section__hook">
        {parseNarrative(hookLine)}
      </h1>
      {bodySegments.map((seg, i) => (
        <p key={i} className="narrative-section__body">
          {parseNarrative(seg.content)}
        </p>
      ))}
      {relativeTime && (
        <p className="narrative-section__timestamp">
          Updated {relativeTime}
        </p>
      )}
    </div>
  );
}

// Export for testing
export { parseNarrative, parseMetrics, formatRelativeTime };
