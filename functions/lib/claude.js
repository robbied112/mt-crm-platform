/**
 * Shared Claude API helpers — used by generateBriefing, askAboutData, and comprehend.
 * Takes admin/db as parameters (not imported) so this stays a pure utility.
 */

const Anthropic = require("@anthropic-ai/sdk");

const DEFAULT_MODEL = "claude-sonnet-4-5-20241022";
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Call Claude Messages API with tool_use support.
 * @returns {object} The API response, or { error: true, errorType: "api_failure" } on failure.
 */
async function callClaude({ apiKey, model, system, messages, tools, toolChoice, maxTokens }) {
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      system,
      messages,
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    });
    return response;
  } catch (err) {
    console.error("[claude] API error:", err.message);
    return { error: true, errorType: "api_failure", message: err.message };
  }
}

/**
 * Extract the tool_use block input from a Claude response.
 * @returns {object} The tool input, or { error: true, errorType: "no_tool_use" }.
 */
function extractToolResult(response) {
  if (response.error) return response;

  const toolUseBlock = response.content?.find((b) => b.type === "tool_use");
  if (!toolUseBlock) {
    console.error("[claude] No tool_use block in response");
    return { error: true, errorType: "no_tool_use" };
  }

  return toolUseBlock.input;
}

/**
 * Per-user rate limiting via Firestore transaction.
 * @returns {{ allowed: boolean, message?: string }}
 */
async function checkUserRateLimit({ db, admin, tenantId, userId, limitKey, maxCalls, windowMs }) {
  const ref = db
    .collection("tenants")
    .doc(tenantId)
    .collection("rateLimits")
    .doc(`${limitKey}_${userId}`);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();

      if (!snap.exists) {
        tx.set(ref, { count: 1, windowStart: now });
        return { allowed: true };
      }

      const { count, windowStart } = snap.data();

      if (now - windowStart > windowMs) {
        tx.set(ref, { count: 1, windowStart: now });
        return { allowed: true };
      }

      if (count >= maxCalls) {
        return {
          allowed: false,
          message: `Rate limit exceeded: max ${maxCalls} calls per ${Math.round(windowMs / 60000)} minutes`,
        };
      }

      tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
      return { allowed: true };
    });
    return result;
  } catch (err) {
    console.error("[claude] Rate limit check failed:", err.message);
    return { allowed: true }; // fail open — don't block on rate limit errors
  }
}

module.exports = { callClaude, extractToolResult, checkUserRateLimit };
