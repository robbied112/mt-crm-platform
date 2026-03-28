const {
  onCall,
  HttpsError,
  admin,
  db,
  anthropicApiKey,
  verifyTenantMembership,
  DATASETS,
} = require("./helpers");

const { generateBriefingForTenant } = require("./generateBriefing");
const { generateBlueprintForTenant } = require("./generateBlueprint");

const {
  transformAll,
  generateSummary,
  OBJECT_DATASETS,
  readChunked,
  writeChunked,
  createAdminFirestoreAdapter,
  buildUnifiedAxis,
} = require("./lib/pipeline/index");

const firestoreAdapter = createAdminFirestoreAdapter({ admin, db });

// -------------------------------------------------------------------
// Rebuild Views — recompute all dashboard views from normalized imports
// -------------------------------------------------------------------
// Reads ALL import rows for a tenant, groups by type, runs transforms,
// and writes pre-computed views. Full rebuild is mathematically required:
// aggregations like momentum (firstHalf vs secondHalf), consistency
// (1 - stddev/mean), and concentration need ALL rows.
//
// Rate limited: max 10 rebuilds per hour per tenant.
// -------------------------------------------------------------------

/**
 * Build an identity mapping for normalized rows + expand _months/_weeks
 * back into indexed columns that the transform layer expects.
 */
function prepareNormalizedForTransform(normalizedRows) {
  // Temporally align _months arrays across imports with different time periods
  const { axis: monthAxis, rows: alignedRows } = buildUnifiedAxis(normalizedRows);

  let monthCount = 0;
  let weekCount = 0;
  for (const row of alignedRows) {
    if (row._months) monthCount = Math.max(monthCount, row._months.length);
    if (row._weeks) weekCount = Math.max(weekCount, row._weeks.length);
  }

  const monthCols = Array.from({ length: monthCount }, (_, i) => `_m${i}`);
  const weekCols = Array.from({ length: weekCount }, (_, i) => `_w${i}`);

  // Expand _months/_weeks arrays into indexed columns on each row
  const expanded = alignedRows.map((row) => {
    const out = { ...row };
    if (row._months) {
      row._months.forEach((v, i) => { out[`_m${i}`] = v; });
    }
    if (row._weeks) {
      row._weeks.forEach((v, i) => { out[`_w${i}`] = v; });
    }
    return out;
  });

  // Identity mapping: field name → field name (normalized rows already use internal names)
  const mapping = {
    acct: "acct", dist: "dist", st: "st", ch: "ch", sku: "sku",
    qty: "qty", date: "date", revenue: "revenue",
    stage: "stage", owner: "owner", estValue: "estValue",
    oh: "oh", doh: "doh", lastOrder: "lastOrder", orderCycle: "orderCycle",
  };
  if (monthCols.length) mapping._monthColumns = monthCols;
  if (weekCols.length) mapping._weekColumns = weekCols;

  return { rows: expanded, mapping, monthAxis };
}

// -------------------------------------------------------------------
// TODO-046: NaN validation sweep
// -------------------------------------------------------------------
// Scans all numeric values in mergedViews for NaN/Infinity and replaces
// them with 0.  Logs a warning per field when replacements are made.
// -------------------------------------------------------------------

/**
 * Validate all numeric values in mergedViews, replacing NaN/Infinity with 0.
 * @param {Object} mergedViews - The merged views object (name → items)
 * @param {string} tenantId - Tenant ID for logging
 */
function validateViews(mergedViews, tenantId) {
  for (const [viewName, items] of Object.entries(mergedViews)) {
    if (!Array.isArray(items)) continue;

    const fieldReplacements = {};

    for (const obj of items) {
      if (!obj || typeof obj !== "object") continue;
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "number" && (!Number.isFinite(value))) {
          obj[key] = 0;
          fieldReplacements[key] = (fieldReplacements[key] || 0) + 1;
        }
      }
    }

    for (const [field, count] of Object.entries(fieldReplacements)) {
      console.warn(
        `[rebuildViews] ${tenantId}: view '${viewName}' field '${field}' had ${count} NaN/Infinity value(s) replaced with 0`
      );
    }
  }
}

function buildEmptyViews() {
  const emptyViews = {};
  for (const name of DATASETS) {
    emptyViews[name] = OBJECT_DATASETS.has(name) ? {} : [];
  }
  return emptyViews;
}

async function writeViews(tenantId, views) {
  await Promise.all(
    DATASETS.map((name) => writeChunked(
      db,
      ["tenants", tenantId, "views", name],
      views[name] ?? (OBJECT_DATASETS.has(name) ? {} : []),
      { adapter: firestoreAdapter }
    ))
  );
}

