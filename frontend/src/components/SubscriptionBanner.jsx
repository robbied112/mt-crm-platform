/**
 * SubscriptionBanner — contextual banners for subscription state.
 *
 * Shows one of:
 *   - Trial countdown (sidebar badge)
 *   - Trial expired notice (full-width banner)
 *   - Dunning warning (payment failed, yellow/red)
 *   - Suspended notice (read-only, needs payment)
 *
 * Placed in the main content area (App.jsx), above the page content.
 */
import { useState } from "react";
import useSubscription, { DUNNING_STAGES } from "../hooks/useSubscription";

/**
 * Full-width banner for expired trial, dunning, or cancelled state.
 * Renders above the page content.
 */
export default function SubscriptionBanner({ onUpgrade, onOpenBillingPortal }) {
  const sub = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  // Nothing to show for active subscriptions or active trials
  if (sub.isActive && !sub.dunning) return null;
  if (dismissed) return null;

  // Trial expired
  if (sub.isExpired && (sub.status === "trial" || sub.status === "none" || sub.status === "unknown")) {
    return (
      <div style={{ ...styles.banner, ...styles.expired }}>
        <div style={styles.content}>
          <span style={styles.icon}>&#9888;</span>
          <span>
            <strong>Your free trial has ended.</strong>{" "}
            Your data is safe — upgrade to continue uploading and managing accounts.
          </span>
        </div>
        <button onClick={onUpgrade} style={styles.upgradeBtn}>
          Upgrade Now
        </button>
      </div>
    );
  }

  // Cancelled
  if (sub.status === "cancelled") {
    return (
      <div style={{ ...styles.banner, ...styles.expired }}>
        <div style={styles.content}>
          <span style={styles.icon}>&#9888;</span>
          <span>
            <strong>Your subscription has been cancelled.</strong>{" "}
            Your data is safe in read-only mode. Resubscribe to regain full access.
          </span>
        </div>
        <button onClick={onUpgrade} style={styles.upgradeBtn}>
          Resubscribe
        </button>
      </div>
    );
  }

  // Dunning — payment failed
  if (sub.dunning) {
    const { stage, daysUntilSuspension } = sub.dunning;

    const handleFixPayment = onOpenBillingPortal || onUpgrade;

    if (stage === DUNNING_STAGES.WARNING) {
      return (
        <div style={{ ...styles.banner, ...styles.warning }}>
          <div style={styles.content}>
            <span style={styles.icon}>&#9888;</span>
            <span>
              <strong>Payment failed.</strong>{" "}
              Please update your payment method to avoid service interruption.
            </span>
          </div>
          <div style={styles.actions}>
            <button onClick={handleFixPayment} style={styles.fixBtn}>
              Update Payment
            </button>
            <button onClick={() => setDismissed(true)} style={styles.dismissBtn}>
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (stage === DUNNING_STAGES.URGENT) {
      return (
        <div style={{ ...styles.banner, ...styles.urgent }}>
          <div style={styles.content}>
            <span style={styles.icon}>&#9888;</span>
            <span>
              <strong>Payment still failed.</strong>{" "}
              Your access will be restricted in {daysUntilSuspension} day{daysUntilSuspension !== 1 ? "s" : ""}.
              Please update your payment method.
            </span>
          </div>
          <button onClick={handleFixPayment} style={styles.fixBtnUrgent}>
            Update Payment Now
          </button>
        </div>
      );
    }

    if (stage === DUNNING_STAGES.SUSPENDED) {
      return (
        <div style={{ ...styles.banner, ...styles.expired }}>
          <div style={styles.content}>
            <span style={styles.icon}>&#128274;</span>
            <span>
              <strong>Account suspended — payment overdue.</strong>{" "}
              Your data is safe in read-only mode. Update your payment to restore full access.
            </span>
          </div>
          <button onClick={handleFixPayment} style={styles.upgradeBtn}>
            Update Payment
          </button>
        </div>
      );
    }
  }

  return null;
}

/**
 * Trial countdown badge for the sidebar.
 * Shows "Trial: X days left" with color coding.
 */
export function TrialBadge({ onClick }) {
  const sub = useSubscription();

  if (!sub.isTrial) return null;

  const days = sub.daysLeft;
  const isUrgent = days <= 3;
  const isWarning = days <= 7 && days > 3;

  const badgeColor = isUrgent ? "#C53030" : isWarning ? "#C07B01" : "#1F865A";
  const badgeBg = isUrgent
    ? "rgba(197, 48, 48, 0.12)"
    : isWarning
    ? "rgba(192, 123, 1, 0.12)"
    : "rgba(31, 134, 90, 0.12)";

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: badgeBg,
        border: `1px solid ${badgeColor}30`,
        borderRadius: 7,
        cursor: "pointer",
        width: "100%",
        transition: "background-color 200ms",
      }}
      title={`${days} day${days !== 1 ? "s" : ""} left in your free trial`}
    >
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: badgeColor,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}>
        Trial: {days} day{days !== 1 ? "s" : ""} left
      </span>
    </button>
  );
}

const styles = {
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    gap: 16,
    fontSize: 13,
    flexWrap: "wrap",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 200,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  actions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  // States
  expired: {
    background: "rgba(197, 48, 48, 0.08)",
    borderBottom: "1px solid rgba(197, 48, 48, 0.2)",
    color: "#2E2E2E",
  },
  warning: {
    background: "rgba(192, 123, 1, 0.08)",
    borderBottom: "1px solid rgba(192, 123, 1, 0.2)",
    color: "#2E2E2E",
  },
  urgent: {
    background: "rgba(197, 48, 48, 0.06)",
    borderBottom: "1px solid rgba(197, 48, 48, 0.15)",
    color: "#2E2E2E",
  },

  // Buttons
  upgradeBtn: {
    padding: "6px 16px",
    background: "#6B1E1E",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  fixBtn: {
    padding: "6px 16px",
    background: "#C07B01",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  fixBtnUrgent: {
    padding: "6px 16px",
    background: "#C53030",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  dismissBtn: {
    padding: "6px 12px",
    background: "none",
    color: "#6B6B6B",
    border: "1px solid #E5E0DA",
    borderRadius: 7,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
