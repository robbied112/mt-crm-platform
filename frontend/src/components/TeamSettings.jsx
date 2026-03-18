/**
 * TeamSettings — team management section for the Settings page.
 *
 * Shows: status bar (X/Y users), member table, invite generation,
 * active invites, and collapsible territory configuration.
 *
 * Admin-only. Uses TeamContext for data and mutations.
 */

import { useState, useCallback, useMemo } from "react";
import { useTeam } from "../context/TeamContext";
import { useAuth } from "../context/AuthContext";
import { useCrm } from "../context/CrmContext";
import useSubscription from "../hooks/useSubscription";
import { getFunctions, httpsCallable } from "firebase/functions";
import { PLANS } from "../config/plans";
import {
  ROLES, ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS,
  ROLE_COLORS,
} from "../config/roles";
import TerritoryMap from "./TerritoryMap";

export default function TeamSettings({ territories, onSaveTerritories }) {
  const { currentUser, tenantId } = useAuth();
  const {
    members, invites, loading, memberCount,
    generateInvite, revokeInvite,
    updateMemberRole, updateMemberTerritory, assignManager, removeMember,
    managers,
  } = useTeam();
  const { activities, tasks, accounts } = useCrm();
  const sub = useSubscription();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState("rep");
  const [inviteTerritory, setInviteTerritory] = useState("all");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [territoriesOpen, setTerritoriesOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null); // { code, inviteId }
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Territory config state
  const [localTerritories, setLocalTerritories] = useState(territories || {});
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [newStateInput, setNewStateInput] = useState({});
  const [territorySaving, setTerritorySaving] = useState(false);

  // Plan user limit
  const plan = sub.plan?.toLowerCase();
  const planDef = plan ? PLANS[plan] : null;
  const userLimit = planDef?.limits?.users || null;
  const atLimit = userLimit !== null && memberCount >= userLimit;

  // ─── Invite generation ──────────────────────────────────────────

  const handleCreateInvite = useCallback(async () => {
    setInviteLoading(true);
    setActionError(null);
    try {
      const result = await generateInvite({
        role: inviteRole,
        territory: inviteTerritory,
        maxUses: inviteMaxUses,
      });
      if (result) {
        const link = `${window.location.origin}/join/${result.code}`;
        await navigator.clipboard.writeText(link);
        setCopiedCode(result.code);
        setTimeout(() => setCopiedCode(null), 3000);
        setShowInviteForm(false);
      }
    } catch (err) {
      setActionError(err.message || "Failed to create invite");
    } finally {
      setInviteLoading(false);
    }
  }, [generateInvite, inviteRole, inviteTerritory, inviteMaxUses]);

  // ─── Member actions ─────────────────────────────────────────────

  const handleRoleChange = useCallback(async (uid, newRole) => {
    setActionError(null);
    try {
      await updateMemberRole(uid, newRole);
    } catch (err) {
      setActionError(err.message);
    }
  }, [updateMemberRole]);

  const handleManagerChange = useCallback(async (uid, managerId) => {
    setActionError(null);
    try {
      await assignManager(uid, managerId === "none" ? null : managerId);
    } catch (err) {
      setActionError(err.message);
    }
  }, [assignManager]);

  const handleTerritoryChange = useCallback(async (uid, territory) => {
    setActionError(null);
    try {
      await updateMemberTerritory(uid, territory);
    } catch (err) {
      setActionError(err.message);
    }
  }, [updateMemberTerritory]);

  const handleRemoveMember = useCallback(async (uid, name) => {
    if (!window.confirm(`Remove ${name} from the team? They will lose access to all team data.`)) return;
    setActionError(null);
    try {
      await removeMember(uid);
    } catch (err) {
      setActionError(err.message);
    }
  }, [removeMember]);

  // ─── Email invite ──────────────────────────────────────────────

  const handleSendEmail = useCallback(async () => {
    if (!emailTarget || !emailInput.trim()) return;
    setEmailSending(true);
    setActionError(null);
    try {
      const fn = httpsCallable(getFunctions(), "sendInviteEmail");
      await fn({ email: emailInput.trim(), inviteCode: emailTarget.code, tenantId });
      setEmailTarget(null);
      setEmailInput("");
    } catch (err) {
      setActionError(err.message || "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  }, [emailTarget, emailInput, tenantId]);

  // ─── Activity leaderboard ──────────────────────────────────────

  const leaderboard = useMemo(() => {
    if (members.length <= 1) return [];

    const now = new Date();
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d7Str = d7.toISOString().slice(0, 10);
    const d30Str = d30.toISOString().slice(0, 10);

    return members.map((m) => {
      const acts7 = activities.filter((a) => a.loggedBy === m.uid && a.date >= d7Str).length;
      const acts30 = activities.filter((a) => a.loggedBy === m.uid && a.date >= d30Str).length;

      // Daily counts for sparkline (last 30 days)
      const dailyCounts = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        dailyCounts.push(activities.filter((a) => a.loggedBy === m.uid && a.date === ds).length);
      }
      const acctsTouched = new Set(
        activities.filter((a) => a.loggedBy === m.uid && a.date >= d30Str && a.accountId).map((a) => a.accountId)
      ).size;
      const tasksCompleted = tasks.filter(
        (t) => t.createdBy === m.uid && t.status === "completed"
      ).length;
      const ownedAccounts = accounts.filter((a) => a.ownerId === m.uid).length;

      return {
        uid: m.uid,
        name: m.displayName || m.email?.split("@")[0] || "—",
        role: m.role,
        acts7,
        acts30,
        acctsTouched,
        tasksCompleted,
        ownedAccounts,
        dailyCounts,
      };
    }).sort((a, b) => b.acts30 - a.acts30);
  }, [members, activities, tasks, accounts]);

  // ─── Territory config ───────────────────────────────────────────

  const addTerritory = useCallback(() => {
    const name = newTerritoryName.trim();
    if (!name) return;
    if (localTerritories[name]) return;
    setLocalTerritories((prev) => ({ ...prev, [name]: [] }));
    setNewTerritoryName("");
  }, [newTerritoryName, localTerritories]);

  const addStateToTerritory = useCallback((territoryName) => {
    const state = (newStateInput[territoryName] || "").trim().toUpperCase();
    if (!state || state.length !== 2) return;
    setLocalTerritories((prev) => ({
      ...prev,
      [territoryName]: [...(prev[territoryName] || []), state],
    }));
    setNewStateInput((prev) => ({ ...prev, [territoryName]: "" }));
  }, [newStateInput]);

  const removeStateFromTerritory = useCallback((territoryName, stateIdx) => {
    setLocalTerritories((prev) => ({
      ...prev,
      [territoryName]: prev[territoryName].filter((_, i) => i !== stateIdx),
    }));
  }, []);

  const removeTerritory = useCallback((name) => {
    setLocalTerritories((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSaveTerritories = useCallback(async () => {
    setTerritorySaving(true);
    try {
      await onSaveTerritories?.(localTerritories);
    } catch (err) {
      setActionError(err.message || "Failed to save territories");
    } finally {
      setTerritorySaving(false);
    }
  }, [localTerritories, onSaveTerritories]);

  // ─── Territory names for dropdowns ──────────────────────────────
  const territoryNames = ["all", ...Object.keys(localTerritories)];

  // ─── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Team</h3>
        <div style={styles.skeleton}>
          <div style={styles.skeletonRow} />
          <div style={styles.skeletonRow} />
          <div style={styles.skeletonRow} />
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Team</h3>
        <button
          className="btn btn-primary"
          disabled={atLimit}
          onClick={() => setShowInviteForm(!showInviteForm)}
        >
          {atLimit ? `Team Full (${memberCount}/${userLimit})` : "Create Invite"}
        </button>
      </div>

      {/* Status bar */}
      <div style={{
        ...styles.statusBar,
        background: atLimit ? "rgba(197, 48, 48, 0.06)" : "rgba(31, 134, 90, 0.08)",
        borderColor: atLimit ? "#C53030" : "#1F865A",
      }}>
        <span style={{ fontSize: 16 }}>{atLimit ? "⚠️" : "👥"}</span>
        <span style={{
          fontWeight: 600, fontSize: 14,
          color: atLimit ? "#C53030" : "#1F865A",
        }}>
          {memberCount}{userLimit ? `/${userLimit}` : ""} team member{memberCount !== 1 ? "s" : ""}
          {planDef ? ` · ${planDef.name} Plan` : sub.isTrial ? " · Free Trial" : ""}
        </span>
        {atLimit && (
          <span style={{ fontSize: 13, color: "#C53030", marginLeft: "auto" }}>
            Upgrade to add more members
          </span>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div style={styles.errorBanner}>
          {actionError}
          <span style={styles.errorDismiss} onClick={() => setActionError(null)}>&times;</span>
        </div>
      )}

      {/* Copied toast */}
      {copiedCode && (
        <div style={styles.successBanner}>
          ✓ Invite link copied to clipboard!
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div style={styles.inviteForm}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.formLabel}>Role</label>
              <select
                style={styles.select}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLES_ORDERED.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.formLabel}>Territory</label>
              <select
                style={styles.select}
                value={inviteTerritory}
                onChange={(e) => setInviteTerritory(e.target.value)}
              >
                {territoryNames.map((t) => (
                  <option key={t} value={t}>{t === "all" ? "All Territories" : t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.formLabel}>Max Uses</label>
              <select
                style={styles.select}
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(Number(e.target.value))}
              >
                <option value={1}>1 use</option>
                <option value={5}>5 uses</option>
                <option value={10}>10 uses</option>
                <option value={25}>25 uses</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#6B6B6B", margin: "8px 0 0" }}>
            {ROLE_DESCRIPTIONS[inviteRole]}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleCreateInvite}
              disabled={inviteLoading}
            >
              {inviteLoading ? "Creating..." : "Generate & Copy Link"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowInviteForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Member table */}
      {members.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Invite your first teammate</p>
          <p style={styles.emptyText}>
            You're the founder. Create an invite link above and share it
            with your team to get started.
          </p>
        </div>
      ) : (
        <div className="table-container" style={{ marginTop: 16 }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Territory</th>
                {members.length > 2 && <th style={styles.th}>Reports To</th>}
                <th style={{ ...styles.th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={{ fontWeight: 600, color: "#2E2E2E" }}>
                      {m.displayName || m.email?.split("@")[0] || "—"}
                    </span>
                    {m.uid === currentUser?.uid && (
                      <span style={styles.youBadge}>you</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, color: "#6B6B6B" }}>{m.email}</td>
                  <td style={styles.td}>
                    {m.uid === currentUser?.uid ? (
                      <RoleBadge role={m.role} />
                    ) : (
                      <select
                        style={styles.inlineSelect}
                        value={m.role || "rep"}
                        onChange={(e) => handleRoleChange(m.uid, e.target.value)}
                      >
                        {ROLES_ORDERED.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={styles.td}>
                    <select
                      style={styles.inlineSelect}
                      value={m.territory || "all"}
                      onChange={(e) => handleTerritoryChange(m.uid, e.target.value)}
                      disabled={m.uid === currentUser?.uid && m.role === "admin"}
                    >
                      {territoryNames.map((t) => (
                        <option key={t} value={t}>{t === "all" ? "All" : t}</option>
                      ))}
                    </select>
                  </td>
                  {members.length > 2 && (
                    <td style={styles.td}>
                      {(m.role === "rep" || m.role === "viewer") ? (
                        <select
                          style={styles.inlineSelect}
                          value={m.managerId || "none"}
                          onChange={(e) => handleManagerChange(m.uid, e.target.value)}
                        >
                          <option value="none">—</option>
                          {managers.filter((mgr) => mgr.uid !== m.uid).map((mgr) => (
                            <option key={mgr.uid} value={mgr.uid}>
                              {mgr.displayName || mgr.email?.split("@")[0]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: "#6B6B6B" }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={styles.td}>
                    {m.uid !== currentUser?.uid && (
                      <button
                        style={styles.removeBtn}
                        onClick={() => handleRemoveMember(m.uid, m.displayName || m.email)}
                        title="Remove from team"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={styles.subsectionTitle}>Team Activity (30 days)</h4>
          <div className="table-container" style={{ marginTop: 8 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>30d Trend</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>7d</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>30d</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Accts Touched</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Tasks Done</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Owned Accts</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.uid} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{row.name}</td>
                    <td style={styles.td}><RoleBadge role={row.role} /></td>
                    <td style={styles.td}><Sparkline data={row.dailyCounts} /></td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{row.acts7}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{row.acts30}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.acctsTouched}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.tasksCompleted}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.ownedAccounts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active invites */}
      {invites.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={styles.subsectionTitle}>Active Invites</h4>
          {invites.map((inv) => {
            const expired = new Date(inv.expiresAt) < new Date();
            const used = inv.usedCount >= inv.maxUses;
            return (
              <div key={inv.id}>
                <div style={{
                  ...styles.inviteRow,
                  opacity: expired || used ? 0.5 : 1,
                }}>
                  <code style={styles.inviteCode}>
                    {window.location.origin}/join/{inv.code?.slice(0, 8)}...
                  </code>
                  <span style={styles.inviteMeta}>
                    {ROLE_LABELS[inv.role] || inv.role}
                    {inv.territory && inv.territory !== "all" ? ` · ${inv.territory}` : ""}
                  </span>
                  <span style={styles.inviteMeta}>
                    {expired ? "Expired" : used ? "Used" : `${inv.usedCount}/${inv.maxUses} used`}
                  </span>
                  {!expired && !used && (
                    <>
                      <button
                        style={styles.copyBtn}
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}/join/${inv.code}`
                          );
                          setCopiedCode(inv.code);
                          setTimeout(() => setCopiedCode(null), 2000);
                        }}
                        title="Copy link"
                      >
                        📋
                      </button>
                      <button
                        style={styles.copyBtn}
                        onClick={() => setEmailTarget({ code: inv.code, inviteId: inv.id })}
                        title="Email invite"
                      >
                        ✉️
                      </button>
                    </>
                  )}
                  <button
                    style={styles.removeBtn}
                    onClick={() => revokeInvite(inv.id)}
                    title="Revoke invite"
                  >
                    ×
                  </button>
                </div>
                {emailTarget?.inviteId === inv.id && (
                  <div style={{ display: "flex", gap: 6, padding: "6px 12px", background: "#fff", borderRadius: "0 0 6px 6px", borderTop: "1px solid #E5E0DA" }}>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="teammate@company.com"
                      style={{ ...styles.stateInput, flex: 1 }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(); }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-small"
                      onClick={handleSendEmail}
                      disabled={emailSending || !emailInput.trim()}
                      style={{ fontSize: 12 }}
                    >
                      {emailSending ? "Sending..." : "Send"}
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => { setEmailTarget(null); setEmailInput(""); }}
                      style={{ fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Territory map */}
      {Object.keys(localTerritories).length > 0 && (
        <div style={{ marginTop: 20, padding: 16, background: "#FDF8F0", borderRadius: 8, border: "1px solid #E5E0DA" }}>
          <h4 style={{ ...styles.subsectionTitle, marginBottom: 12 }}>Territory Map</h4>
          <TerritoryMap territories={localTerritories} />
        </div>
      )}

      {/* Territory configuration (collapsible) */}
      <div style={{ marginTop: 12 }}>
        <button
          style={styles.collapseToggle}
          onClick={() => setTerritoriesOpen(!territoriesOpen)}
        >
          {territoriesOpen ? "▾" : "▸"} Configure Territories
        </button>

        {territoriesOpen && (
          <div style={styles.territoryConfig}>
            {Object.entries(localTerritories).map(([name, states]) => (
              <div key={name} style={styles.territoryGroup}>
                <div style={styles.territoryHeader}>
                  <h4 style={styles.territoryName}>{name}</h4>
                  <button
                    style={styles.removeBtn}
                    onClick={() => removeTerritory(name)}
                    title="Remove territory"
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {states.map((st, i) => (
                    <span key={i} style={styles.statePill}>
                      {st}
                      <span
                        style={styles.pillRemove}
                        onClick={() => removeStateFromTerritory(name, i)}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={newStateInput[name] || ""}
                    onChange={(e) => setNewStateInput((p) => ({ ...p, [name]: e.target.value }))}
                    placeholder="e.g. GA"
                    maxLength={2}
                    style={{ ...styles.stateInput, width: 60 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addStateToTerritory(name);
                    }}
                  />
                  <button
                    style={styles.addStateBtn}
                    onClick={() => addStateToTerritory(name)}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                value={newTerritoryName}
                onChange={(e) => setNewTerritoryName(e.target.value)}
                placeholder="Territory name (e.g. Southeast)"
                style={{ ...styles.stateInput, flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTerritory();
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={addTerritory}
                style={{ fontSize: 12 }}
              >
                + Add Territory
              </button>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveTerritories}
              disabled={territorySaving}
              style={{ marginTop: 12 }}
            >
              {territorySaving ? "Saving..." : "Save Territories"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RoleBadge component ──────────────────────────────────────────

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || "#6B6B6B";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      color: "#fff",
      background: color,
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────

function Sparkline({ data = [], width = 80, height = 20 }) {
  if (!data.length || data.every((v) => v === 0)) {
    return <span style={{ fontSize: 11, color: "#6B6B6B" }}>—</span>;
  }
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke="#1F865A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = {
  section: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#2E2E2E",
    margin: 0,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid",
    marginBottom: 16,
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    background: "rgba(197, 48, 48, 0.08)",
    border: "1px solid rgba(197, 48, 48, 0.2)",
    borderRadius: 7,
    fontSize: 13,
    color: "#C53030",
    marginBottom: 12,
  },
  errorDismiss: {
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    marginLeft: 8,
  },
  successBanner: {
    padding: "8px 14px",
    background: "rgba(31, 134, 90, 0.08)",
    border: "1px solid rgba(31, 134, 90, 0.2)",
    borderRadius: 7,
    fontSize: 13,
    color: "#1F865A",
    fontWeight: 600,
    marginBottom: 12,
  },
  inviteForm: {
    background: "#FDF8F0",
    border: "1px solid #E5E0DA",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#6B6B6B",
    marginBottom: 4,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #D1CBC4",
    borderRadius: 6,
    fontSize: 13,
    background: "#fff",
  },
  inlineSelect: {
    padding: "4px 6px",
    border: "1px solid #E5E0DA",
    borderRadius: 6,
    fontSize: 12,
    background: "#fff",
    cursor: "pointer",
  },
  th: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#6B6B6B",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "1px solid #E5E0DA",
  },
  tr: {
    borderBottom: "1px solid #F5F0EB",
  },
  td: {
    padding: "10px 12px",
    fontSize: 13,
  },
  youBadge: {
    display: "inline-block",
    marginLeft: 6,
    padding: "1px 6px",
    background: "rgba(107, 30, 30, 0.08)",
    color: "#6B1E1E",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  removeBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    color: "#6B6B6B",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: 4,
    lineHeight: 1,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6B6B6B",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 8,
  },
  inviteRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 12px",
    background: "#FDF8F0",
    borderRadius: 6,
    marginBottom: 6,
    fontSize: 13,
  },
  inviteCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: "#2E2E2E",
    flex: 1,
  },
  inviteMeta: {
    fontSize: 12,
    color: "#6B6B6B",
  },
  copyBtn: {
    background: "none",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    padding: "2px 4px",
  },
  emptyState: {
    textAlign: "center",
    padding: "32px 24px",
    background: "#FDF8F0",
    borderRadius: 8,
    marginTop: 16,
  },
  emptyTitle: {
    fontFamily: "'Libre Baskerville', Georgia, serif",
    fontSize: 18,
    color: "#2E2E2E",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B6B6B",
    lineHeight: 1.6,
  },
  collapseToggle: {
    background: "none",
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    color: "#6B6B6B",
    cursor: "pointer",
    padding: "4px 0",
  },
  territoryConfig: {
    marginTop: 12,
    padding: 16,
    background: "#FDF8F0",
    border: "1px solid #E5E0DA",
    borderRadius: 8,
  },
  territoryGroup: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #E5E0DA",
  },
  territoryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  territoryName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#2E2E2E",
    margin: 0,
    fontFamily: "'Inter Tight', -apple-system, sans-serif",
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    background: "#F5EDE3",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "#2E2E2E",
  },
  pillRemove: {
    cursor: "pointer",
    color: "#6B6B6B",
    fontWeight: 700,
    fontSize: 14,
  },
  stateInput: {
    padding: "6px 10px",
    border: "1px solid #D1CBC4",
    borderRadius: 6,
    fontSize: 13,
  },
  addStateBtn: {
    padding: "6px 12px",
    background: "#1F865A",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  skeleton: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  skeletonRow: {
    height: 16,
    background: "#F5EDE3",
    borderRadius: 4,
    width: "60%",
  },
};
