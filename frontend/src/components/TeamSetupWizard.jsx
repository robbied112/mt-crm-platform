/**
 * TeamSetupWizard — guided first-time team setup.
 *
 * Modal overlay. Four steps:
 *   1. Name your company (if not set)
 *   2. Define territories (or skip)
 *   3. Create first invite link
 *   4. Done — share the link
 *
 * Design: minimal steps, progress bar (not stepper), Libre Baskerville
 * step titles, generous whitespace. Skip always visible.
 */

import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useTeam } from "../context/TeamContext";
import { ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS } from "../config/roles";

const TOTAL_STEPS = 4;

export default function TeamSetupWizard({ onClose }) {
  const { currentUser } = useAuth();
  const { tenantConfig, updateTenantConfig } = useData();
  const { generateInvite } = useTeam();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState(tenantConfig?.companyName || "");
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteRole, setInviteRole] = useState("rep");
  const [copied, setCopied] = useState(false);

  // Territory config
  const [territories, setTerritories] = useState(tenantConfig?.territories || {});
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [newStates, setNewStates] = useState({});

  // ─── Step 1: Company Name ───────────────────────────────────────

  const handleSaveCompanyName = useCallback(async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await updateTenantConfig({ companyName: companyName.trim() });
      setStep(2);
    } catch (err) {
      console.error("Failed to save company name:", err);
    } finally {
      setSaving(false);
    }
  }, [companyName, updateTenantConfig]);

  // ─── Step 2: Territories ────────────────────────────────────────

  const addTerritory = useCallback(() => {
    const name = newTerritoryName.trim();
    if (!name || territories[name]) return;
    setTerritories((prev) => ({ ...prev, [name]: [] }));
    setNewTerritoryName("");
  }, [newTerritoryName, territories]);

  const addState = useCallback((terr) => {
    const st = (newStates[terr] || "").trim().toUpperCase();
    if (!st || st.length !== 2) return;
    setTerritories((prev) => ({
      ...prev,
      [terr]: [...(prev[terr] || []), st],
    }));
    setNewStates((prev) => ({ ...prev, [terr]: "" }));
  }, [newStates]);

  const handleSaveTerritories = useCallback(async () => {
    setSaving(true);
    try {
      await updateTenantConfig({ territories });
      setStep(3);
    } catch (err) {
      console.error("Failed to save territories:", err);
    } finally {
      setSaving(false);
    }
  }, [territories, updateTenantConfig]);

  // ─── Step 3: Create Invite ──────────────────────────────────────

  const handleCreateInvite = useCallback(async () => {
    setSaving(true);
    try {
      const result = await generateInvite({
        role: inviteRole,
        territory: "all",
        maxUses: 10,
      });
      if (result) {
        const link = `${window.location.origin}/join/${result.code}`;
        setInviteLink(link);
        setStep(4);
      }
    } catch (err) {
      console.error("Failed to create invite:", err);
    } finally {
      setSaving(false);
    }
  }, [generateInvite, inviteRole]);

  // ─── Copy invite link ──────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  // ─── Progress bar ──────────────────────────────────────────────

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Team Setup">
        {/* Progress bar */}
        <div style={styles.progressTrack} role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL_STEPS}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <p style={styles.stepLabel}>STEP {step} OF {TOTAL_STEPS}</p>

        {/* Step 1: Company Name */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Name your company</h2>
            <p style={styles.stepDesc}>This appears on invite pages and in your team's sidebar.</p>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={styles.input}
              placeholder="e.g. Napa Valley Imports"
              autoFocus
            />
            <div style={styles.buttonRow}>
              <button
                className="btn btn-primary"
                onClick={handleSaveCompanyName}
                disabled={saving || !companyName.trim()}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
              <button style={styles.skipBtn} onClick={() => setStep(2)}>Skip</button>
            </div>
          </div>
        )}

        {/* Step 2: Territories */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Define your territories</h2>
            <p style={styles.stepDesc}>
              Group US states into named territories. Your reps will be assigned
              to territories to see only their region's data. You can always change this later.
            </p>

            {Object.entries(territories).map(([name, states]) => (
              <div key={name} style={styles.territoryGroup}>
                <strong style={{ fontSize: 14 }}>{name}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {states.map((st, i) => (
                    <span key={i} style={styles.pill}>{st}</span>
                  ))}
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="text"
                      value={newStates[name] || ""}
                      onChange={(e) => setNewStates((p) => ({ ...p, [name]: e.target.value }))}
                      placeholder="e.g. GA"
                      maxLength={2}
                      style={{ ...styles.miniInput, width: 50 }}
                      onKeyDown={(e) => { if (e.key === "Enter") addState(name); }}
                    />
                    <button style={styles.addBtn} onClick={() => addState(name)}>+</button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                type="text"
                value={newTerritoryName}
                onChange={(e) => setNewTerritoryName(e.target.value)}
                placeholder="Territory name (e.g. Southeast)"
                style={{ ...styles.miniInput, flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter") addTerritory(); }}
              />
              <button style={styles.addBtn} onClick={addTerritory}>+ Add</button>
            </div>

            <div style={styles.buttonRow}>
              <button
                className="btn btn-primary"
                onClick={handleSaveTerritories}
                disabled={saving}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
              <button style={styles.skipBtn} onClick={() => setStep(3)}>
                Skip — auto-detect later
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Create Invite */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Invite your first teammate</h2>
            <p style={styles.stepDesc}>
              Choose a role and we'll generate a shareable link. You can create
              more invites anytime from Settings.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.formLabel}>Role for this invite</label>
              {ROLES_ORDERED.filter((r) => r !== "admin").map((r) => (
                <label key={r} style={{
                  ...styles.radioCard,
                  borderColor: inviteRole === r ? "#6B1E1E" : "#E5E0DA",
                  background: inviteRole === r ? "rgba(107, 30, 30, 0.04)" : "#fff",
                }}>
                  <input
                    type="radio"
                    name="inviteRole"
                    value={r}
                    checked={inviteRole === r}
                    onChange={() => setInviteRole(r)}
                    style={{ accentColor: "#6B1E1E" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#2E2E2E" }}>
                      {ROLE_LABELS[r]}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B6B6B" }}>
                      {ROLE_DESCRIPTIONS[r]}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={styles.buttonRow}>
              <button
                className="btn btn-primary"
                onClick={handleCreateInvite}
                disabled={saving}
              >
                {saving ? "Creating..." : "Generate Invite Link"}
              </button>
              <button style={styles.skipBtn} onClick={onClose}>Skip — do it later</button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Ready!</h2>
            <p style={styles.stepDesc}>
              Share this link with your teammate. It works for up to 10 people
              and expires in 7 days.
            </p>

            <div style={styles.linkBox}>
              <code style={styles.linkCode}>{inviteLink}</code>
              <button
                className="btn btn-primary"
                onClick={handleCopy}
                style={{ whiteSpace: "nowrap" }}
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <div style={{ ...styles.buttonRow, justifyContent: "center", marginTop: 24 }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(30, 27, 30, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: "#FFFFFF",
    borderRadius: 8,
    maxWidth: 560,
    width: "100%",
    padding: "0 32px 32px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  progressTrack: {
    height: 4,
    background: "#FDF8F0",
    borderRadius: 9999,
    marginTop: 24,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#6B1E1E",
    borderRadius: 9999,
    transition: "width 200ms ease-out",
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6B6B6B",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 20,
  },
  stepContent: {},
  stepTitle: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 22,
    color: "#2E2E2E",
    fontWeight: 400,
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: "#6B6B6B",
    lineHeight: 1.6,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #D1CBC4",
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, sans-serif",
    boxSizing: "border-box",
    marginBottom: 16,
  },
  buttonRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  skipBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    color: "#6B6B6B",
    cursor: "pointer",
    textDecoration: "underline",
  },
  formLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#6B6B6B",
    marginBottom: 8,
  },
  radioCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: "1px solid",
    marginBottom: 8,
    cursor: "pointer",
  },
  territoryGroup: {
    padding: "10px 0",
    borderBottom: "1px solid #F5EDE3",
  },
  pill: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#F5EDE3",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  miniInput: {
    padding: "4px 8px",
    border: "1px solid #D1CBC4",
    borderRadius: 6,
    fontSize: 13,
  },
  addBtn: {
    padding: "4px 10px",
    background: "#1F865A",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  linkBox: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: 12,
    background: "#FDF8F0",
    borderRadius: 8,
    border: "1px solid #E5E0DA",
  },
  linkCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: "#2E2E2E",
    flex: 1,
    wordBreak: "break-all",
  },
};
