import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";

const ACCOUNT_TYPES = [
  { value: "winery", label: "Winery / Vineyard" },
  { value: "importer", label: "Importer / Negociant" },
  { value: "distributor", label: "Distributor / Wholesaler" },
  { value: "retailer", label: "Retailer / Restaurant / Bar" },
];

export default function Login({ initialMode = "signin", onBackToLanding }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0].value);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isSignup) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name, accountType);
      } else {
        await login(email, password);
      }
    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <form onSubmit={handleSubmit} style={styles.card}>
        {onBackToLanding && (
          <button type="button" onClick={onBackToLanding} style={styles.backBtn}>
            &larr; Back
          </button>
        )}
        <div style={styles.logoRow}>
          <BrandLogo size={36} />
          <h1 style={styles.title}>CruFolio</h1>
        </div>
        <p style={styles.subtitle}>{isSignup ? "Create your account" : "Sign in to your account"}</p>

        {error && <div style={styles.error}>{error}</div>}

        {isSignup && (
          <>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              style={styles.input}
              placeholder="Jane Smith"
            />
          </>
        )}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus={!isSignup}
          style={styles.input}
          placeholder="you@company.com"
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
          placeholder={isSignup ? "At least 6 characters" : "Enter your password"}
        />

        {isSignup && (
          <>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="Confirm your password"
            />

            <label style={styles.label}>Business Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              style={styles.select}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </>
        )}

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading
            ? (isSignup ? "Creating account..." : "Signing in...")
            : (isSignup ? "Create Account" : "Sign In")}
        </button>

        <p style={styles.toggle}>
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => { setMode(isSignup ? "signin" : "signup"); setError(""); }}
            style={styles.toggleBtn}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </form>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #6B1E1E 0%, #8A2035 50%, #8A2035 100%)",
    padding: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    background: "none",
    border: "none",
    color: "#6B6B6B",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    padding: "4px 8px",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px",
  },
  title: {
    fontFamily: "'Libre Baskerville', serif",
    fontSize: "22px",
    fontWeight: 700,
    color: "#6B1E1E",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6B6B6B",
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#2E2E2E",
    marginBottom: "4px",
    marginTop: "12px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #E5E0DA",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #E5E0DA",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
  },
  btn: {
    marginTop: "24px",
    width: "100%",
    padding: "12px",
    background: "#6B1E1E",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: "15px",
    cursor: "pointer",
  },
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "8px",
  },
  toggle: {
    textAlign: "center",
    fontSize: "13px",
    color: "#6B6B6B",
    marginTop: "16px",
  },
  toggleBtn: {
    background: "none",
    border: "none",
    color: "#6B1E1E",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
    padding: 0,
  },
};
