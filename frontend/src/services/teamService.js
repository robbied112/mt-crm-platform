/**
 * Team Service — Firestore CRUD for invites and team member management.
 *
 * Invite flow:
 *   1. Admin creates invite → teamService.createInvite()
 *   2. Recipient clicks link → teamService.getInvite() to validate
 *   3. Recipient joins → Cloud Function joinTeam (server-side transaction)
 */

import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, where, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ─── Invites ──────────────────────────────────────────────────────

/**
 * Create an invite link for a tenant.
 * @param {string} tenantId
 * @param {object} options
 * @param {string} options.role - Role to assign (admin/manager/rep/viewer)
 * @param {string} [options.territory] - Territory to assign
 * @param {number} [options.maxUses=1] - Max number of uses
 * @param {number} [options.expiryDays=7] - Days until expiry
 * @param {string} options.createdBy - UID of the admin creating the invite
 * @returns {Promise<{id: string, code: string}>}
 */
export async function createInvite(tenantId, { role, territory, maxUses = 1, expiryDays = 7, createdBy }) {
  const code = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const inviteData = {
    code,
    tenantId,
    role: role || "rep",
    territory: territory || "all",
    maxUses,
    usedCount: 0,
    expiresAt: expiresAt.toISOString(),
    createdBy,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "tenants", tenantId, "invites"), inviteData);
  return { id: ref.id, code };
}

/**
 * Get an invite by its code (for the join page to validate).
 * Searches across all tenants' invite subcollections via a known tenantId.
 * In practice, the invite code is globally unique so we store tenantId in the invite.
 *
 * For the join page, we use a Cloud Function to look up the invite by code.
 * This client-side version is for admin UI to list their own invites.
 */
export async function listInvites(tenantId) {
  const q = query(
    collection(db, "tenants", tenantId, "invites"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Delete (revoke) an invite.
 */
export async function deleteInvite(tenantId, inviteId) {
  await deleteDoc(doc(db, "tenants", tenantId, "invites", inviteId));
}

// ─── Team Members ─────────────────────────────────────────────────

/**
 * List all users belonging to a tenant.
 */
export async function listTeamMembers(tenantId) {
  const q = query(
    collection(db, "users"),
    where("tenantId", "==", tenantId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
