const {
  functions,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
  sanitizeAccountName,
  normalizeAccountName,
} = require("./helpers");

// -------------------------------------------------------------------
// Extract Accounts — auto-extract CRM entities from normalized imports
// -------------------------------------------------------------------
// On each import, extracts unique account names, normalizes them, and
// creates/updates accounts/{id} documents. Uses Claude for fuzzy matching
// against existing accounts.
//
// Confidence thresholds:
//   >0.85 → auto-link to existing account
//   0.5-0.85 → pending review queue
//   <0.5 → create new account
// -------------------------------------------------------------------

/**
 * Create a new account document from import data.
 */
async function createAccount(tenantId, name, importId, rows) {
  const sanitized = sanitizeAccountName(name);
  if (!sanitized) return;

  // Extract metadata from rows for this account
  const accountRows = rows.filter((r) => (r.acct || "").trim() === name);
  const states = [...new Set(accountRows.map((r) => r.st).filter(Boolean))];
  const distributors = [...new Set(accountRows.map((r) => r.dist).filter(Boolean))];
  const channels = [...new Set(accountRows.map((r) => r.ch).filter(Boolean))];

  const accountRef = db.collection("tenants").doc(tenantId).collection("accounts").doc();
  await accountRef.set({
    name: sanitized,
    normalizedName: normalizeAccountName(name),
    displayName: sanitized,
    sourceNames: [name],
    firstSeen: admin.firestore.FieldValue.serverTimestamp(),
    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      state: states[0] || "",
      distributor: distributors[0] || "",
      channel: channels[0] || "",
      states,
      distributors,
      channels,
    },
    importIds: [importId],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const extractAccounts = functions
  .runWith({ secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, importId } = data;
    if (!tenantId || !importId) {
      throw new functions.https.HttpsError("invalid-argument", "tenantId and importId required");
    }

    await verifyTenantMembership(context.auth.uid, tenantId);

    // ── Load import rows ──
    const importRef = db.collection("tenants").doc(tenantId).collection("imports").doc(importId);
    const importSnap = await importRef.get();
    if (!importSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Import not found");
    }

    const rowsSnap = await importRef.collection("rows").get();
    const rows = rowsSnap.docs
      .map((d) => ({ idx: d.data().idx, items: d.data().items }))
      .sort((a, b) => a.idx - b.idx)
      .flatMap((c) => c.items);

    // ── Extract unique account names ──
    const rawNames = new Set();
    for (const row of rows) {
      const name = (row.acct || "").trim();
      if (name) rawNames.add(name);
    }

    if (rawNames.size === 0) {
      console.warn(`[extractAccounts] ${tenantId}/${importId}: No account names found (empty 'acct' column)`);
      return { status: "skipped", reason: "no_accounts", created: 0, linked: 0, pending: 0 };
    }

    // ── Load existing accounts ──
    const accountsSnap = await db.collection("tenants").doc(tenantId).collection("accounts").get();
    const existingAccounts = accountsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Build normalized name → account ID lookup
    const normalizedLookup = {};
    for (const acct of existingAccounts) {
      for (const srcName of (acct.sourceNames || [acct.name])) {
        normalizedLookup[normalizeAccountName(srcName)] = acct.id;
      }
    }

    // ── Phase 1: Exact match ──
    const unmatched = [];
    const linked = [];

    for (const rawName of rawNames) {
      const normalized = normalizeAccountName(rawName);
      if (!normalized) continue;

      if (normalizedLookup[normalized]) {
        // Exact match — link to existing account
        linked.push({ rawName, accountId: normalizedLookup[normalized] });
      } else {
        unmatched.push(rawName);
      }
    }

    // ── Phase 2: AI fuzzy match for unmatched names ──
    let created = 0;
    let pendingCount = 0;

    if (unmatched.length > 0 && existingAccounts.length > 0) {
      const apiKey = anthropicApiKey.value();
      if (apiKey) {
        try {
          const Anthropic = require("@anthropic-ai/sdk");
          const client = new Anthropic({ apiKey });

          // Sanitize names for prompt safety
          const sanitizedUnmatched = unmatched.map(sanitizeAccountName).filter(Boolean);
          const existingNames = existingAccounts
            .map((a) => sanitizeAccountName(a.name))
            .filter(Boolean)
            .slice(0, 200); // Limit to prevent prompt overflow

          if (sanitizedUnmatched.length > 0 && existingNames.length > 0) {
            const prompt = `You are a data deduplication expert for a wine/beverage industry CRM.

Match each NEW account name to the most similar EXISTING account name. Consider:
- Abbreviations (e.g., "St." = "Saint", "Ave" = "Avenue")
- Business suffixes (Inc, LLC, Corp) should be ignored
- Common misspellings and typos
- Partial matches (e.g., "The Wine Bar" ~ "Wine Bar & Grill")

NEW ACCOUNTS:
${sanitizedUnmatched.map((n, i) => `${i + 1}. ${n}`).join("\n")}

EXISTING ACCOUNTS:
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
                  // Validate shape: must be array of { new: string, existing: string|null, confidence: number }
                  if (Array.isArray(parsed)) {
                    aiMatches = parsed.filter((m) =>
                      m && typeof m === "object" &&
                      typeof m.new === "string" &&
                      (m.existing === null || typeof m.existing === "string")
                    );
                  }
                }
                break; // Success
              } catch (err) {
                retries++;
                if (retries >= 3) {
                  console.error(`[extractAccounts] Claude failed after 3 retries for ${tenantId}:`, err.message);
                  // Fall through — all unmatched become new accounts
                } else {
                  // Exponential backoff
                  await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
                }
              }
            }

            // Process AI matches
            const matchedByAI = new Set();
            for (const match of aiMatches) {
              if (!match || typeof match !== "object") continue;

              const confidence = parseFloat(match.confidence);
              const safeConfidence = isNaN(confidence) ? 0 : Math.min(1, Math.max(0, confidence));
              const newName = match.new;
              const existingName = match.existing;

              if (!newName) continue;
              matchedByAI.add(newName);

              if (existingName && safeConfidence > 0.85) {
                // Auto-link: find the existing account by name
                const existingAcct = existingAccounts.find(
                  (a) => normalizeAccountName(a.name) === normalizeAccountName(existingName)
                );
                if (existingAcct) {
                  linked.push({ rawName: newName, accountId: existingAcct.id });
                  // Add source name to existing account
                  await db.collection("tenants").doc(tenantId)
                    .collection("accounts").doc(existingAcct.id)
                    .update({
                      sourceNames: admin.firestore.FieldValue.arrayUnion(newName),
                      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                      importIds: admin.firestore.FieldValue.arrayUnion(importId),
                    });
                  continue;
                }
              }

              if (existingName && safeConfidence >= 0.5) {
                // Pending review
                await db.collection("tenants").doc(tenantId)
                  .collection("pendingMatches").add({
                    newName,
                    suggestedMatch: existingName,
                    confidence: safeConfidence,
                    importId,
                    status: "pending",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                pendingCount++;
                continue;
              }

              // Low confidence — create new account
              await createAccount(tenantId, newName, importId, rows);
              created++;
            }

            // Any unmatched names that AI didn't return results for — create new
            for (const name of sanitizedUnmatched) {
              if (!matchedByAI.has(name)) {
                await createAccount(tenantId, name, importId, rows);
                created++;
              }
            }
          } else {
            // No sanitized names or no existing accounts to match against
            for (const name of unmatched) {
              await createAccount(tenantId, name, importId, rows);
              created++;
            }
          }
        } catch (err) {
          console.error(`[extractAccounts] AI dedup failed for ${tenantId}:`, err.message);
          // Fallback: create all unmatched as new accounts
          for (const name of unmatched) {
            await createAccount(tenantId, name, importId, rows);
            created++;
          }
        }
      } else {
        // No API key — create all unmatched as new accounts
        for (const name of unmatched) {
          await createAccount(tenantId, name, importId, rows);
          created++;
        }
      }
    } else if (unmatched.length > 0) {
      // No existing accounts to compare — create all as new
      for (const name of unmatched) {
        await createAccount(tenantId, name, importId, rows);
        created++;
      }
    }

    // ── Update linked accounts with import reference ──
    for (const { accountId } of linked) {
      await db.collection("tenants").doc(tenantId)
        .collection("accounts").doc(accountId)
        .update({
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          importIds: admin.firestore.FieldValue.arrayUnion(importId),
        }).catch(() => {}); // Ignore if already updated in AI phase
    }

    console.log(`[extractAccounts] ${tenantId}/${importId}: ${created} created, ${linked.length} linked, ${pendingCount} pending`);
    return { status: "success", created, linked: linked.length, pending: pendingCount };
  });

module.exports = { extractAccounts };
