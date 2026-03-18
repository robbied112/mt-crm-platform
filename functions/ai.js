const {
  onCall,
  HttpsError,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
  buildAIPrompt,
  parseAIResponse,
  DATASETS,
} = require("./helpers");

// -------------------------------------------------------------------
// AI Column Mapper — callable Cloud Function
// -------------------------------------------------------------------
// Accepts file column headers + sample rows, calls Claude to map them
// to internal CRM fields, and optionally transforms + saves to Firestore.
//
// Call from frontend:
//   const aiMap = httpsCallable(functions, 'aiMapper');
//   const result = await aiMap({ headers, sampleRows, tenantId });
// -------------------------------------------------------------------

const aiMapper = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 60, memory: "512MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { headers, sampleRows, userRole = "supplier" } = req.data;
    if (!headers || !sampleRows) {
      throw new HttpsError("invalid-argument", "headers and sampleRows required");
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY not configured");
    }

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const prompt = buildAIPrompt(headers, sampleRows, userRole);
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    return parseAIResponse(response.content[0].text.trim());
  });

// -------------------------------------------------------------------
// AI Ingest Pipeline — callable Cloud Function
// -------------------------------------------------------------------
// Processes a full file through the AI mapper + transform + Firestore save.
// For use from admin tools or CLI.
// -------------------------------------------------------------------

const aiIngest = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "1GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { headers, rows, tenantId = "default", userRole = "supplier", datasets } = req.data;
    if (!headers || !rows) {
      throw new HttpsError("invalid-argument", "headers and rows required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    // Step 1: AI mapping
    const apiKey = anthropicApiKey.value();
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const prompt = buildAIPrompt(headers, rows, userRole);
    const mapResp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const mapJson = parseAIResponse(mapResp.content[0].text);
    const mapping = mapJson.mapping;

    // Step 2: Save datasets to Firestore
    const batch = db.batch();
    for (const [name, items] of Object.entries(datasets || {})) {
      if (!DATASETS.includes(name)) continue;
      const ref = db.collection("tenants").doc(tenantId).collection("data").doc(name);
      batch.set(ref, {
        ...(Array.isArray(items) ? { items } : items),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return { success: true, mapping, uploadType: mapJson.uploadType };
  });

module.exports = { aiMapper, aiIngest };
