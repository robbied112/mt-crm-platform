/**
 * Weekly Digest — scheduled Cloud Function that generates and emails
 * a weekly summary to each tenant's users.
 *
 * Reads latest views data, generates a concise AI summary via Claude Sonnet,
 * and delivers via Resend. Runs every Sunday at 6 AM Pacific.
 *
 * Firestore:
 *   tenants/{tenantId}/digests/{digestId} — digest history
 *   users/{uid}.digestOptOut — per-user opt-out flag
 */

const { onSchedule, HttpsError, admin, db, defineSecret, anthropicApiKey } = require("./helpers");
const {
  readChunked,
  createAdminFirestoreAdapter,
} = require("./lib/pipeline/firestore");

const resendApiKey = defineSecret("RESEND_API_KEY");

// ─── Helpers ──────────────────────────────────────────────────────

const firestoreAdapter = createAdminFirestoreAdapter({ admin, db });

/**
 * Load view data for a tenant (summary + sample rows from top datasets).
 */
async function loadDigestData(tenantId) {
  const summarySnap = await db.doc(`tenants/${tenantId}/views/_summary`).get();
  const summary = summarySnap.exists ? summarySnap.data() : null;

  // Load key datasets (capped for token budget)
  const datasets = {};
  const keyDatasets = ["distScorecard", "reorderData", "inventoryData", "pipelineAccounts", "revenueByChannel"];
  await Promise.all(
    keyDatasets.map(async (name) => {
      try {
        const rows = await readChunked(db, ["tenants", tenantId, "views", name], {
          adapter: firestoreAdapter,
          emptyValue: [],
        });
        datasets[name] = rows.slice(0, 50); // Cap for token budget
      } catch {
        datasets[name] = [];
      }
    })
  );

  return { summary, datasets };
}

/**
 * Generate a digest summary using Claude Sonnet.
 */
async function generateDigestSummary(tenantData, companyName, apiKey) {
  const { summary, datasets } = tenantData;

  const dataProfile = [];
  if (datasets.distScorecard?.length > 0) {
    const totalCases = datasets.distScorecard.reduce((s, d) => s + (d.ce || 0), 0);
    const topAccts = datasets.distScorecard.slice(0, 5).map((d) => d.acct || d.name).filter(Boolean);
    dataProfile.push(`Depletions: ${datasets.distScorecard.length} accounts, ${Math.round(totalCases)} total cases. Top: ${topAccts.join(", ")}`);
  }
  if (datasets.reorderData?.length > 0) {
    const overdue = datasets.reorderData.filter((r) => r.days > r.cycle && r.cycle > 0);
    dataProfile.push(`Reorders: ${overdue.length} overdue out of ${datasets.reorderData.length} tracked`);
  }
  if (datasets.inventoryData?.length > 0) {
    const lowStock = datasets.inventoryData.filter((i) => (i.doh || 0) < 14);
    dataProfile.push(`Inventory: ${lowStock.length} SKUs below 14 DOH out of ${datasets.inventoryData.length}`);
  }
  if (datasets.pipelineAccounts?.length > 0) {
    dataProfile.push(`Pipeline: ${datasets.pipelineAccounts.length} active deals`);
  }
  if (datasets.revenueByChannel?.length > 0) {
    const totalRev = datasets.revenueByChannel.reduce((s, r) => s + (r.total || r.revenue || 0), 0);
    dataProfile.push(`Revenue: $${Math.round(totalRev).toLocaleString()} across ${datasets.revenueByChannel.length} channels`);
  }

  if (dataProfile.length === 0) return null;

  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are the AI assistant for ${companyName || "a wine & spirits team"} using CruFolio.

Write a weekly email digest (150 words max). Be specific — use real numbers and account names from the data. Structure:
1. One-sentence headline (the single most important thing)
2. 2-3 bullet points: top movers, overdue reorders, pipeline/inventory alerts
3. One action item for the week

Data snapshot:
${dataProfile.join("\n")}
${summary?.text ? `\nPrevious summary: ${summary.text}` : ""}

Write in a warm, concise tone. No emojis. Use bold (**text**) for emphasis. Start with the headline directly.`,
      },
    ],
  });

  return response.content[0]?.text || null;
}

/**
 * Build digest email HTML.
 */
function buildDigestEmailHtml({ companyName, digestText, weekOf }) {
  // Escape HTML entities first, then apply markdown formatting
  const escaped = (digestText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const htmlBody = escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n<li>")
    .replace(/\n(\d+)\. /g, "\n<li>")
    .split("\n")
    .map((line) => {
      if (line.startsWith("<li>")) return line + "</li>";
      if (line.trim() === "") return "<br/>";
      return `<p style="margin:0 0 8px;font-size:14px;color:#2E2E2E;line-height:1.6;">${line}</p>`;
    })
    .join("\n");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FDF8F0;font-family:'Inter',-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#6B1E1E;padding:24px 32px;">
      <h1 style="margin:0;color:#FFFFFF;font-family:'Libre Baskerville',Georgia,serif;font-size:20px;font-weight:400;">
        Weekly Digest — ${companyName || "CruFolio"}
      </h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Week of ${weekOf}</p>
    </div>
    <div style="padding:32px;">
      ${htmlBody}
      <div style="margin:24px 0;text-align:center;">
        <a href="https://app.crufolio.com" style="display:inline-block;padding:12px 32px;background:#6B1E1E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
          Open CruFolio
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#FDF8F0;border-top:1px solid #E5E0DA;">
      <p style="margin:0;font-size:11px;color:#6B6B6B;text-align:center;">
        You're receiving this because you're on the ${companyName || "CruFolio"} team.
        Reply to this email if you'd like to opt out.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Send digest email via Resend.
 */
async function sendDigestEmail({ to, companyName, digestText, weekOf, resendKey }) {
  if (!resendKey) {
    console.log("[digest] RESEND_API_KEY not set — skipping email to", to);
    return { sent: false, reason: "no_api_key" };
  }

  const html = buildDigestEmailHtml({ companyName, digestText, weekOf });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CruFolio <digest@crufolio.com>",
      to: [to],
      subject: `Your week in review — ${companyName || "CruFolio"}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[digest] Resend API error:", response.status, err);
    return { sent: false, reason: `api_error_${response.status}` };
  }

  const result = await response.json();
  return { sent: true, id: result.id };
}

