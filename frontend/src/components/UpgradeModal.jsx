/**
 * UpgradeModal — plan comparison + Stripe Checkout redirect.
 *
 * Shows all plan tiers with the user's current plan highlighted.
 * Selecting a plan calls createCheckoutSession and redirects to Stripe.
 * Enterprise tier links to contact sales.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   currentPlan: string | null — current plan ID
 *   context: string | null — optional context message ("AI features require Growth plan")
 */
import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../context/AuthContext";
import { PLANS_DISPLAY, PLAN_IDS } from "../config/plans";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#6B1E1E" opacity="0.12" />
      <path d="M5 8.5L7 10.5L11 6" stroke="#6B1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function UpgradeModal({ isOpen, onClose, currentPlan, context }) {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(null); // planId being loaded
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleSelectPlan(planId) {
    if (planId === currentPlan) return;
    setLoading(planId);
    setError(null);

    try {
      const functions = getFunctions();
      const createCheckout = httpsCallable(functions, "createCheckoutSession");
      const result = await createCheckout({
        tenantId,
        planId,
        origin: window.location.origin,
        successUrl: `${window.location.origin}/?upgraded=true`,
        cancelUrl: `${window.location.origin}/settings`,
      });

      if (result.data?.url) {
        // Store sessionId for verification on return
        sessionStorage.setItem("pendingCheckoutSession", result.data.sessionId);
        window.location.href = result.data.url;
      } else {
        setError("Unable to create checkout session. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError(err.message || "Unable to process upgrade. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Choose your plan</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">&times;</button>
        </div>

        {context && (
          <p style={styles.context}>{context}</p>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Plan cards */}
        <div style={styles.grid}>
          {PLANS_DISPLAY.map((tier) => {
            const isCurrent = tier.id === currentPlan;
            const isPopular = tier.popular;

            return (
              <div
                key={tier.id}
                style={{
                  ...styles.card,
                  ...(isPopular ? styles.cardPopular : {}),
                  ...(isCurrent ? styles.cardCurrent : {}),
                }}
              >
                {isPopular && <div style={styles.popularBadge}>Most Popular</div>}
                {isCurrent && <div style={styles.currentBadge}>Current Plan</div>}

                <h3 style={styles.planName}>{tier.name}</h3>
                <div style={styles.priceRow}>
                  <span style={styles.price}>{tier.price}</span>
                  {tier.unit && <span style={styles.priceUnit}>{tier.unit}</span>}
                </div>
                <p style={styles.planDesc}>{tier.description}</p>

                <ul style={styles.featureList}>
                  {tier.features.map((feat, j) => (
                    <li key={j} style={styles.featureItem}>
                      <Check />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {tier.cta === "contact" ? (
                  <a
                    href="mailto:hello@crufolio.com"
                    style={styles.contactBtn}
                  >
                    Contact Sales
                  </a>
                ) : isCurrent ? (
                  <button style={styles.currentBtn} disabled>
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(tier.id)}
                    disabled={loading !== null}
                    style={{
                      ...styles.selectBtn,
                      ...(loading === tier.id ? styles.selectBtnLoading : {}),
                    }}
                  >
                    {loading === tier.id ? "Redirecting..." : `Upgrade to ${tier.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p style={styles.footer}>
          All plans include a 14-day free trial. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: 24,
  },
  modal: {
    background: "#FDF8F0",
    borderRadius: 12,
    maxWidth: 900,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    padding: 32,
    position: "relative",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 400,
    color: "#2E2E2E",
    fontFamily: "'Libre Baskerville', Georgia, serif",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 28,
    color: "#6B6B6B",
    cursor: "pointer",
    padding: "4px 8px",
    lineHeight: 1,
  },
  context: {
    fontSize: 14,
    color: "#6B6B6B",
    marginBottom: 20,
    padding: "10px 14px",
    background: "rgba(107, 30, 30, 0.06)",
    borderRadius: 7,
    border: "1px solid rgba(107, 30, 30, 0.12)",
  },
  error: {
    fontSize: 13,
    color: "#C53030",
    padding: "10px 14px",
    background: "rgba(197, 48, 48, 0.06)",
    borderRadius: 7,
    border: "1px solid rgba(197, 48, 48, 0.15)",
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginBottom: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: 24,
    border: "2px solid #E5E0DA",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  cardPopular: {
    borderColor: "#6B1E1E",
    boxShadow: "0 0 30px rgba(107,30,30,0.1)",
  },
  cardCurrent: {
    borderColor: "#1F865A",
    background: "rgba(31, 134, 90, 0.03)",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#6B1E1E",
    color: "#fff",
    padding: "4px 14px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  currentBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1F865A",
    color: "#fff",
    padding: "4px 14px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  planName: {
    fontSize: 18,
    fontWeight: 600,
    color: "#2E2E2E",
    margin: "0 0 8px",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  priceRow: {
    marginBottom: 4,
  },
  price: {
    fontSize: 36,
    fontWeight: 700,
    color: "#2E2E2E",
    fontFeatureSettings: "'tnum'",
  },
  priceUnit: {
    fontSize: 14,
    fontWeight: 500,
    color: "#6B6B6B",
  },
  planDesc: {
    fontSize: 13,
    color: "#6B6B6B",
    marginBottom: 16,
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 20px",
    flex: 1,
  },
  featureItem: {
    padding: "5px 0",
    fontSize: 13,
    color: "#2E2E2E",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  selectBtn: {
    width: "100%",
    padding: "10px 20px",
    background: "#6B1E1E",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Inter Tight', Inter, sans-serif",
    transition: "background-color 200ms",
  },
  selectBtnLoading: {
    background: "#8B6A4C",
    cursor: "wait",
  },
  currentBtn: {
    width: "100%",
    padding: "10px 20px",
    background: "transparent",
    color: "#1F865A",
    border: "2px solid #1F865A",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    cursor: "default",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  contactBtn: {
    display: "block",
    width: "100%",
    padding: "10px 20px",
    background: "transparent",
    color: "#2E2E2E",
    border: "2px solid #E5E0DA",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
    textDecoration: "none",
    fontFamily: "'Inter Tight', Inter, sans-serif",
    boxSizing: "border-box",
  },
  footer: {
    fontSize: 12,
    color: "#6B6B6B",
    textAlign: "center",
    margin: 0,
  },
};
