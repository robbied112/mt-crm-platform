const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { DATASETS, CHUNK_SIZE } = require("./lib/pipeline/index");

admin.initializeApp();
const db = admin.firestore();

// ─── Secrets ─────────────────────────────────────────────────────
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const googleClientId = defineSecret("GOOGLE_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_CLIENT_SECRET");

// ─── Constants ───────────────────────────────────────────────────

const INTERNAL_FIELDS = [
  { field: "acct",       label: "Account / Customer Name" },
  { field: "dist",       label: "Distributor / Wholesaler" },
  { field: "st",         label: "State" },
  { field: "ch",         label: "Channel" },
  { field: "sku",        label: "Product / SKU / Item" },
  { field: "qty",        label: "Quantity / Volume" },
  { field: "date",       label: "Date / Period" },
  { field: "revenue",    label: "Revenue / Amount" },
  { field: "stage",      label: "Pipeline Stage" },
  { field: "owner",      label: "Owner / Sales Rep" },
  { field: "estValue",   label: "Deal Value" },
  { field: "oh",         label: "On Hand (Inventory)" },
  { field: "doh",        label: "Days on Hand" },
  { field: "lastOrder",  label: "Last Order Date" },
  { field: "orderCycle", label: "Order Cycle" },
];

// ─── Extracted Helpers (were duplicated 3-4x) ───────────────────

/**
 * Verify that the authenticated user belongs to the specified tenant.
 * @throws {HttpsError} if not a member
 */
async function verifyTenantMembership(uid, tenantId) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data().tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Not a member of this tenant");
  }
  return userSnap.data();
}

/**
 * Build the AI mapping prompt for column detection.
 * @param {string[]} headers - Column headers
 * @param {object[]} rows - Sample rows (first 8 used)
 * @param {string} userRole - "supplier" or "distributor"
 * @returns {string} The prompt text
 */
function buildAIPrompt(headers, rows, userRole) {
  const roleContext = userRole === "distributor"
    ? "You are a data mapping expert for a beverage/CPG distributor CRM. The user is a distributor tracking suppliers/vendors and their own stores/locations."
    : "You are a data mapping expert for a beverage/CPG supplier CRM. The user is a supplier tracking distributors and retail accounts.";

  const table = [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.slice(0, 8).map((r) => headers.map((h) => String(r[h] ?? "").slice(0, 40)).join(" | ")),
  ].join("\n");

  return `${roleContext} Map each column to an internal field.

INTERNAL FIELDS:
${INTERNAL_FIELDS.map((f) => `  ${f.field}: ${f.label}`).join("\n")}

SOURCE DATA:
${table}

Return JSON: { "mapping": { "<field>": "<column>" }, "monthColumns": [], "weekColumns": [], "uploadType": "quickbooks"|"depletion"|"sales"|"purchases"|"inventory"|"pipeline"|"unknown", "confidence": { "<field>": 0.0-1.0 } }

Return ONLY valid JSON.`;
}

/**
 * Safely parse JSON from an AI response text.
 * @param {string} text - Raw AI response
 * @returns {object} Parsed JSON
 * @throws {HttpsError} if no valid JSON found or parse fails
 */
function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new HttpsError("internal", "AI returned no valid JSON");
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new HttpsError("internal", `AI returned invalid JSON: ${err.message}`);
  }
}

/**
 * Sanitize account name for safe use in AI prompts.
 * Prevents prompt injection and normalizes for matching.
 */
function sanitizeAccountName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/[<>{}[\]\\|`~!@#$%^&*()+=;:'"]/g, "")
    .trim()
    .slice(0, 100);
}

/**
 * Normalize account name for exact-match comparison.
 * Lowercase, strip whitespace, remove common suffixes.
 */
function normalizeAccountName(name) {
  return sanitizeAccountName(name)
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|group|enterprises?|holdings?)\b\.?/gi, "")
    .replace(/[.,\-']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------------------------------------------
// Helper: Find tenant by Stripe customer ID
// -------------------------------------------------------------------
async function findTenantByCustomerId(customerId) {
  if (!customerId) return null;

  const snap = await db.collection("tenants")
    .where("subscription.customerId", "==", customerId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  return null;
}

module.exports = {
  onCall,
  onRequest,
  onSchedule,
  HttpsError,
  admin,
  db,
  defineSecret,
  anthropicApiKey,
  stripeWebhookSecret,
  stripeSecretKey,
  googleClientId,
  googleClientSecret,
  verifyTenantMembership,
  buildAIPrompt,
  parseAIResponse,
  INTERNAL_FIELDS,
  DATASETS,
  CHUNK_SIZE,
  sanitizeAccountName,
  normalizeAccountName,
  findTenantByCustomerId,
};