// ─── Scheduled Function ────────────────────────────────────────────

const generateWeeklyDigest = onSchedule(
  {
    schedule: "every sunday 06:00",
    timeZone: "America/Los_Angeles",
    secrets: [anthropicApiKey, resendApiKey],
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("[digest] Starting weekly digest generation...");

    // Get all tenants
    const tenantsSnap = await db.collection("tenants").get();
    const weekOf = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    let processed = 0;
    let emailed = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();

      // Skip tenants without active subscription or with digest disabled
      const sub = tenantData.subscription || {};
      if (sub.status === "cancelled") continue;

      try {
        // Load data for this tenant
        const digestData = await loadDigestData(tenantId);
        const hasData = Object.values(digestData.datasets).some((d) => d.length > 0);
        if (!hasData) {
          console.log(`[digest] Skipping tenant ${tenantId} — no data`);
          continue;
        }

        // Generate AI summary
        const apiKey = anthropicApiKey.value();
        if (!apiKey) {
          console.warn("[digest] ANTHROPIC_API_KEY not set");
          break;
        }

        const digestText = await generateDigestSummary(
          digestData,
          tenantData.companyName,
          apiKey,
        );

        if (!digestText) {
          console.log(`[digest] No digest generated for tenant ${tenantId}`);
          continue;
        }

        // Save digest to history
        await db.collection(`tenants/${tenantId}/digests`).add({
          text: digestText,
          weekOf,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        processed++;

        // Find all users for this tenant who haven't opted out
        const usersSnap = await db
          .collection("users")
          .where("tenantId", "==", tenantId)
          .get();

        const resendKey = resendApiKey.value();

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data();
          if (userData.digestOptOut) continue;
          if (!userData.email) continue;

          const result = await sendDigestEmail({
            to: userData.email,
            companyName: tenantData.companyName,
            digestText,
            weekOf,
            resendKey,
          });

          if (result.sent) emailed++;
        }
      } catch (err) {
        console.error(`[digest] Error processing tenant ${tenantId}:`, err.message);
        // Continue with next tenant
      }
    }

    console.log(`[digest] Done — ${processed} tenants processed, ${emailed} emails sent`);
  },
);

module.exports = { generateWeeklyDigest };