async function rebuildViewsForTenant({ tenantId, triggeredBy = "system" }) {
  const configRef = db.collection("tenants").doc(tenantId).collection("config").doc("main");
  const configSnap = await configRef.get();
  const configData = configSnap.data() || {};

  if (configData.rebuildLock && configData.rebuildLock.startedAt) {
    const lockStartedAt = configData.rebuildLock.startedAt.toMillis
      ? configData.rebuildLock.startedAt.toMillis()
      : configData.rebuildLock.startedAt;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lockStartedAt > fiveMinutesAgo) {
      throw new HttpsError(
        "resource-exhausted",
        "Rebuild already in progress"
      );
    }
  }

  await configRef.set({
    rebuildLock: {
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      triggeredBy,
    },
  }, { merge: true });

  let rebuildRef;
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRebuilds = await db.collection("tenants").doc(tenantId)
      .collection("rebuildHistory")
      .where("startedAt", ">=", oneHourAgo)
      .get();

    if (recentRebuilds.size >= 10) {
      throw new HttpsError(
        "resource-exhausted",
        "Rate limit: max 10 rebuilds per hour. Try again later."
      );
    }

    rebuildRef = db.collection("tenants").doc(tenantId)
      .collection("rebuildHistory").doc();
    await rebuildRef.set({
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "running",
      triggeredBy,
    });

    const importsSnap = await db.collection("tenants").doc(tenantId)
      .collection("imports")
      .orderBy("createdAt", "asc")
      .get();

    if (importsSnap.empty) {
      const emptyViews = buildEmptyViews();
      await writeViews(tenantId, emptyViews);
      await db.collection("tenants").doc(tenantId).collection("views").doc("_summary").set({
        text: "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await rebuildRef.update({
        status: "success",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        importCount: 0,
        totalRows: 0,
        viewsWritten: DATASETS.length,
      });
      return { status: "success", importCount: 0, totalRows: 0, viewsWritten: DATASETS.length };
    }

    const importResults = await Promise.all(
      importsSnap.docs.map(async (importDoc) => {
        const meta = importDoc.data();
        const rows = await readChunked(db, ["tenants", tenantId, "imports", importDoc.id], {
          adapter: firestoreAdapter,
          emptyValue: [],
          preferRows: true,
        });
        return {
          type: meta.type || "unknown",
          rows,
        };
      })
    );

    const rowsByType = {};
    let totalRows = 0;
    for (const { type, rows } of importResults) {
      if (!rowsByType[type]) rowsByType[type] = [];
      rowsByType[type].push(...rows);
      totalRows += rows.length;
    }

    // Step 1: Merge type aliases — "sales" is depletion without a dist column
    const DEPLETION_ALIASES = ["depletion", "sales"];
    const depletionRows = [];
    for (const alias of DEPLETION_ALIASES) {
      if (rowsByType[alias]) {
        depletionRows.push(...rowsByType[alias]);
        delete rowsByType[alias];
      }
    }
    if (depletionRows.length > 0) {
      rowsByType["depletion"] = depletionRows;
    }

    // Step 2: Per-view ownership — which type owns which dashboard view
    const VIEW_OWNERS = {
      distScorecard: "depletion",
      accountsTop: "depletion",
      skuBreakdown: "depletion",
      placementSummary: "depletion",
      reEngagementData: "depletion",
      newWins: "depletion",
      acctConcentration: "depletion",
      reorderData: "purchases",
      inventoryData: "inventory",
      distHealth: "inventory",
      revenueByChannel: "quickbooks",
      revenueByProduct: "quickbooks",
      revenueSummary: "quickbooks",
      revenueMonthly: "quickbooks",
      qbDistOrders: "quickbooks",
      pipelineAccounts: "pipeline",
      pipelineMeta: "pipeline",
    };
    const TYPE_ORDER = ["depletion", "purchases", "inventory", "pipeline", "quickbooks", "revenue", "ar_aging", "ap_aging"];

    const mergedViews = {};
    let combinedMonthAxis = [];

    // Process types in defined order for deterministic priority
    const sortedTypes = Object.keys(rowsByType).sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a);
      const bi = TYPE_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const type of sortedTypes) {
      const rows = rowsByType[type];
      if (!rows || rows.length === 0) continue;

      const missingAcct = rows.filter((r) => !r.acct).length;
      const missingQty = rows.filter((r) => !r.qty && r.qty !== 0).length;
      if (missingAcct > rows.length * 0.5) {
        console.warn(`[rebuildViews] ${tenantId}: >50% rows missing 'acct' for type '${type}'`);
      }
      if (missingQty > rows.length * 0.5) {
        console.warn(`[rebuildViews] ${tenantId}: >50% rows missing 'qty' for type '${type}'`);
      }

      try {
        const { rows: expanded, mapping, monthAxis } = prepareNormalizedForTransform(rows);
        const { type: resolvedType, ...datasets } = transformAll(expanded, mapping, type);
        void resolvedType;

        // Keep the longest monthAxis across types
        if (monthAxis && monthAxis.length > combinedMonthAxis.length) {
          combinedMonthAxis = monthAxis;
        }

        for (const [name, items] of Object.entries(datasets)) {
          if (items === undefined || !DATASETS.includes(name)) continue;
          const owner = VIEW_OWNERS[name];
          // Write if: view is empty, current type is the owner, or no owner defined
          if (!mergedViews[name] || owner === type || !owner) {
            mergedViews[name] = items;
          }
        }
      } catch (err) {
        console.error(`[rebuildViews] Transform failed for type '${type}' in tenant ${tenantId}:`, {
          error: err.message,
          rowCount: rows.length,
          importCount: importsSnap.size,
        });
      }
    }

    const nextViews = buildEmptyViews();
    for (const [name, items] of Object.entries(mergedViews)) {
      if (DATASETS.includes(name)) {
        nextViews[name] = items;
      }
    }

    validateViews(nextViews, tenantId);
    await writeViews(tenantId, nextViews);

    // Pick primary type: highest-priority type that has rows
    const primaryType = TYPE_ORDER.find((t) => rowsByType[t]?.length > 0) || Object.keys(rowsByType)[0] || "depletion";
    const summary = generateSummary(primaryType, nextViews);
    const summaryDoc = {
      text: summary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (combinedMonthAxis.length > 0) {
      summaryDoc.monthAxis = combinedMonthAxis;
    }
    await db.collection("tenants").doc(tenantId).collection("views").doc("_summary").set(summaryDoc);

    // Generate AI briefing (inline, guarded — failure does not break rebuild)
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const subscription = tenantSnap.data()?.subscription || {};
    const aiAllowed = subscription.aiCalls !== false;

    try {
      const configData2 = (await configRef.get()).data() || {};
      const aiBriefingEnabled = configData2.features?.aiBriefing !== false;
      if (aiBriefingEnabled && aiAllowed && totalRows >= 10) {
        const apiKey = anthropicApiKey.value();
        if (apiKey) {
          await generateBriefingForTenant({ tenantId, views: nextViews, db, admin, apiKey });
          console.log(`[rebuildViews] Briefing generated for tenant ${tenantId}`);
        }
      }
    } catch (briefingErr) {
      console.error(`[rebuildViews] Briefing generation failed for tenant ${tenantId}:`, briefingErr.message);
      // Non-blocking: rebuild still succeeds
    }

    // Generate AI-powered dashboard blueprint (inline, guarded)
    try {
      const configData3 = (await configRef.get()).data() || {};
      const aiReportsEnabled = configData3.features?.aiReports !== false;
      if (aiReportsEnabled && aiAllowed && totalRows >= 5) {
        const apiKey = anthropicApiKey.value();
        if (apiKey) {
          // Build rawImports from importResults with metadata
          const rawImports = await Promise.all(
            importsSnap.docs.map(async (importDoc) => {
              const meta = importDoc.data();
              const rows = await readChunked(db, ["tenants", tenantId, "imports", importDoc.id], {
                adapter: firestoreAdapter,
                emptyValue: [],
                preferRows: true,
              });
              return {
                fileName: meta.fileName || importDoc.id,
                fileType: meta.type || "unknown",
                type: meta.type || "unknown",
                headers: meta.mapping ? Object.values(meta.mapping).filter((v) => typeof v === "string") : [],
                columnTypes: meta.columnTypes || {},
                rows,
                rowCount: rows.length,
              };
            })
          );

          await generateBlueprintForTenant({ tenantId, rawImports, db, admin, apiKey });
          console.log(`[rebuildViews] Blueprint generated for tenant ${tenantId}`);
        }
      }
    } catch (blueprintErr) {
      console.error(`[rebuildViews] Blueprint generation failed for tenant ${tenantId}:`, blueprintErr.message);
      // Non-blocking: rebuild still succeeds
    }

    await rebuildRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      importCount: importsSnap.size,
      totalRows,
      viewsWritten: DATASETS.length,
      types: Object.keys(rowsByType),
    });

    console.log(
      `[rebuildViews] Tenant ${tenantId}: ${importsSnap.size} imports, ${totalRows} rows, ${DATASETS.length} views`
    );
    return { status: "success", importCount: importsSnap.size, totalRows, viewsWritten: DATASETS.length };
  } catch (err) {
    console.error(`[rebuildViews] Fatal error for tenant ${tenantId}:`, {
      error: err.message,
      stack: err.stack,
    });
    if (rebuildRef) {
      await rebuildRef.update({
        status: "error",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: err.message,
      });
    }
    if (err instanceof HttpsError) {
      throw err;
    }
    throw new HttpsError("internal", `Rebuild failed: ${err.message}`);
  } finally {
    await configRef.set({
      rebuildLock: admin.firestore.FieldValue.delete(),
    }, { merge: true });
  }
}

const rebuildViews = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 540, memory: "2GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId } = req.data;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);
    return rebuildViewsForTenant({
      tenantId,
      triggeredBy: req.auth.uid,
    });
  });

module.exports = { rebuildViews, rebuildViewsForTenant };
