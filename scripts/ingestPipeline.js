#!/usr/bin/env node
/**
 * Data Ingestion Pipeline
 *
 * Reads a QuickBooks/Excel/CSV file, runs it through the AI mapper,
 * transforms the data into CRM dashboard structures, and saves to Firestore.
 *
 * Usage:
 *   node ingestPipeline.js [path-to-file] [--tenant=TENANT_ID]
 *
 * Defaults:
 *   file:   ../Sample Data/Yolo Brand Group, LLC_Sales by Customer Detail - RD.xlsx
 *   tenant: default
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { aiAutoDetectMapping } from "./aiMapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from frontend
dotenv.config({ path: join(__dirname, "..", "frontend", ".env") });

const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "mt-crm-platform";

// ─── File Parsing (Node.js version of parseFile.js) ─────────────

function findHeaderRow(rawRows) {
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonEmpty.length < 3) continue;
    const textCells = nonEmpty.filter((c) => {
      const s = String(c).trim();
      return isNaN(Number(s)) && !/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(s);
    });
    if (textCells.length >= nonEmpty.length * 0.5 && nonEmpty.length >= 3) return i;
  }
  return 0;
}

function cleanHeaders(headers) {
  const seen = {};
  return headers.map((h, i) => {
    let name = h == null ? "" : String(h).trim();
    if (!name || /^__EMPTY/.test(name) || /^empty\s*\d*$/i.test(name)) {
      name = `Column_${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    }
    if (seen[name]) { seen[name]++; name = `${name}_${seen[name]}`; }
    else { seen[name] = 1; }
    return name;
  });
}

function detectGroupedFormat(rawRows, headerIdx) {
  let groupHeaders = 0;
  let dataWithEmpty0 = 0;
  const sampleEnd = Math.min(rawRows.length, headerIdx + 30);
  for (let i = headerIdx + 1; i < sampleEnd; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) groupHeaders++;
    else if (!col0 && otherFilled >= 2) dataWithEmpty0++;
  }
  return groupHeaders >= 2 && dataWithEmpty0 >= 3;
}

function processGroupedRows(rawRows, headerIdx) {
  const headerRow = rawRows[headerIdx].map((c) => (c == null ? "" : String(c)));
  if (!headerRow[0].trim()) headerRow[0] = "Customer";
  const headers = cleanHeaders(headerRow);
  const dataRows = [];
  let currentGroup = "";

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const col0 = String(row[0] || "").trim();
    const otherFilled = row.slice(1).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;

    if (col0.toLowerCase().startsWith("accrual basis") || col0.toLowerCase().startsWith("cash basis")) continue;
    if (col0 && otherFilled === 0 && !col0.startsWith("Total")) { currentGroup = col0; continue; }
    if (col0.startsWith("Total for ") || col0 === "TOTAL" || col0 === "Total") continue;
    if (row.slice(1).some((c) => String(c).trim() === "TOTAL")) continue;

    if (otherFilled >= 1) {
      const obj = {};
      headers.forEach((h, j) => {
        let val = row[j] ?? "";
        if (j === 0 && !String(val).trim() && currentGroup) val = currentGroup;
        obj[h] = val;
      });
      dataRows.push(obj);
    }
  }
  return { headers, rows: dataRows };
}

function processStandardRows(rawRows, headerIdx) {
  const headerRow = cleanHeaders(rawRows[headerIdx].map((c) => (c == null ? "" : String(c))));
  const dataRows = rawRows.slice(headerIdx + 1)
    .filter((r) => r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((r) => {
      const obj = {};
      headerRow.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    })
    .filter((r) => {
      const fv = String(Object.values(r)[0] || "").toLowerCase().trim();
      return fv !== "total" && fv !== "grand total" && fv !== "";
    });
  return { headers: headerRow, rows: dataRows };
}

function parseFileBuffer(buffer, ext) {
  if (ext === ".csv" || ext === ".tsv") {
    const text = buffer.toString("utf-8");
    const delimiter = ext === ".tsv" ? "\t" : ",";
    const rawRows = text.split("\n").map((line) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "")));
    const headerIdx = findHeaderRow(rawRows);
    return detectGroupedFormat(rawRows, headerIdx)
      ? processGroupedRows(rawRows, headerIdx)
      : processStandardRows(rawRows, headerIdx);
  }

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  const headerIdx = findHeaderRow(rawRows);
  return detectGroupedFormat(rawRows, headerIdx)
    ? processGroupedRows(rawRows, headerIdx)
    : processStandardRows(rawRows, headerIdx);
}

// ─── Transform Layer (Node.js port of transformData.js) ─────────

function num(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(v) { return v == null ? "" : String(v).trim(); }

function normalizeState(v) {
  const s = str(v).toUpperCase();
  return s.length === 2 ? s : s.slice(0, 2);
}

function normalizeDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : str(v);
}

function getMapped(row, mapping, field) {
  const col = mapping[field];
  return col ? row[col] : undefined;
}

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

function transformQuickBooks(rows, mapping) {
  const headers = Object.keys(rows[0] || {});
  const findCol = (mappedField, patterns) => {
    if (mapping[mappedField]) return mapping[mappedField];
    return headers.find((h) => patterns.some((p) => h.toLowerCase().includes(p)));
  };

  const nameCol = findCol("acct", ["customer full name", "customer", "name"]);
  const amountCol = findCol("revenue", ["amount"]);
  const dateCol = findCol("date", ["transaction date", "date"]);
  const itemCol = findCol("sku", ["product/service", "item", "memo/description", "description"]);
  const qtyCol = findCol("qty", ["quantity"]);
  const channelCol = findCol("ch", ["customer type", "type"]);

  const isProductRow = (r) => {
    const item = str(r[itemCol]).toLowerCase();
    const qty = num(r[qtyCol]);
    if (item.includes("tax item") || item.includes("shipping") || item.includes("discount")) return false;
    if (qty === 0 && !item) return false;
    return true;
  };

  const productRows = rows.filter(isProductRow);
  const accountMap = {};

  for (const r of productRows) {
    const name = str(r[nameCol]) || str(r[headers[0]]) || str(r["Customer"]);
    if (!name || name.toLowerCase() === "total") continue;
    const amount = num(r[amountCol]);
    const qty = num(r[qtyCol]);
    const date = normalizeDate(r[dateCol]);
    const channel = str(r[channelCol]);

    if (!accountMap[name]) {
      accountMap[name] = { revenue: 0, qty: 0, count: 0, lastDate: date, firstDate: date, channel, items: {} };
    }
    accountMap[name].revenue += amount;
    accountMap[name].qty += qty;
    accountMap[name].count += 1;
    if (date && date > accountMap[name].lastDate) accountMap[name].lastDate = date;
    if (date && date < accountMap[name].firstDate) accountMap[name].firstDate = date;
    if (!accountMap[name].channel && channel) accountMap[name].channel = channel;
    const itemName = str(r[itemCol]) || "Other";
    if (!accountMap[name].items[itemName]) accountMap[name].items[itemName] = { qty: 0, revenue: 0 };
    accountMap[name].items[itemName].qty += qty;
    accountMap[name].items[itemName].revenue += amount;
  }

  const allDates = Object.values(accountMap).flatMap((a) => [a.firstDate, a.lastDate]).filter(Boolean).sort();
  const dateSpanMonths = Math.max(1, allDates.length >= 2
    ? Math.ceil((new Date(allDates[allDates.length - 1]) - new Date(allDates[0])) / (1000 * 60 * 60 * 24 * 30))
    : 3);

  const accountsTop = Object.entries(accountMap)
    .map(([acct, data], idx) => {
      const perMonth = data.revenue / Math.max(dateSpanMonths, 1);
      return {
        acct, dist: "", st: "", ch: data.channel || "",
        ce: Math.round(data.qty),
        w4: Math.round(data.qty / Math.max(dateSpanMonths, 1)),
        nov: Math.round(perMonth), dec: Math.round(perMonth),
        jan: Math.round(perMonth), feb: Math.round(perMonth),
        total: Math.round(data.revenue),
        trend: data.count > 5 ? "Momentum" : data.count > 2 ? "Consistent" : "Growth Opportunity",
        growthPotential: Math.round(data.revenue * 0.15),
        rank: idx + 1,
      };
    })
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  const pipelineAccounts = Object.entries(accountMap)
    .filter(([, data]) => data.revenue > 0)
    .map(([acct, data]) => ({
      acct,
      stage: data.revenue > 5000 ? "Won" : data.revenue > 1000 ? "Negotiation" : "Identified",
      estValue: Math.round(data.revenue),
      owner: "", state: "",
      tier: data.revenue > 5000 ? "Tier 1" : data.revenue > 1000 ? "Tier 2" : "Tier 3",
      stageDate: data.lastDate || new Date().toISOString().slice(0, 10),
      source: "QuickBooks Import", type: "",
      channel: data.channel || "", nextStep: "", dueDate: "",
      notes: `${Object.keys(data.items).length} products, ${data.count} transactions`,
    }));

  const now = Date.now();
  const reorderData = Object.entries(accountMap)
    .filter(([, data]) => data.revenue > 0)
    .map(([acct, data], idx) => {
      const lastDate = new Date(data.lastDate);
      const firstDate = new Date(data.firstDate);
      const days = Math.round((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const spanDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const cycle = data.count > 1 ? Math.round(spanDays / (data.count - 1)) : 30;
      const priority = Math.min(100, Math.round((days / Math.max(cycle, 1)) * 50));
      return {
        rank: idx + 1, acct, dist: "", st: "", ch: data.channel || "",
        ce: Math.round(data.qty), purch: data.count, cycle,
        last: data.lastDate, days, priority,
        skus: Object.entries(data.items).map(([w, d]) => ({
          w, ce: Math.round(d.qty), purch: 1, cycle, last: data.lastDate, days,
        })),
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const qbDistOrders = {};
  for (const [acct, data] of Object.entries(accountMap)) {
    if (data.revenue > 0) qbDistOrders[acct] = { total: Math.round(data.revenue) };
  }

  const vals = accountsTop.map((a) => a.total).sort((a, b) => b - a);
  const totalVol = vals.reduce((s, v) => s + v, 0);
  const acctConcentration = {
    total: accountsTop.length,
    top10: totalVol > 0 ? Math.round((vals.slice(0, 10).reduce((s, v) => s + v, 0) / totalVol) * 100) : 0,
    median: vals[Math.floor(vals.length / 2)] || 0,
    under1: vals.filter((v) => v < 1).length,
  };

  return { accountsTop, pipelineAccounts, pipelineMeta: {}, qbDistOrders, acctConcentration, reorderData };
}

function generateSummary(dataType, datasets) {
  const parts = [];
  if (dataType === "quickbooks") {
    const acctCount = datasets.accountsTop?.length || 0;
    const totalRev = datasets.accountsTop?.reduce((s, a) => s + a.total, 0) || 0;
    const topAcct = datasets.accountsTop?.[0]?.acct || "N/A";
    parts.push(`AI Pipeline processed QuickBooks data: ${acctCount} customers with $${totalRev.toLocaleString()} in total revenue.`);
    parts.push(`Top account: "${topAcct}".`);
    parts.push("Inventory and Reorder data not available from QuickBooks — upload a distributor depletion report to unlock those tabs.");
  } else {
    parts.push("Data processed successfully via AI Pipeline.");
  }
  return parts.join(" ");
}

// ─── Firestore Integration ──────────────────────────────────────

const DATASETS = [
  "distScorecard", "reorderData", "accountsTop", "pipelineAccounts",
  "pipelineMeta", "inventoryData", "newWins", "distHealth",
  "reEngagementData", "placementSummary", "qbDistOrders", "acctConcentration",
];

async function initFirestore() {
  // Look for service account key in project root
  const saKeyPath = join(__dirname, "..", "serviceAccountKey.json");
  try {
    if (existsSync(saKeyPath)) {
      const serviceAccount = JSON.parse(readFileSync(saKeyPath, "utf-8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
      });
      console.log("[Firestore] Authenticated via serviceAccountKey.json");
    } else {
      // Fall back to Application Default Credentials
      admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
      console.log("[Firestore] Using Application Default Credentials");
    }
    const db = admin.firestore();
    // Test connection
    await db.collection("_ping").doc("test").get();
    console.log("[Firestore] Connected successfully");
    return db;
  } catch (err) {
    console.warn(`[Firestore] Could not connect: ${err.message}`);
    console.warn("[Firestore] Results will be saved to local JSON instead.");
    return null;
  }
}

async function saveToFirestore(db, tenantId, datasets, summary) {
  const batch = db.batch();

  for (const [name, items] of Object.entries(datasets)) {
    if (items === undefined || !DATASETS.includes(name)) continue;
    const ref = db.collection("tenants").doc(tenantId).collection("data").doc(name);
    const isObject = !Array.isArray(items);
    batch.set(ref, {
      ...(isObject ? items : { items }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Save summary
  const summaryRef = db.collection("tenants").doc(tenantId).collection("data").doc("_summary");
  batch.set(summaryRef, { text: summary, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Log the upload
  const uploadRef = db.collection("tenants").doc(tenantId).collection("uploads").doc();
  batch.set(uploadRef, {
    source: "AI Pipeline (CLI)",
    dataType: "quickbooks",
    rowCount: datasets.accountsTop?.length || 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log(`[Firestore] Saved ${Object.keys(datasets).length} datasets to tenant "${tenantId}"`);
}

// ─── Main Pipeline ──────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tenantId = args.find((a) => a.startsWith("--tenant="))?.split("=")[1] || "default";
  const filePath = args.find((a) => !a.startsWith("--")) ||
    join(__dirname, "..", "Sample Data", "Yolo Brand Group, LLC_Sales by Customer Detail - RD.xlsx");

  const resolvedPath = resolve(filePath);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       AI-Powered Data Ingestion Pipeline        ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  File:   ${resolvedPath}`);
  console.log(`  Tenant: ${tenantId}`);
  console.log();

  // ── Step 1: Read & Parse ──
  if (!existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log("[1/5] Parsing file...");
  const buffer = readFileSync(resolvedPath);
  const ext = extname(resolvedPath).toLowerCase();
  const { headers, rows } = parseFileBuffer(buffer, ext);
  console.log(`  → ${rows.length} rows, ${headers.length} columns`);
  console.log(`  → Headers: ${headers.join(", ")}`);

  // ── Step 2: AI Mapping ──
  if (!ANTHROPIC_API_KEY) {
    console.error("Missing VITE_ANTHROPIC_API_KEY in frontend/.env");
    process.exit(1);
  }

  console.log("\n[2/5] Running AI column mapper...");
  const { mapping, confidence, unmapped, uploadType } = await aiAutoDetectMapping(headers, rows, ANTHROPIC_API_KEY);

  console.log(`  → Upload type: ${uploadType}`);
  console.log("  → Mapping:");
  for (const [field, col] of Object.entries(mapping)) {
    if (field.startsWith("_")) continue;
    console.log(`     ${field.padEnd(12)} → "${col}" (confidence: ${(confidence[field] || 0).toFixed(2)})`);
  }
  if (unmapped.length > 0) {
    console.log(`  → Unmapped columns: ${unmapped.join(", ")}`);
  }

  // ── Step 3: Transform ──
  console.log("\n[3/5] Transforming data...");
  let datasets;
  if (uploadType === "quickbooks") {
    datasets = transformQuickBooks(rows, mapping);
  } else {
    // Fallback to QB transform for now (most sample data is QB)
    datasets = transformQuickBooks(rows, mapping);
  }

  const summary = generateSummary(uploadType, datasets);
  console.log(`  → ${datasets.accountsTop?.length || 0} accounts`);
  console.log(`  → ${datasets.pipelineAccounts?.length || 0} pipeline entries`);
  console.log(`  → ${datasets.reorderData?.length || 0} reorder entries`);
  console.log(`  → Total revenue: $${(datasets.accountsTop?.reduce((s, a) => s + a.total, 0) || 0).toLocaleString()}`);

  // ── Step 4: Save to JSON (always, as backup) ──
  console.log("\n[4/5] Saving local backup...");
  const outputPath = join(__dirname, "pipeline-output.json");
  const output = {
    meta: {
      file: resolvedPath,
      tenant: tenantId,
      uploadType,
      mapping,
      confidence,
      unmapped,
      processedAt: new Date().toISOString(),
      rowCount: rows.length,
      accountCount: datasets.accountsTop?.length || 0,
    },
    summary,
    datasets,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`  → Saved to ${outputPath}`);

  // ── Step 5: Save to Firestore ──
  console.log("\n[5/5] Connecting to Firestore...");
  const db = await initFirestore();
  if (db) {
    await saveToFirestore(db, tenantId, datasets, summary);
    console.log("  → Firestore save complete!");
  }

  // ── Done ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║              Pipeline Complete!                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Summary: ${summary}`);
}

main().catch((err) => {
  console.error("\nPipeline failed:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
