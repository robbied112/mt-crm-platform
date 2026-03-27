/**
 * AIBriefing — the AI-first homepage.
 * Two-region workspace: primary reading column + context rail.
 * Five-state machine: no data → generating → briefing → stale → starter.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBriefing } from "../../context/BriefingContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { WelcomeState } from "../EmptyState";

// --- Helpers ---

function daysSince(timestamp) {
  if (!timestamp) return Infinity;
  const ms = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const ms = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Skeleton Loading ---

function BriefingSkeleton() {
  return (
    <div style={{ maxWidth: 720, padding: "48px 0" }}>
      <div style={{ width: 160, height: 14, background: "#E5E0DA", borderRadius: 4, marginBottom: 12 }} />
      <div style={{ width: "80%", height: 28, background: "#E5E0DA", borderRadius: 6, marginBottom: 32 }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ width: `${70 + i * 8}%`, height: 16, background: "#F0EBE4", borderRadius: 4 }} />
        </div>
      ))}
      <p style={{ color: "#6B6B6B", fontSize: 13, marginTop: 24 }}>Analyzing your data...</p>
    </div>
  );
}

// --- Starter Tier Degraded View ---

function StarterView() {
  return (
    <div style={{
      maxWidth: 720, padding: "48px 0",
    }}>
      <p style={{
        fontFamily: "'Inter', sans-serif", fontSize: 12, textTransform: "uppercase",
        letterSpacing: "0.5px", color: "#6B6B6B", marginBottom: 8,
      }}>
        WEEKLY BRIEFING
      </p>
      <h1 style={{
        fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 28,
        color: "#6B1E1E", fontWeight: 400, lineHeight: 1.3, marginBottom: 24,
      }}>
        Unlock your AI briefing
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#2E2E2E", marginBottom: 24 }}>
        Upgrade to a paid plan to get AI-generated weekly briefings that tell you what changed,
        what needs attention, and what to do next.
      </p>
      <div style={{
        border: "1px solid #D2C78A", borderRadius: 8, padding: 24,
        background: "rgba(210, 199, 138, 0.06)",
      }}>
        <h3 style={{
          fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 16,
          color: "#2E2E2E", marginBottom: 8,
        }}>
          What you'll get
        </h3>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: "#6B6B6B", paddingLeft: 20 }}>
          <li>AI narrative summarizing your business data</li>
          <li>Automated change detection between uploads</li>
          <li>Risk alerts and recommended actions</li>
          <li>Ask questions about your data</li>
        </ul>
        <button style={{
          marginTop: 16, padding: "10px 24px", background: "#6B1E1E", color: "#FDF8F0",
          border: "none", borderRadius: 7, fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>
          Upgrade Plan
        </button>
      </div>
    </div>
  );
}

// --- Freshness Indicator ---

function FreshnessIndicator({ days, onUpload }) {
  let dotColor = "#1F865A"; // green
  let text = "Updated today";

  if (days === 1) { text = "Updated yesterday"; }
  else if (days >= 2 && days <= 6) { dotColor = "#C07B01"; text = `${days} days ago`; }
  else if (days >= 7) { dotColor = "#C53030"; text = `${days}+ days ago`; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, color: "#6B6B6B" }}>{text}</span>
      <button
        onClick={onUpload}
        style={{
          marginLeft: "auto", padding: "6px 14px", fontSize: 13,
          background: "transparent", border: "1px solid #6B1E1E", color: "#6B1E1E",
          borderRadius: 7, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}
      >
        Upload Data
      </button>
    </div>
  );
}

// --- Evidence KPIs ---

function EvidenceKPIs({ stats }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E5E0DA", borderRadius: 8, padding: 16,
      marginBottom: 16,
    }}>
      <p style={{
        fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
        color: "#6B6B6B", marginBottom: 12, fontFamily: "'Inter', sans-serif",
      }}>
        EVIDENCE
      </p>
      {stats.map((stat, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          padding: "6px 0",
          borderBottom: i < stats.length - 1 ? "1px solid #E5E0DA" : "none",
        }}>
          <span style={{ fontSize: 13, color: "#6B6B6B" }}>{stat.headline}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#2E2E2E" }}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}

// --- Feedback Buttons ---

function FeedbackButtons({ current, onFeedback }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <button
        onClick={() => onFeedback("up")}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 4,
          color: current === "up" ? "#6B1E1E" : "#6B6B6B",
          opacity: current === "up" ? 1 : 0.6,
        }}
        aria-label="Good briefing"
      >
        👍
      </button>
      <button
        onClick={() => onFeedback("down")}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 4,
          color: current === "down" ? "#C53030" : "#6B6B6B",
          opacity: current === "down" ? 1 : 0.6,
        }}
        aria-label="Bad briefing"
      >
        👎
      </button>
      {current && (
        <span style={{ fontSize: 12, color: "#1F865A" }}>Thanks!</span>
      )}
    </div>
  );
}

// --- Change Item ---

function ChangeItem({ change }) {
  const borderColors = { up: "#1F865A", down: "#C53030", alert: "#C07B01" };
  const borderColor = borderColors[change.direction] || "#E5E0DA";

  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`, paddingLeft: 16, marginBottom: 12,
    }}>
      <p style={{
        fontSize: 16, color: "#2E2E2E", margin: 0,
        fontFamily: "'Inter Tight', sans-serif",
        fontWeight: change.impact === "high" ? 600 : 400,
        ...(change.impact === "low" ? { color: "#6B6B6B" } : {}),
      }}>
        {change.title}
      </p>
      <p style={{ fontSize: 14, color: "#6B6B6B", margin: "4px 0 0 0" }}>
        {change.detail}
      </p>
    </div>
  );
}

// --- Main Component ---

function AIBriefing() {
  const navigate = useNavigate();
  const { briefing, briefingLoading, submitFeedback } = useBriefing();
  const { availability, tenantConfig } = useData();
  const { currentUser } = useAuth();

  // State machine
  const state = useMemo(() => {
    if (!availability.hasAnyData) return "no-data";
    const plan = tenantConfig?.subscription?.plan;
    if (plan === "starter" && tenantConfig?.subscription?.aiCalls === false) return "starter";
    if (briefingLoading) return "loading";
    if (!briefing) return "generating";
    const days = daysSince(briefing.createdAt);
    if (days > 7) return "stale";
    return "ready";
  }, [availability.hasAnyData, tenantConfig, briefingLoading, briefing]);

  // No data → welcome/upload state
  if (state === "no-data") return <WelcomeState />;

  // Starter tier → degraded view
  if (state === "starter") return <StarterView />;

  // Loading/generating → skeleton
  if (state === "loading" || state === "generating") return <BriefingSkeleton />;

  // Ready or stale → full briefing
  const days = daysSince(briefing.createdAt);
  const hookLine = briefing.narrativeSegments?.find((s) => s.type === "text")?.content || "Your weekly briefing is ready.";
  const bodySegments = briefing.narrativeSegments?.slice(1) || [];

  return (
    <div style={{
      display: "flex", gap: 32, maxWidth: 1040, margin: "0 auto", padding: "24px 0",
    }}>
      {/* Primary workspace */}
      <div style={{ flex: 1, maxWidth: 720, minWidth: 0 }}>
        {/* Header */}
        <p style={{
          fontFamily: "'Inter', sans-serif", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.5px", color: "#6B6B6B", marginBottom: 8,
        }}>
          WEEKLY BRIEFING · {formatDate(briefing.createdAt)}
        </p>
        <h1 style={{
          fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 32,
          color: "#6B1E1E", fontWeight: 400, lineHeight: 1.3, marginBottom: 32,
        }}>
          {hookLine}
        </h1>

        {/* Stale warning */}
        {state === "stale" && (
          <div style={{
            background: "rgba(192, 123, 1, 0.08)", border: "1px solid rgba(192, 123, 1, 0.2)",
            borderRadius: 7, padding: "12px 16px", marginBottom: 24,
            fontSize: 14, color: "#C07B01",
          }}>
            This briefing is {days} days old. Upload fresh data to get updated insights.
          </div>
        )}

        {/* Narrative body */}
        <div style={{ marginBottom: 32 }}>
          {bodySegments.map((seg, i) => {
            if (seg.type === "text") {
              return (
                <p key={i} style={{
                  fontSize: 16, lineHeight: 1.6, color: "#2E2E2E", marginBottom: 16,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {seg.content}
                </p>
              );
            }
            // Sparkline placeholder (PR 3)
            if (seg.type === "sparkline") {
              return (
                <span key={i} style={{
                  display: "inline-block", width: 100, height: 24, background: "#F0EBE4",
                  borderRadius: 4, verticalAlign: "middle", margin: "0 4px",
                }}
                  aria-label={seg.label || "trend chart"}
                />
              );
            }
            return null;
          })}
        </div>

        {/* Changes */}
        {briefing.changes?.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 20,
              color: "#2E2E2E", marginBottom: 16,
            }}>
              Changes since {formatDate(briefing.createdAt)}
            </h2>
            {briefing.changes.map((c, i) => (
              <ChangeItem key={i} change={c} />
            ))}
          </section>
        )}

        {/* Risks */}
        {briefing.risks?.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 20,
              color: "#2E2E2E", marginBottom: 16,
            }}>
              Needs attention
            </h2>
            {briefing.risks.map((r, i) => (
              <div key={i} style={{
                borderLeft: "2px solid #C07B01", paddingLeft: 16, marginBottom: 12,
              }}>
                <p style={{
                  fontSize: 16, color: "#2E2E2E", margin: 0,
                  fontFamily: "'Inter Tight', sans-serif", fontWeight: 600,
                }}>
                  {r.title}
                </p>
                <p style={{ fontSize: 14, color: "#6B6B6B", margin: "4px 0 0 0" }}>
                  {r.detail}
                </p>
                {r.quantifiedImpact && (
                  <p style={{ fontSize: 13, color: "#C07B01", margin: "4px 0 0 0" }}>
                    {r.quantifiedImpact}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Suggested questions (PR 2 will add chat) */}
        {briefing.suggestedQuestions?.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <p style={{
              fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
              color: "#6B6B6B", marginBottom: 12,
            }}>
              ASK ABOUT YOUR DATA
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {briefing.suggestedQuestions.map((q, i) => (
                <span key={i} style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 13,
                  background: "#FDF8F0", border: "1px solid #E5E0DA", color: "#6B1E1E",
                  cursor: "default",
                }}>
                  {q}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#6B6B6B", marginTop: 8 }}>
              Chat coming soon — ask questions about your data in PR 2.
            </p>
          </section>
        )}
      </div>

      {/* Context rail */}
      <aside style={{ width: 280, flexShrink: 0 }}>
        <FreshnessIndicator
          days={days}
          onUpload={() => navigate("/settings")}
        />

        <EvidenceKPIs stats={briefing.drillDownStats} />

        {/* Actions */}
        {briefing.actions?.length > 0 && (
          <div style={{
            background: "#FFFFFF", border: "1px solid #E5E0DA", borderRadius: 8,
            padding: 16, marginBottom: 16,
          }}>
            <p style={{
              fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
              color: "#6B6B6B", marginBottom: 12,
            }}>
              DO NEXT
            </p>
            {briefing.actions.map((action, i) => (
              <label key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0",
                borderBottom: i < briefing.actions.length - 1 ? "1px solid #E5E0DA" : "none",
                cursor: "default", minHeight: 44,
              }}>
                <input
                  type="checkbox"
                  disabled
                  style={{ marginTop: 3, accentColor: "#6B1E1E" }}
                />
                <span style={{ fontSize: 14, color: "#2E2E2E", lineHeight: 1.5 }}>
                  {action.text}
                </span>
              </label>
            ))}
            <p style={{ fontSize: 12, color: "#6B6B6B", marginTop: 8 }}>
              Action checkboxes active in PR 2.
            </p>
          </div>
        )}

        <FeedbackButtons
          current={briefing.feedback}
          onFeedback={submitFeedback}
        />
      </aside>
    </div>
  );
}

export default AIBriefing;
