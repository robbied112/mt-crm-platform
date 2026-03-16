/**
 * Shared Entity Deduplication Helper
 *
 * Dedup flow:
 *   rawNames[] → normalize → exact match against existing
 *              → AI fuzzy match for unmatched
 *              → confidence routing: >0.85 auto-link, 0.5-0.85 pending, <0.5 create new
 *
 * Used by extractAccounts (accounts) and extractWines (wines from billbacks).
 */

/**
 * @param {object} options
 * @param {Set<string>} options.rawNames - Raw entity names to deduplicate
 * @param {Array<{id: string, name: string, sourceNames?: string[]}>} options.existingEntities
 * @param {function(string): string} options.normalizeFn - Normalization function for exact matching
 * @param {function(string): string} options.sanitizeFn - Sanitization function for AI prompt safety
 * @param {string} options.aiPromptPreamble - Domain-specific preamble for AI fuzzy matching
 * @param {string} options.anthropicApiKey - API key for Claude
 * @param {string} options.entityType - "account" or "wine" (for logging)
 * @param {string} options.tenantId - Tenant ID (for logging)
 * @param {string} options.importId - Import ID (for logging)
 * @returns {Promise<{linked: Array<{rawName, entityId}>, unmatched: string[], pendingMatches: Array<{newName, suggestedMatch, confidence}>}>}
 */
async function deduplicateEntities({
  rawNames,
  existingEntities,
  normalizeFn,
  sanitizeFn,
  aiPromptPreamble,
  anthropicApiKey,
  entityType = "entity",
  tenantId = "",
  importId = "",
}) {
  // Build normalized name → entity ID lookup
  const normalizedLookup = {};
  for (const entity of existingEntities) {
    for (const srcName of (entity.sourceNames || [entity.name])) {
      const normalized = normalizeFn(srcName);
      if (normalized) normalizedLookup[normalized] = entity.id;
    }
  }

  // Phase 1: Exact match
  const linked = [];
  const unmatched = [];

  for (const rawName of rawNames) {
    const normalized = normalizeFn(rawName);
    if (!normalized) continue;

    if (normalizedLookup[normalized]) {
      linked.push({ rawName, entityId: normalizedLookup[normalized] });
    } else {
      unmatched.push(rawName);
    }
  }

  // Phase 2: AI fuzzy match
  const pendingMatches = [];

  if (unmatched.length > 0 && existingEntities.length > 0 && anthropicApiKey) {
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicApiKey });

      const sanitizedUnmatched = unmatched.map(sanitizeFn).filter(Boolean);
      const existingNames = existingEntities
        .map((e) => sanitizeFn(e.name))
        .filter(Boolean)
        .slice(0, 200);

      if (sanitizedUnmatched.length > 0 && existingNames.length > 0) {
        const prompt = `${aiPromptPreamble}

NEW ${entityType.toUpperCase()}S:
${sanitizedUnmatched.map((n, i) => `${i + 1}. ${n}`).join("\n")}

EXISTING ${entityType.toUpperCase()}S:
${existingNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Return JSON array: [{ "new": "<new name>", "existing": "<existing name or null>", "confidence": 0.0-1.0 }]
If no good match, set "existing" to null and "confidence" to 0.
Return ONLY valid JSON.`;

        let aiMatches = [];
        let retries = 0;
        while (retries < 3) {
          try {
            const response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 2000,
              messages: [{ role: "user", content: prompt }],
            });

            const text = response.content[0].text.trim();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed)) {
                aiMatches = parsed.filter((m) =>
                  m && typeof m === "object" &&
                  typeof m.new === "string" &&
                  (m.existing === null || typeof m.existing === "string")
                );
              }
            }
            break;
          } catch (err) {
            retries++;
            if (retries >= 3) {
              console.error(`[deduplicateEntities] Claude failed after 3 retries for ${entityType} ${tenantId}:`, err.message);
            } else {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
            }
          }
        }

        // Process AI matches
        const matchedByAI = new Set();
        const stillUnmatched = [];

        for (const match of aiMatches) {
          if (!match || typeof match !== "object" || !match.new) continue;

          const confidence = parseFloat(match.confidence);
          const safeConfidence = isNaN(confidence) ? 0 : Math.min(1, Math.max(0, confidence));
          matchedByAI.add(match.new);

          if (match.existing && safeConfidence > 0.85) {
            const existingEntity = existingEntities.find(
              (e) => normalizeFn(e.name) === normalizeFn(match.existing)
            );
            if (existingEntity) {
              linked.push({ rawName: match.new, entityId: existingEntity.id });
              continue;
            }
          }

          if (match.existing && safeConfidence >= 0.5) {
            pendingMatches.push({
              newName: match.new,
              suggestedMatch: match.existing,
              confidence: safeConfidence,
            });
            continue;
          }

          stillUnmatched.push(match.new);
        }

        for (const name of sanitizedUnmatched) {
          if (!matchedByAI.has(name)) {
            stillUnmatched.push(name);
          }
        }

        unmatched.length = 0;
        unmatched.push(...stillUnmatched);
      }
    } catch (err) {
      console.error(`[deduplicateEntities] AI dedup failed for ${entityType} ${tenantId}:`, err.message);
    }
  }

  console.log(`[deduplicateEntities] ${entityType} ${tenantId}/${importId}: ${linked.length} linked, ${unmatched.length} unmatched, ${pendingMatches.length} pending`);
  return { linked, unmatched, pendingMatches };
}

module.exports = { deduplicateEntities };
