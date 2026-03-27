/**
 * generateBriefingForTenant — called inline from rebuildViewsForTenant.
 * NOT a Cloud Function export. Generates AI briefing from views data.
 */

const { callClaude, extractToolResult } = require("./lib/claude");
const { computeChanges } = require("./computeChanges");

// --- Tool Schema for Claude ---

const BRIEFING_NARRATIVE_TOOL = {
  name: "briefing_narrative",
  description:
    "Write a concise AI briefing narrative for a wine/spirits supplier, " +
    "including inline sparkline placement markers and suggested follow-up questions.",
  input_schema: {
    type: "object",
    properties: {
      narrativeSegments: {
        type: "array",
        description: "Ordered array of text and sparkline segments that form the narrative",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["text", "sparkline"] },
            content: { type: "string", description: "Text content (for type=text)" },
            metric: { type: "string", description: "Metric name (for type=sparkline)" },
            dataset: { type: "string", description: "Source dataset key (for type=sparkline)" },
            field: { type: "string", description: "Field name in dataset (for type=sparkline)" },
            label: { type: "string", description: "Human-readable label (for type=sparkline)" },
          },
          required: ["type"],
        },
      },
      suggestedQuestions: {
        type: "array",
        items: { type: "string" },
        description: "3 follow-up questions the user might want to ask about their data",
      },
      actions: {
        type: "array",
        description: "Recommended actions based on the findings",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            priority: { type: "integer" },
            relatedAccount: {
              description: "Account name if action is account-specific, null otherwise",
              oneOf: [{ type: "string" }, { type: "null" }],
            },
          },
          required: ["text", "priority"],
        },
      },
    },
    required: ["narrativeSegments", "suggestedQuestions", "actions"],
  },
};

// --- System Prompt ---

const SYSTEM_PROMPT = `You are CruFolio's AI Briefing Writer for wine and spirits supplier teams.

Given structured findings about a supplier's business data, write a compelling narrative briefing. Use wine trade terminology naturally (depletions, 9L cases, placements, on-premise, off-premise, distributor, three-tier).

Rules:
- Lead with the most important finding in a single punchy sentence (this becomes the page headline)
- Be specific: name accounts, SKUs, distributors, states when the data provides them
- Use sparkline segments sparingly (1-2 max) to show inline evidence for key trends
- Suggest 3 follow-up questions the user might want to ask about their data
- Recommend 3-5 specific, actionable items (e.g., "Call Total Wine Pasadena buyer", "Check Spec's Houston inventory")
- Keep the narrative to 2-3 short paragraphs
- For first briefings (no prior data), focus on "what stands out" instead of "what changed"
- Never invent data — only reference what appears in the structured findings`;

/**
 * Verify sparkline references point to real datasets.
 */
function verifyCitations(segments, views) {
  if (!Array.isArray(segments)) return segments;

  return segments.filter((seg) => {
    if (seg.type !== "sparkline") return true;
    const dataset = views[seg.dataset];
    if (!dataset || !Array.isArray(dataset) || dataset.length === 0) return false;
    return true;
  });
}

/**
 * Generate a briefing for a tenant. Called inline from rebuild.js.
 * @returns {object|null} The briefing data, or null on failure.
 */
async function generateBriefingForTenant({ tenantId, views, db, admin, apiKey }) {
  try {
    // 1. Read previous briefing for baseline
    let previousAnalysis = null;
    const latestSnap = await db
      .collection("tenants").doc(tenantId)
      .collection("briefings").doc("latest")
      .get();

    if (latestSnap.exists && latestSnap.data()?.latestId) {
      const prevSnap = await db
        .collection("tenants").doc(tenantId)
        .collection("briefings").doc(latestSnap.data().latestId)
        .get();

      if (prevSnap.exists) {
        const prevData = prevSnap.data();
        previousAnalysis = {
          changes: prevData.changes || [],
          drillDownStats: prevData.drillDownStats || [],
          _rawStats: prevData._rawStats || {},
        };
      }
    }

    // 2. Compute changes deterministically
    const computed = computeChanges(views, previousAnalysis);

    // 3. Call Claude for narrative
    const userMessage = JSON.stringify({
      isFirstBriefing: computed.isFirstBriefing,
      changes: computed.changes,
      risks: computed.risks,
      drillDownStats: computed.drillDownStats,
      datasetSummary: {
        distScorecard: (views.distScorecard || []).length,
        accountsTop: (views.accountsTop || []).length,
        inventoryData: (views.inventoryData || []).length,
        reorderData: (views.reorderData || []).length,
        revenueSummary: (views.revenueSummary || []).length,
      },
    });

    const response = await callClaude({
      apiKey,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tools: [BRIEFING_NARRATIVE_TOOL],
      toolChoice: { type: "tool", name: "briefing_narrative" },
    });

    let narrativeSegments = [];
    let suggestedQuestions = [];
    let actions = [];

    const result = extractToolResult(response);
    if (!result.error) {
      narrativeSegments = verifyCitations(result.narrativeSegments || [], views);
      suggestedQuestions = result.suggestedQuestions || [];
      actions = result.actions || [];
    } else {
      // Fallback: no narrative, just structured data
      console.warn(`[generateBriefing] Claude failed (${result.errorType}), using deterministic fallback`);
      narrativeSegments = [
        { type: "text", content: computed.isFirstBriefing
          ? "Here's what stands out in your data."
          : "Here's what changed since your last upload."
        },
      ];
      suggestedQuestions = [
        "Which accounts have the highest volume?",
        "What's my inventory situation?",
        "Which distributors are performing best?",
      ];
    }

    // 4. Compute citation score
    const totalSegments = narrativeSegments.length;
    const sparklineCount = narrativeSegments.filter((s) => s.type === "sparkline").length;
    const citationScore = totalSegments > 0 ? Math.round((sparklineCount / totalSegments) * 100) : 0;

    // 5. Write briefing to Firestore
    const timestampId = Date.now().toString();
    const briefingData = {
      narrativeSegments,
      changes: computed.changes,
      risks: computed.risks,
      actions: actions.map((a, i) => ({
        id: `action_${timestampId}_${i}`,
        text: a.text,
        priority: a.priority || i + 1,
        relatedAccount: a.relatedAccount || null,
        completed: false,
      })),
      suggestedQuestions,
      drillDownStats: computed.drillDownStats,
      _rawStats: computed._rawStats,
      isFirstBriefing: computed.isFirstBriefing,
      citationScore,
      feedback: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection("tenants").doc(tenantId)
      .collection("briefings").doc(timestampId)
      .set(briefingData);

    // 6. Update pointer (conditional: only if newer)
    await db.runTransaction(async (tx) => {
      const latestRef = db
        .collection("tenants").doc(tenantId)
        .collection("briefings").doc("latest");

      const snap = await tx.get(latestRef);
      const currentLatestId = snap.exists ? snap.data()?.latestId : null;

      if (!currentLatestId || timestampId > currentLatestId) {
        tx.set(latestRef, { latestId: timestampId }, { merge: true });
      }
    });

    return briefingData;
  } catch (err) {
    console.error(`[generateBriefing] Error for tenant ${tenantId}:`, err.message);
    return null;
  }
}

module.exports = { generateBriefingForTenant };
