/**
 * JoinPage — premium invite acceptance page.
 *
 * Renders at /join/:code. Full-page layout (no sidebar).
 * Two modes:
 *   1. New user → signup form
 *   2. Existing user (logged in) → "Join as [email]" with overwrite warning
 *
 * Design: Parchment bg, CruFolio logomark, Libre Baskerville headline,
 * Deep Burgundy CTA. Feels like a tasting room invitation.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../config/roles";
import CruFolioLogo from "./CruFolioLogo";

export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);

  // Signup form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState(null);

  // Validate invite code on mount
  async function runValidation() {
    setLoading(true);
    setError(null);
    try {
      const fns = getFunctions();
      const validate = httpsCallable(fns, "validateInvite", { timeout: 15000 });
      // Race against a timeout so the user never stares at a spinner forever
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("__timeout__")), 15000)
      );
      const result = await Promise.race([validate({ code }), timeout]);
      setInvite(result.data);
    } catch (err) {
      const msg = err.message || "Invalid invite link";
      if (msg === "__timeout__") {
        setError("Took too long to verify. Check your connection and try again.");
      } else if (msg.includes("expired")) {
        setError("This invite link has expired. Ask your team admin for a new one.");
      } else if (msg.includes("used")) {
        setError("This invite link has already been used. Ask your team admin for a new one.");
      } else {
        setError("This invite link is invalid. Check the URL or ask your team admin for a new link.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (code) runValidation();
    else setError("No invite code provided.");
  }, [code]);

  // Join team (for existing logged-in users)
  async function handleJoinTeam() {
    // Check if user has existing data (different tenant)
    if (currentUser && userProfile?.tenantId && userProfile.tenantId !== invite?.tenantId) {
      setShowOverwriteWarning(true);
      return;
    }
    await executeJoin();
  }

  async function executeJoin() {
    setJoining(true);
    setFormError(null);
    try {
      const fns = getFunctions();
      const joinTeam = httpsCallable(fns, "joinTeam");
      await joinTeam({ code });
      // Force reload to pick up new tenantId in AuthContext
      window.location.href = "/";
    } catch (err) {
      setFormError(err.message || "Failed to join team. Please try again.");
      setJoining(false);
    }
  }

  // Signup + join (for new users)
  async function handleSignupAndJoin(e) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setFormError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setJoining(true);
    try {
      // Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      // Join the team via Cloud Function
      const fns = getFunctions();
      const joinTeam = httpsCallable(fns, "joinTeam");
      await joinTeam({ code });

      // Force reload to pick up new tenantId
      window.location.href = "/";
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setFormError("An account with this email already exists. Sign in first, then use this invite link.");
      } else {
        setFormError(err.message || "Failed to create account. Please try again.");
      }
      setJoining(false);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <CruFolioLogo size={40} />
          <p style={styles.loadingText}>Verifying invite...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────
  if (error) {
    const isRetryable = error.includes("too long") || error.includes("connection");
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <CruFolioLogo size={40} />
          <div style={styles.errorCard}>
            <h2 style={isRetryable ? styles.warningTitle : styles.errorTitle}>
              {isRetryable ? "Connection Issue" : "Invite Not Valid"}
            </h2>
            <p style={styles.errorText}>{error}</p>
            {isRetryable && (
              <button style={styles.primaryButton} onClick={runValidation}>
                Try Again
              </button>
            )}
            <a href="/" style={{ ...styles.homeLink, display: "block", marginTop: 16 }}>Go to CruFolio</a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Overwrite warning modal ───────────────────────────────────
  if (showOverwriteWarning) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <CruFolioLogo size={40} />
          <div style={styles.card}>
            <h2 style={styles.warningTitle}>Switch Teams?</h2>
            <p style={styles.bodyText}>
              You currently have your own CruFolio account with existing data.
              Joining <strong>{invite.companyName}</strong> will replace your current
              account. Your previous data will no longer be accessible.
            </p>
            <div style={styles.buttonRow}>
              <button
                style={styles.dangerButton}
                onClick={executeJoin}
                disabled={joining}
              >
                {joining ? "Joining..." : `Join ${invite.companyName}`}
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => navigate("/")}
              >
                Keep My Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Logged-in user: join directly ─────────────────────────────
  if (currentUser) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <CruFolioLogo size={40} />
          <p style={styles.subtitle}>You've been invited to join</p>
          <h1 style={styles.companyName}>{invite.companyName || "a team"}</h1>
          <p style={styles.inviterText}>
            {invite.inviterName ? `Invited by ${invite.inviterName}` : ""}
            {invite.role ? ` · ${ROLE_LABELS[invite.role] || invite.role}` : ""}
          </p>

          <div style={styles.card}>
            <p style={styles.bodyText}>
              You're signed in as <strong>{currentUser.email}</strong>
            </p>
            {formError && <p style={styles.formError}>{formError}</p>}
            <button
              style={styles.primaryButton}
              onClick={handleJoinTeam}
              disabled={joining}
            >
              {joining ? "Joining..." : `Join ${invite.companyName || "Team"}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── New user: signup form ─────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.center}>
        <CruFolioLogo size={40} />
        <p style={styles.subtitle}>You've been invited to join</p>
        <h1 style={styles.companyName}>{invite.companyName || "a team"}</h1>
        <p style={styles.inviterText}>
          {invite.inviterName ? `Invited by ${invite.inviterName}` : ""}
          {invite.role ? ` · ${ROLE_LABELS[invite.role] || invite.role}` : ""}
        </p>

        <div style={styles.card}>
          <form onSubmit={handleSignupAndJoin}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {formError && <p style={styles.formError}>{formError}</p>}
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={joining}
            >
              {joining ? "Creating account..." : `Join ${invite.companyName || "Team"}`}
            </button>
          </form>
          <p style={styles.signinLink}>
            Already have an account?{" "}
            <a href={`/login?redirect=/join/${code}`} style={styles.link}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Styles (DESIGN.md calibrated) ────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FDF8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  center: {
    textAlign: "center",
    maxWidth: 480,
    width: "100%",
  },
  subtitle: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 18,
    color: "#2E2E2E",
    marginTop: 24,
    marginBottom: 4,
  },
  companyName: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 32,
    color: "#6B1E1E",
    fontWeight: 400,
    margin: "4px 0 8px",
  },
  inviterText: {
    fontSize: 14,
    color: "#6B6B6B",
    marginBottom: 24,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 8,
    border: "1px solid #E5E0DA",
    padding: 24,
    textAlign: "left",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#6B6B6B",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #D1CBC4",
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, sans-serif",
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: "12px 24px",
    background: "#6B1E1E",
    color: "#FDF8F0",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Inter Tight', -apple-system, sans-serif",
    cursor: "pointer",
    marginTop: 8,
  },
  secondaryButton: {
    padding: "12px 24px",
    background: "transparent",
    color: "#6B1E1E",
    border: "1px solid #6B1E1E",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Inter Tight', -apple-system, sans-serif",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "12px 24px",
    background: "#C53030",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Inter Tight', -apple-system, sans-serif",
    cursor: "pointer",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  formError: {
    color: "#C53030",
    fontSize: 13,
    marginBottom: 8,
  },
  signinLink: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B6B6B",
    marginTop: 16,
  },
  link: {
    color: "#6B1E1E",
    textDecoration: "none",
    fontWeight: 600,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B6B6B",
    marginTop: 16,
  },
  bodyText: {
    fontSize: 14,
    color: "#2E2E2E",
    lineHeight: 1.6,
    marginBottom: 16,
  },
  errorCard: {
    background: "#FFFFFF",
    borderRadius: 8,
    border: "1px solid #E5E0DA",
    padding: 32,
    marginTop: 24,
  },
  errorTitle: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 20,
    color: "#C53030",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#2E2E2E",
    lineHeight: 1.6,
    marginBottom: 20,
  },
  homeLink: {
    color: "#6B1E1E",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
  },
  warningTitle: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 20,
    color: "#C53030",
    marginBottom: 12,
  },
};
