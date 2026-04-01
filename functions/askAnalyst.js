/**
 * askAnalyst — follow-up Q&A Cloud Function for the AI Wine Analyst.
 *
 * Takes a user question + tenantId, loads the current blueprint context
 * and cached data profile, asks Claude to answer, and returns the response.
 * Conversation history is passed from the client for multi-turn context.
 */

const {
  onCall,
  HttpsError,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
} = require("./helpers");

const { callClaude, checkUserRateLimit } = require("./lib/claude");

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT_LENGTH = 2000;
const ASK_RATE_LIMIT = 20;
const ASK_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CruFolio's AI Wine Analyst — a domain expert in the wine and spirits three-tier distribution system. You're having a conversation with a wine supplier about their data.

You have access to their data profile (column statistics, sample values, row counts) and their current dashboard analysis. Answer questions specifically about THEIR data — reference actual account names, SKUs, states, distributors, and numbers from the data profile.

RULES:
- Be specific: cite actual numbers, account names, and SKUs from the data
- Use **bold** for account names, SKU names, and key metrics
- Include actual percentage changes and numbers when available
- Keep answers concise — 2-4 short paragraphs max
- If the data doesn't contain what they're asking about, say so clearly
- Use wine industry terminology naturally (depletions, 9L cases, DOH, velocity, placements)
- Never invent data — only reference what appears in the data profile
- Format numbers nicely (e.g., 1,234 not 1234)
- When suggesting actions, be specific (e.g., "Call the buyer at **Total Wine Pasadena**" not "Follow up with accounts")`;

// ─── Core Logic ─────────────────────────────────────────────────────────────

async function askAnalystForTenant({ tenantId, question, history }) {
  // 1. Load active pointer (includes cached data profile from analyzeUpload)
  const activeRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("reportBlueprints")
    .doc("active");
  const activeSnap = await activeRef.get();
  const activeData = activeSnap.data();

  let blueprintContext = null;
  if (activeData?.blueprintId) {
    const bpRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("reportBlueprints")
      .doc(activeData.blueprintId);
    const bpSnap = await bpRef.get();
    if (bpSnap.exists) {
      const bp = bpSnap.data();
      blueprintContext = {
        name: bp.name,
        narrative: bp.narrative,
        tabs: (bp.tabs || []).map((t) => ({ id: t.id, label: t.label })),
        dataSources: bp.dataSources,
        totalRows: bp.totalRows,
      };
    }
  }

  // 2. Read cached data profile (written by analyzeUpload, no import re-reads needed)
  const dataProfileSummary = activeData?.cachedDataProfile || null;

  // 3. Build messages with conversation history
  const messages = [];

  // Context message (always first)
  const contextParts = [];
  if (blueprintContext) {
    contextParts.push(`CURRENT ANALYSIS:\n${JSON.stringify(blueprintContext)}`);
  }
  if (dataProfileSummary) {
    contextParts.push(`DATA PROFILE:\n${JSON.stringify(dataProfileSummary)}`);
  }

  if (contextParts.length > 0) {
    messages.push({
      role: "user",
      content: `[Context for your reference — do not repeat this back]\n\n${contextParts.join("\n\n")}`,
    });
    messages.push({
      role: "assistant",
      content: "I have your data context. What would you like to know?",
    });
  }

  // Conversation history (previous Q&A turns, validated)
  if (history?.length) {
    for (const turn of history.slice(-MAX_HISTORY_TURNS)) {
      if (
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.length > 0 &&
        turn.content.length <= MAX_HISTORY_CONTENT_LENGTH
      ) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }

  // Current question
  messages.push({ role: "user", content: question });

  // 4. Call Claude
  const apiKey = anthropicApiKey.value();
  const response = await callClaude({
    apiKey,
    model: "claude-sonnet-4-5-20241022",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 2048,
  });

  if (response.error) {
    throw new HttpsError("internal", "AI analysis failed. Try again.");
  }

  // Extract text response
  const textBlock = response.content?.find((b) => b.type === "text");
  const answer = textBlock?.text || "I couldn't generate a response. Please try again.";

  return { answer };
}

// ─── Cloud Function Export ───────────────────────────────────────────────────

const askAnalyst = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, question, history } = req.data;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId required");
    }
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      throw new HttpsError("invalid-argument", "question required");
    }
    if (question.length > 500) {
      throw new HttpsError("invalid-argument", "Question too long (max 500 characters)");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    const { allowed, message } = await checkUserRateLimit({
      db,
      admin,
      tenantId,
      userId: req.auth.uid,
      limitKey: "askAnalyst",
      maxCalls: ASK_RATE_LIMIT,
      windowMs: ASK_RATE_WINDOW_MS,
    });
    if (!allowed) {
      throw new HttpsError("resource-exhausted", message);
    }

    return askAnalystForTenant({
      tenantId,
      question: question.trim(),
      history: Array.isArray(history) ? history : [],
    });
  }
);

module.exports = { askAnalyst, askAnalystForTenant };
