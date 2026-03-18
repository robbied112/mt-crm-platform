/**
 * TeamContext — provides team member list, invite management, and role/territory updates.
 *
 * Parallel to CrmContext in the provider tree. Depends on AuthContext for tenantId.
 * Only loads when tenantId is available. Admin-only operations (invite CRUD, role changes)
 * are gated by usePermissions in the consuming components.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";
import { createInvite, listInvites, deleteInvite } from "../services/teamService";

const TeamContext = createContext(null);

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}

export default function TeamProvider({ children }) {
  const { tenantId, currentUser } = useAuth();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener for team members
  useEffect(() => {
    if (!tenantId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users"),
      where("tenantId", "==", tenantId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setMembers(data);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load team members:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, [tenantId]);

  // Load invites (non-realtime — refresh on demand)
  const refreshInvites = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await listInvites(tenantId);
      setInvites(data);
    } catch (err) {
      console.error("Failed to load invites:", err);
    }
  }, [tenantId]);

  // Load invites on mount
  useEffect(() => {
    refreshInvites();
  }, [refreshInvites]);

  // ─── Invite CRUD ────────────────────────────────────────────────

  const generateInvite = useCallback(async ({ role, territory, maxUses }) => {
    if (!tenantId || !currentUser) return null;
    const result = await createInvite(tenantId, {
      role,
      territory,
      maxUses,
      createdBy: currentUser.uid,
    });
    await refreshInvites();
    return result;
  }, [tenantId, currentUser, refreshInvites]);

  const revokeInvite = useCallback(async (inviteId) => {
    if (!tenantId) return;
    await deleteInvite(tenantId, inviteId);
    await refreshInvites();
  }, [tenantId, refreshInvites]);

  // ─── Member management ─────────────────────────────────────────

  const updateMemberRole = useCallback(async (uid, newRole) => {
    // Prevent last admin demotion
    if (newRole !== "admin") {
      const adminCount = members.filter((m) => m.role === "admin").length;
      const isTargetAdmin = members.find((m) => m.uid === uid)?.role === "admin";
      if (isTargetAdmin && adminCount <= 1) {
        throw new Error("Cannot remove the last admin. Promote another member first.");
      }
    }
    await updateDoc(doc(db, "users", uid), { role: newRole });
  }, [members]);

  const updateMemberTerritory = useCallback(async (uid, territory) => {
    await updateDoc(doc(db, "users", uid), { territory });
  }, []);

  const assignManager = useCallback(async (uid, managerId) => {
    await updateDoc(doc(db, "users", uid), { managerId: managerId || null });
  }, []);

  const removeMember = useCallback(async (uid) => {
    // Prevent removing last admin
    const member = members.find((m) => m.uid === uid);
    if (member?.role === "admin") {
      const adminCount = members.filter((m) => m.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin.");
      }
    }
    // Remove user from tenant by clearing their tenantId
    await updateDoc(doc(db, "users", uid), {
      tenantId: null,
      role: null,
      territory: null,
      removedAt: serverTimestamp(),
    });
    // Decrement tenant member count
    if (tenantId) {
      const { increment } = await import("firebase/firestore");
      await updateDoc(doc(db, "tenants", tenantId), {
        memberCount: increment(-1),
      });
    }
  }, [members, tenantId]);

  // uid → display name map for attribution labels
  const memberMap = useMemo(() => {
    const map = {};
    for (const m of members) {
      map[m.uid] = m.displayName || m.email?.split("@")[0] || "Unknown";
    }
    return map;
  }, [members]);

  // Manager hierarchy helpers
  const getDirectReports = useCallback((managerId) => {
    return members.filter((m) => m.managerId === managerId);
  }, [members]);

  const managers = useMemo(() => {
    return members.filter((m) => m.role === "admin" || m.role === "manager");
  }, [members]);

  const value = {
    members,
    memberMap,
    invites,
    loading,
    memberCount: members.length,
    generateInvite,
    revokeInvite,
    refreshInvites,
    updateMemberRole,
    updateMemberTerritory,
    assignManager,
    removeMember,
    getDirectReports,
    managers,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}
