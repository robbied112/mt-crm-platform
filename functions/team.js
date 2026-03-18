/**
 * Team Cloud Functions — invite validation and join flow.
 *
 * Two callable functions:
 *   validateInvite → reads invite doc by code, returns metadata (no auth required)
 *   joinTeam       → atomic transaction: validate invite, check user limit,
 *                     set user's tenantId/role/territory, increment usedCount
 *
 * Both use Admin SDK for cross-tenant reads.
 * joinTeam is the security-critical path — all validation happens server-side.
 */

const { onCall, HttpsError, admin, db } = require("./helpers");

// ─── Plan user limits (must match frontend/src/config/plans.js) ──
const PLAN_USER_LIMITS = {
  starter: 5,
  growth: 15,
  enterprise: null, // unlimited
};

// -------------------------------------------------------------------
// validateInvite
// -------------------------------------------------------------------
// Called by the JoinPage to display invite details before the user
// decides to join. Does NOT require authentication — the invite code
// is the bearer token.
//
// Input:  { code: "uuid-string" }
// Output: { tenantId, companyName, inviterName, role, territory }
// -------------------------------------------------------------------
const validateInvite = onCall(
  { memory: "256MiB" },
  async (req) => {
    const { code } = req.data;
    if (!code) {
      throw new HttpsError("invalid-argument", "Invite code is required");
    }

    // Search all tenants' invites for this code
    const invite = await findInviteByCode(code);
    if (!invite) {
      throw new HttpsError("not-found", "Invalid invite link");
    }

    // Check expiry
    if (new Date(invite.expiresAt) < new Date()) {
      throw new HttpsError("failed-precondition", "This invite has expired");
    }

    // Check usage
    if (invite.usedCount >= invite.maxUses) {
      throw new HttpsError("failed-precondition", "This invite has been fully used");
    }

    // Fetch tenant and inviter info for display
    const tenantSnap = await db.collection("tenants").doc(invite.tenantId).get();
    const companyName = tenantSnap.exists ? tenantSnap.data().companyName || "" : "";

    let inviterName = "";
    if (invite.createdBy) {
      const inviterSnap = await db.collection("users").doc(invite.createdBy).get();
      if (inviterSnap.exists) {
        inviterName = inviterSnap.data().displayName || inviterSnap.data().email || "";
      }
    }

    return {
      tenantId: invite.tenantId,
      companyName,
      inviterName,
      role: invite.role,
      territory: invite.territory,
    };
  });

// -------------------------------------------------------------------
// joinTeam
// -------------------------------------------------------------------
// Called when a user accepts an invite. Runs as an atomic Firestore
// transaction to prevent race conditions (two people using the same
// single-use invite simultaneously).
//
// Input:  { code: "uuid-string" }
// Output: { tenantId, role, territory }
//
// Security: requires authentication. The Cloud Function uses the
// caller's auth.uid to set their user profile.
// -------------------------------------------------------------------
const joinTeam = onCall(
  { memory: "256MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to join a team");
    }

    const { code } = req.data;
    const uid = req.auth.uid;

    if (!code) {
      throw new HttpsError("invalid-argument", "Invite code is required");
    }

    // Find the invite
    const inviteResult = await findInviteByCode(code);
    if (!inviteResult) {
      throw new HttpsError("not-found", "Invalid invite link");
    }

    const { tenantId, docRef: inviteRef } = inviteResult;

    // Run everything in a transaction for atomicity
    const result = await db.runTransaction(async (txn) => {
      // Re-read invite inside transaction
      const inviteSnap = await txn.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new HttpsError("not-found", "Invite no longer exists");
      }
      const invite = inviteSnap.data();

      // Validate expiry
      if (new Date(invite.expiresAt) < new Date()) {
        throw new HttpsError("failed-precondition", "This invite has expired");
      }

      // Validate usage
      if (invite.usedCount >= invite.maxUses) {
        throw new HttpsError("failed-precondition", "This invite has been fully used");
      }

      // Check plan user limit
      const tenantSnap = await txn.get(db.collection("tenants").doc(tenantId));
      if (!tenantSnap.exists) {
        throw new HttpsError("not-found", "Team no longer exists");
      }
      const tenant = tenantSnap.data();
      const plan = tenant.subscription?.plan?.toLowerCase();
      const userLimit = plan ? PLAN_USER_LIMITS[plan] : null;

      if (userLimit !== null && userLimit !== undefined) {
        // Use memberCount on the tenant doc for transactional accuracy.
        // Falls back to 1 (the admin who created the tenant) if not set.
        const currentCount = tenant.memberCount || 1;

        if (currentCount >= userLimit) {
          throw new HttpsError(
            "resource-exhausted",
            `Team is full (${currentCount}/${userLimit} members). Ask your admin to upgrade the plan.`
          );
        }
      }

      // Set user's profile to join the team
      const userRef = db.collection("users").doc(uid);
      const userSnap = await txn.get(userRef);

      const profileData = {
        tenantId,
        role: invite.role || "rep",
        territory: invite.territory || "all",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        invitedBy: invite.createdBy || null,
      };

      if (userSnap.exists) {
        // Existing user — update their tenant
        txn.update(userRef, profileData);
      } else {
        // New user — create profile
        txn.set(userRef, {
          email: req.auth.token.email || "",
          displayName: req.auth.token.name || "",
          ...profileData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Increment invite usage and tenant member count (both transactional)
      txn.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
      });
      txn.update(db.collection("tenants").doc(tenantId), {
        memberCount: admin.firestore.FieldValue.increment(1),
      });

      return {
        tenantId,
        role: invite.role || "rep",
        territory: invite.territory || "all",
      };
    });

    return result;
  });

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Find an invite document by its code across all tenants.
 * Uses a collection group query on the 'invites' subcollection.
 *
 * @param {string} code - The invite UUID code
 * @returns {Promise<{tenantId, docRef, ...inviteData} | null>}
 */
async function findInviteByCode(code) {
  const snap = await db.collectionGroup("invites")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();
  // Extract tenantId from the document path: tenants/{tenantId}/invites/{inviteId}
  const tenantId = doc.ref.parent.parent.id;

  return { ...data, tenantId, docRef: doc.ref };
}

module.exports = { validateInvite, joinTeam };
