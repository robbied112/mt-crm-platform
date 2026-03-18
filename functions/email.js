/**
 * Email service — transactional emails for team invitations.
 *
 * Uses Resend (or falls back to logging) for invite notifications.
 * Set RESEND_API_KEY secret to enable actual delivery.
 *
 * Called from team.js joinTeam flow and can be invoked directly
 * via sendInviteEmail callable for manual re-sends.
 */

const { onCall, HttpsError, admin, db, defineSecret } = require("./helpers");

const resendApiKey = defineSecret("RESEND_API_KEY");

/**
 * Build the invite email HTML body.
 */
function buildInviteEmailHtml({ inviterName, companyName, role, territory, accountCount, joinUrl }) {
  const territoryLine = territory && territory !== "all"
    ? `<p style="margin:0 0 8px;color:#6B6B6B;font-size:14px;">You'll be covering the <strong>${territory}</strong> territory${accountCount ? ` — ${accountCount} accounts are ready for you` : ""}.</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FDF8F0;font-family:'Inter',-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#6B1E1E;padding:24px 32px;">
      <h1 style="margin:0;color:#FFFFFF;font-family:'Libre Baskerville',Georgia,serif;font-size:20px;font-weight:400;">
        You're invited to CruFolio
      </h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#2E2E2E;">
        <strong>${inviterName || "Your colleague"}</strong> invited you to join
        <strong>${companyName || "their team"}</strong> on CruFolio.
      </p>
      <p style="margin:0 0 8px;color:#6B6B6B;font-size:14px;">
        Your role: <strong style="color:#2E2E2E;">${role || "Rep"}</strong>
      </p>
      ${territoryLine}
      <div style="margin:24px 0;text-align:center;">
        <a href="${joinUrl}" style="display:inline-block;padding:12px 32px;background:#6B1E1E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
          Join the Team
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#6B6B6B;text-align:center;">
        This invite expires in 7 days. If you didn't expect this email, you can ignore it.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Build plain-text version.
 */
function buildInviteEmailText({ inviterName, companyName, role, territory, accountCount, joinUrl }) {
  let text = `${inviterName || "Your colleague"} invited you to join ${companyName || "their team"} on CruFolio.\n\n`;
  text += `Your role: ${role || "Rep"}\n`;
  if (territory && territory !== "all") {
    text += `Territory: ${territory}`;
    if (accountCount) text += ` (${accountCount} accounts ready)`;
    text += "\n";
  }
  text += `\nJoin here: ${joinUrl}\n\nThis invite expires in 7 days.`;
  return text;
}

/**
 * Send invite email via Resend API.
 * Falls back to console logging if RESEND_API_KEY is not configured.
 */
async function sendInviteEmailInternal({ to, inviterName, companyName, role, territory, accountCount, joinUrl }) {
  const apiKey = resendApiKey.value();

  const html = buildInviteEmailHtml({ inviterName, companyName, role, territory, accountCount, joinUrl });
  const text = buildInviteEmailText({ inviterName, companyName, role, territory, accountCount, joinUrl });

  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not set — logging email instead of sending");
    console.log("[email] To:", to);
    console.log("[email] Subject:", `${inviterName || "Someone"} invited you to ${companyName || "CruFolio"}`);
    console.log("[email] Body (text):", text);
    return { sent: false, reason: "no_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CruFolio <noreply@crufolio.com>",
      to: [to],
      subject: `${inviterName || "Someone"} invited you to ${companyName || "CruFolio"}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[email] Resend API error:", response.status, err);
    throw new Error(`Email delivery failed: ${response.status}`);
  }

  const result = await response.json();
  console.log("[email] Sent invite to", to, "id:", result.id);
  return { sent: true, id: result.id };
}

/**
 * Callable function: send invite email to a specific address.
 * Used from the frontend when admin enters an email for a specific invite.
 */
const sendInviteEmail = onCall(
  { secrets: [resendApiKey], memory: "256MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { email, inviteCode, tenantId } = req.data;
    if (!email || !inviteCode || !tenantId) {
      throw new HttpsError("invalid-argument", "Missing email, inviteCode, or tenantId");
    }

    // Verify caller is admin/manager of this tenant
    const callerDoc = await db.doc(`users/${req.auth.uid}`).get();
    const callerData = callerDoc.data();
    if (!callerData || callerData.tenantId !== tenantId || (callerData.role !== "admin" && callerData.role !== "manager")) {
      throw new HttpsError("permission-denied", "Only admins and managers can send invite emails");
    }

    // Find the invite
    const inviteSnap = await db.collectionGroup("invites")
      .where("code", "==", inviteCode)
      .limit(1)
      .get();

    if (inviteSnap.empty) {
      throw new HttpsError("not-found", "Invite not found");
    }

    const invite = inviteSnap.docs[0].data();

    // Get tenant info
    const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
    const tenantData = tenantDoc.data() || {};

    // Count accounts in territory for context
    let accountCount = 0;
    if (invite.territory && invite.territory !== "all") {
      const territories = tenantData.territories || {};
      const states = territories[invite.territory] || [];
      if (states.length > 0) {
        const accountsSnap = await db.collection(`tenants/${tenantId}/accounts`)
          .where("state", "in", states.slice(0, 10)) // Firestore 'in' limit
          .get();
        accountCount = accountsSnap.size;
      }
    }

    const joinUrl = `https://app.crufolio.com/join/${inviteCode}`;

    return sendInviteEmailInternal({
      to: email,
      inviterName: callerData.displayName || callerData.email?.split("@")[0],
      companyName: tenantData.companyName,
      role: invite.role ? invite.role.charAt(0).toUpperCase() + invite.role.slice(1) : "Rep",
      territory: invite.territory,
      accountCount,
      joinUrl,
    });
  }
);

module.exports = { sendInviteEmail, sendInviteEmailInternal, buildInviteEmailHtml, buildInviteEmailText };
