# TODOS — Sidekick BI (MT CRM Platform)

> Updated from Cathedral Vision Review + Eng Review on 2026-03-15.
> CEO review: SCOPE EXPANSION mode. Eng review: BIG CHANGE mode (full Phase 1).
> Key eng review correction: full rebuild only (not incremental) — momentum/consistency need ALL rows.
> Phase 1 = Foundation, Phase 2 = CRM, Phase 3 = Intelligence, Phase 4 = Delight + Scale.
>
> **Billback / Trade Spend Intelligence added 2026-03-16.** CEO review: SCOPE EXPANSION.
> Vision: PDF billback ingestion → wine entity with AI dedup → spend dashboards → agreement reconciliation → producer allocation → predictive budgeting.
> Key decisions: Claude Vision API (single-call extract+map), extend DataImport (not separate page), wine entity follows account extraction pattern.

---

## P1 — Phase 1: Foundation (Must Ship First)

### ~~TODO-001: Remove browser-direct Anthropic API path~~ DONE
- Rewrote `aiMapper.js` to use Firebase `httpsCallable("aiMapper")` exclusively. Removed direct Anthropic API call and `VITE_ANTHROPIC_API_KEY` dependency.

### ~~TODO-002: Fix Firebase Hosting to serve frontend/dist~~ DONE
- Changed `firebase.json` hosting `public` to `frontend/dist`. Added predeploy build hook.

### ~~TODO-003: Derive tenantId from user profile~~ DONE
- AuthContext now fetches `users/{uid}` on login, auto-provisions profile on first login. tenantId + role flow from AuthContext → DataContext. Hardcoded "default" removed.

### ~~TODO-004: Chunked subcollection storage for datasets~~ DONE
- `firestoreService.js` now chunks arrays >500 items into versioned subcollection docs. Parallel reads/writes. Old chunks cleaned up after successful save. Small datasets stay as single docs.

### ~~TODO-005: Add Vitest and unit tests for data pipeline~~ DONE
- Added Vitest. 59 tests across 3 files: parseFile (header detection, QB grouped format), semanticMapper (column mapping, type detection), transformData (all 5 transform types + summary). Realistic synthetic fixtures.

### TODO-020: Extract shared pipeline package (REPLACES TODO-006)
- **What:** Create `packages/pipeline/` containing `parseFile`, `transformData`, `semanticMapper`, and new `normalize.js` + `incrementalMerge.js` logic. Use from both `frontend/` and `functions/`. Remove `functions/lib/pipeline.js` (490-line duplicate). Also extract `buildAIPrompt()` helper (currently duplicated 3x in functions/index.js) and `verifyTenantMembership()` helper.
- **Why:** `functions/lib/pipeline.js` is a near-exact copy of frontend utils. The new `rebuildViews` Cloud Function needs the same transform logic. Without extraction, we'd have 3 copies of the same code. DRY is non-negotiable.
- **Effort:** M (3-4 hours)
- **Priority:** P1 — BLOCKS all Phase 1 work
- **Files:** New `packages/pipeline/`, `functions/lib/pipeline.js` (delete), `frontend/src/utils/parseFile.js`, `frontend/src/utils/transformData.js`, `frontend/src/utils/semanticMapper.js`
- **Depends on:** TODO-005 (tests should exist before refactoring) ✓ DONE

### TODO-021: Implement normalized data model (imports/ + views/)
- **What:** Create Firestore schema for `imports/{importId}/rows/` (raw normalized rows with source metadata) and `views/{viewName}` (pre-computed dashboard data, same shape as current `data/` collections). Update `firestoreService.js` to save raw rows on import and read dashboard data from `views/`. Feature-flagged via `tenantConfig.useNormalizedModel`. Keep existing `data/` path as fallback.
- **Why:** The current pre-aggregated model prevents: import history, undo, time-series analysis, multi-file correlation, CRM account linking, and cross-source intelligence. This is the ceiling on the product.
- **Pros:** Unlocks every Phase 2-4 feature. Import history + undo for free. Data provenance.
- **Cons:** Schema migration complexity. Must update Firestore security rules. DataContext refactor.
- **Context:** Schema decided in Cathedral Review:
  ```
  tenants/{tenantId}/
  ├── imports/{importId}/          # Source of truth
  │   ├── meta: {file, date, type, mapping, rowCount, contentHash}
  │   └── rows/{chunkId}: [{...}]   # Raw normalized rows
  ├── accounts/{accountId}/       # CRM entities (auto-extracted)
  ├── views/{viewName}            # Pre-computed dashboards
  │   └── rows/{chunk}            # Chunked (existing pattern)
  └── config/main
  ```
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** `frontend/src/services/firestoreService.js`, `frontend/src/context/DataContext.jsx`, `firestore.rules`, new migration script
- **Depends on:** TODO-020

### TODO-022: Build rebuildViews Cloud Function (full rebuild)
- **What:** Callable Cloud Function that reads ALL import rows for a tenant, concatenates by upload type, runs transforms, and writes pre-computed views. Per-type concat with last-type-wins for overlapping view names. Includes server-side rate limiting (max 10 imports/hour per tenant). Updates Google Drive sync to call rebuildViews instead of direct view saves.
- **Why:** The compute engine that keeps dashboards correct after every import. Full rebuild is mathematically required — aggregations like momentum (firstHalf vs secondHalf), consistency (1 - stddev/mean), and concentration need ALL rows, not just new ones merged with previous views.
- **Pros:** Simple, correct, no merge logic bugs. Rate limiting prevents abuse. ~10-20s for 500k rows (well within 540s timeout).
- **Cons:** Scales linearly with total rows across all imports. Acceptable for Phase 1 volumes; incremental rebuild deferred to Phase 2 when needed.
- **Context:** The existing `processTenantSync` in `functions/index.js` does inline transform + save. Refactor to call rebuildViews instead. Cloud Function timeout: 540s, memory: 2GB.
- **Failure handling requirements (from eng review):**
  - Try/catch around transform — log full context (tenantId, importIds, row count), return structured error to client
  - Handle empty imports/ gracefully — write empty views, don't throw
  - Validate normalized rows before transform — warn on missing required fields (acct, qty)
  - Snapshot comparison test: rebuildViews output must exactly match transformAll() on same rows
- **Effort:** S (2-3 hours)
- **Priority:** P1
- **Files:** `functions/index.js` (new export + refactor processTenantSync)
- **Depends on:** TODO-020, TODO-021

### TODO-023: Auto-extract account entities with AI dedup
- **What:** On each import, extract unique account names from raw rows, create/update `accounts/{id}` documents in Firestore. Use Claude for fuzzy matching against existing accounts (confidence thresholds: >0.85 auto-link, 0.5-0.85 pending review queue, <0.5 create new). Sanitize account names before AI call (strip special chars, truncate to 100 chars) to prevent prompt injection. Include pending matches review UI.
- **Why:** This is what turns uploaded data into a CRM. Every account mentioned in any file becomes a living entity with full history.
- **Pros:** Zero-effort CRM. Users never manually create accounts. AI dedup handles name variations.
- **Cons:** AI costs (~$0.01/import). Potential for wrong matches (mitigated by confidence threshold + review queue). Fuzzy matching is an inherently imperfect problem.
- **Context:** Account schema: `{ name, normalizedName, displayName, sourceNames[], firstSeen, lastSeen, metadata: {state, distributor, channel}, importIds[] }`. Dedup flow: normalize → exact match → AI fuzzy → create/link/queue.
- **Failure handling requirements (from eng review):**
  - Claude API timeout: retry 2x with backoff, then skip account extraction with warning log (accounts created on next successful import)
  - Malformed AI response (invalid JSON, missing fields): log full response, fall back to creating new accounts for all unmatched names
  - NaN confidence score: guard with `parseFloat` + default to 0 (routes to "create new" bucket — safe default)
  - Prompt injection defense: sanitize account names (strip special chars, truncate to 100 chars) before including in prompt
  - Empty account column: skip extraction for that import, log warning
- **Effort:** L (5-6 hours)
- **Priority:** P1
- **Files:** `functions/index.js` (accountExtractor in rebuildViews), new `frontend/src/components/PendingMatches.jsx`, `firestore.rules`
- **Depends on:** TODO-021

### TODO-024: Expand role system to 4 industry roles
- **What:** Expand from 2 roles (supplier, distributor) to 4 roles (Winery, Importer, Distributor, Retailer). Each role defines: terminology (what "account" and "distributor" mean), expected file types, primary dashboard views, and field definitions for semantic mapping.
- **Why:** The wine industry has 4 distinct roles. Importers and wineries don't see themselves as generic "suppliers." Role-specific UX drives product-market fit.
- **Pros:** Product speaks each user's language. Correct field definitions improve AI mapping accuracy.
- **Cons:** 4 code paths for terminology. More testing surface. Onboarding must ask "what's your role?"
- **Context:** Role matrix decided in Cathedral Review:
  ```
  ROLE      ACCOUNT=     DIST=        PRIMARY VIEWS
  Winery    Retailer     Distributor  Depletions, Pipeline
  Importer  Distributor  (self)       Orders, Inventory
  Distrib.  Retailer     Supplier     Sell-through, Inventory
  Retailer  (self)       Supplier     Purchases, Inventory
  ```
- **Effort:** M (2-3 hours)
- **Priority:** P1
- **Files:** `packages/pipeline/src/semanticMapper.js`, `frontend/src/utils/terminology.js`, `frontend/src/config/tenant.js`
- **Depends on:** TODO-020

### TODO-026: Firebase Emulator + integration tests
- **What:** Set up Firebase Local Emulator Suite (Firestore emulator). Add Vitest integration test harness. Write tests for: import → rebuild → verify views, import → extract accounts → verify dedup, delete import → rebuild, rate limiting, and "incremental rebuild == full rebuild" property test.
- **Why:** Cloud Functions that write to Firestore can't be adequately tested with mocks alone. Integration tests with the emulator give real confidence.
- **Pros:** Real Firestore behavior in tests (queries, security rules, batched writes). CI-friendly.
- **Cons:** Slower than unit tests (~5-10s per test). Emulator setup overhead (one-time).
- **Context:** Test pyramid: unit tests (Vitest, no emulator) for pure logic (merge, dedup, hash). Integration tests (Vitest + emulator) for full flows. The "2am Friday" test: upload → rebuild → dashboard shows correct data.
- **Effort:** M (3-4 hours)
- **Priority:** P1
- **Files:** New `firebase.json` emulator config, new `functions/__tests__/`, `vitest.config.js` update
- **Depends on:** TODO-022

---

## P2 — Phase 2: CRM + Polish

### TODO-007: Add React Router
- **What:** Add `react-router-dom`. Convert tab state to URL routes (`/territory`, `/accounts`, `/accounts/:id`, `/settings`, etc.). Support deep linking, browser back/forward, bookmarkable views.
- **Why:** Currently using `useState` for tabs — no deep links, no browser back button, no bookmarkable views, no shareable URLs. For a BI product, this is table stakes. Also required for Account Detail page.
- **Effort:** M (2-3 hours)
- **Priority:** P2 (but unlocks TODO-027)
- **Files:** `frontend/src/App.jsx`, new route config
- **Depends on:** Nothing

### ~~TODO-008: Snapshot-before-overwrite for data imports~~ SUPERSEDED
- **Superseded by:** TODO-021 (normalized data model). With the imports/ collection, every import is preserved. Undo = delete the import + rebuild views. No separate snapshot mechanism needed.

### TODO-009: HMAC-sign OAuth state parameter
- **What:** In `cloudSyncOAuthCallback`, generate the state parameter by HMAC-signing the tenantId + nonce with a server secret. Verify the signature on callback. Prevents tenant hijacking via state manipulation.
- **Why:** Currently the OAuth state is unsigned base64 JSON (`functions/index.js:409`). An attacker could substitute a different tenantId to connect their Google Drive to someone else's tenant. **SECURITY: Must fix before production.**
- **Effort:** S (30 min)
- **Priority:** P2 (but P1 severity if going to production)
- **Files:** `functions/index.js` (cloudSyncOAuthCallback + the frontend code that initiates the OAuth flow)
- **Depends on:** Nothing

### ~~TODO-010: File size validation~~ DONE

### ~~TODO-011: Load user role from profile~~ DONE

### TODO-012: Upload + mapping audit trail
- **What:** Log every upload with: file name, detected type, AI mapping vs user's final mapping, row count, success/failure, user email, content hash, import ID. Store in `tenants/{id}/uploads/`. Enables AI mapping accuracy tracking over time.
- **Why:** No way to know if AI mapping is working well, what file types customers use most, or debug import failures after the fact.
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/DataImport.jsx`, `frontend/src/services/firestoreService.js`
- **Depends on:** TODO-021 (for import ID linkage)

### TODO-025: Content hash duplicate detection
- **What:** Compute SHA256 of uploaded file content. Before saving import, check if any existing import for this tenant has the same hash. If match found, show warning with date of previous import and option to proceed or cancel.
- **Why:** Prevents the most common data quality problem — accidental double-uploads that corrupt dashboard numbers (doubled volumes, double-counted accounts).
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/DataImport.jsx`, `frontend/src/services/firestoreService.js`
- **Depends on:** TODO-021

### TODO-027: Account Detail Page
- **What:** Show all data for a single account across all imports: volume history, orders, distributor(s), contacts, notes/activities, pipeline stage. Includes contact CRUD and activity logging. React Router route: `/accounts/:accountId`.
- **Why:** This is the CRM. When a user clicks an account name anywhere in the app, they land on this page. It's what turns a dashboard into a daily-use tool.
- **Pros:** Creates CRM stickiness. Every table in the app becomes a portal to deeper data.
- **Cons:** Requires querying across imports for one account — Firestore reads scale with import count. Mitigation: store aggregated account summary on the account document itself.
- **Effort:** L (6-8 hours)
- **Priority:** P2
- **Files:** New `frontend/src/components/AccountDetail.jsx`, `frontend/src/services/firestoreService.js`
- **Depends on:** TODO-023, TODO-007

---

## P3 — Phase 3: Intelligence + Engagement

### TODO-013: Data freshness indicator
- **What:** Show "Data last updated: 3 days ago" in dashboard header. If data is >14 days old, show nudge: "Upload a fresh report?"
- **Why:** Wineries forget to re-upload. Subtle nudge drives re-engagement and data accuracy.
- **Effort:** S (30 min)
- **Priority:** P3
- **Files:** `frontend/src/components/Header.jsx`
- **Depends on:** TODO-021 (reads from latest import timestamp)

### TODO-014: Import comparison summary ("What Changed" diff)
- **What:** After importing new data, show diff summary vs. previous import of the same type: "+12 new accounts, volume up 8%, 3 accounts went inactive, Distributor X added."
- **Why:** Turns mundane data upload into an insightful moment. Users understand what changed in their territory.
- **Effort:** S (30 min — with normalized model, compare views before/after rebuild)
- **Priority:** P3
- **Files:** `frontend/src/components/DataImport.jsx`
- **Depends on:** TODO-021 (normalized model makes comparison trivial)

### TODO-015: Guided onboarding wizard
- **What:** Replace bare "Welcome" screen with 3-step wizard: (1) Select business role (Winery/Importer/Distributor/Retailer), (2) Upload first file, (3) See dashboard. Progress indicator.
- **Why:** First-time user experience is currently confusing. Guided flow drives activation. Role selection feeds into TODO-024.
- **Effort:** M (2 hours)
- **Priority:** P3
- **Files:** New component, `frontend/src/App.jsx`
- **Depends on:** TODO-024 (4-role system)

### TODO-016: Quick actions bar
- **What:** Floating action bar on territory tab: "Upload Data", "Export Report", "Accounts Needing Attention (N)".
- **Why:** Saves navigation to Settings for common actions. Sales managers want speed.
- **Effort:** S (1 hour)
- **Priority:** P3
- **Files:** New component, `frontend/src/App.jsx`
- **Depends on:** Nothing

### TODO-017: AI-generated weekly digest
- **What:** Cloud Function that generates a weekly summary email using Claude: top movers, overdue reorders, pipeline status. Send via SendGrid/Resend.
- **Why:** Killer engagement feature. Makes users feel like they have a personal analyst.
- **Effort:** L (4-6 hours)
- **Priority:** P3
- **Files:** New Cloud Function, email service integration
- **Depends on:** TODO-021 (normalized model), email service setup

### TODO-018: XLSX export for all tabs
- **What:** Wire up all "Export" buttons (currently console.log stubs) to generate and download XLSX files using the `xlsx` library (already a dependency).
- **Why:** Every "Export" button currently does nothing. Users expect to export their data.
- **Effort:** M (2-3 hours)
- **Priority:** P3
- **Files:** All dashboard components with export buttons
- **Depends on:** Nothing

### ~~TODO-019: Plan normalized data model for Phase 2~~ SUPERSEDED
- **Superseded by:** TODO-021. The normalized data model is now designed and will be implemented, not just planned.

### TODO-028: AI-powered "What should I do today?" card
- **What:** On the main dashboard, show a card with 3 actionable items generated from account + view data: "1. Call ABC Liquors — overdue for reorder by 15 days. 2. Check Southern Wine inventory — DOH dropped to 7. 3. Follow up with XYZ Bar — new placement, no reorder yet."
- **Why:** THIS is the killer feature. Transforms BI into a personal assistant. What makes a user open the app every morning.
- **Effort:** M (2 hours)
- **Priority:** P3
- **Files:** New `frontend/src/components/DailyActions.jsx`, Cloud Function or client-side Claude call
- **Depends on:** TODO-023 (accounts), TODO-022 (views)

### TODO-029: Smart account hover cards
- **What:** When hovering or clicking any account name anywhere in the dashboard, show a floating card with: last order date, total volume, trend arrow, distributor, and "View Account" link. Like GitHub user cards.
- **Why:** Creates the feeling of a connected system. Every account name becomes a portal to its full story.
- **Effort:** S (1 hour)
- **Priority:** P3
- **Files:** New `frontend/src/components/AccountCard.jsx`, wrap all account name renders
- **Depends on:** TODO-023 (accounts)

### TODO-030: Import timeline page
- **What:** In Settings or a new "Data Sources" page, show a visual timeline of all imports with metadata: date, file name, type, row count, accounts extracted. Each entry clickable to see what data came from that file.
- **Why:** Users feel in control of their data. Can see exactly what's feeding their dashboards. Can delete/undo specific imports.
- **Effort:** S (1 hour)
- **Priority:** P3
- **Files:** New component, `frontend/src/services/firestoreService.js`
- **Depends on:** TODO-021 (imports collection)

### TODO-031: Smart file type detection messaging
- **What:** When a file is dropped, show a friendly detection message: "Looks like a VIP Depletion Report from Southern Glazer's — I see 2,400 rows across 3 states." or "This looks like a QuickBooks Sales by Customer report with 150 accounts."
- **Why:** Builds trust in the AI. When the system correctly identifies your file type, you trust it to map columns correctly.
- **Effort:** S (30 min — AI mapper already detects type, just need better UX copy)
- **Priority:** P3
- **Files:** `frontend/src/components/DataImport.jsx`
- **Depends on:** Nothing

---
## P-Pricing — Pricing Studio Integration (from Wine Pricing Studio / port-louis)

> Added from CEO Scope Expansion review on 2026-03-16.
> Port-louis is a standalone React+TS pricing engine (8 US models, 8 international markets, reverse calc, What-If).
> This phase integrates it into Sidekick BI as a shared package + full-featured pricing module.

### ~~TODO-032: Extract pricing engine as shared TypeScript package~~ DONE
- Created `packages/pricing-engine/` with 30+ TypeScript files. Vite resolve alias. 7 test files passing.
- **Completed:** v0.2.1.0 (2026-03-16)

### ~~TODO-033: Pricing Studio page in Sidekick BI~~ DONE
- Full `/pricing` route with 8 components: MarketSelector, MarketInputForm, MarketWaterfall, RecapPanel, ComparisonPanel, AnalysisPanel, MultiMarketOverview, PricingStudio. BEM CSS. Sidebar "Tools" section. Margin guard (max 99.9%) implemented.
- **Completed:** v0.2.1.0 (2026-03-16)

### TODO-034: Portfolio management in Firestore
- **What:** New Firestore collection `tenants/{id}/pricing/portfolio/{wineId}` storing PortfolioWine documents. New PricingContext for state management. CRUD operations (add from calculator, edit, delete). Optional `productId` field for soft-link to tenant's productCatalog. Portfolio table view with sorting/filtering. Replaces port-louis's Zustand+localStorage with Firestore persistence.
- **Why:** Turns the calculator from a one-shot tool into a living portfolio. Multi-user, multi-device, persistent. Foundation for What-If and account pricing.
- **Pros:** Real persistence. Team collaboration. Links to CRM product catalog.
- **Cons:** Firestore reads/writes per portfolio operation. Need optimistic UI for save latency.
- **Effort:** M (3-4 hours)
- **Priority:** P1
- **Files:** New `frontend/src/context/PricingContext.jsx`, `frontend/src/services/firestoreService.js`, new `frontend/src/components/PricingStudio/PortfolioTable.jsx`
- **Depends on:** TODO-032, TODO-033, TODO-038

### TODO-035: What-If stress testing on portfolio
- **What:** Port the What-If panel from port-louis. User adjusts global overrides (FX shift %, tariff override, freight delta per case) and sees real-time impact across entire portfolio. Shows delta SRP, delta wholesale, low-margin warnings, negative-margin flags. Saved What-If snapshots in `tenants/{id}/pricing/snapshots/{id}` for historical comparison.
- **Why:** The #1 power feature. "Tariffs just went to 25% — show me the damage across my entire book." Pure client-side recalculation using `calculateWhatIf()` (already built and tested).
- **Pros:** Engine logic already exists and is tested. Snapshots enable historical comparison.
- **Cons:** Snapshot storage adds Firestore docs. UI needs to handle large portfolios (500+ wines) gracefully.
- **Effort:** M (2-3 hours)
- **Priority:** P2
- **Files:** New `frontend/src/components/PricingStudio/WhatIfPanel.jsx`, PricingContext updates
- **Depends on:** TODO-034

### TODO-036: FX rate Cloud Function + Firestore cache
- **What:** New callable Cloud Function `fetchExchangeRates()` that fetches from open.er-api.com, caches results in global `rates/latest` Firestore document with 1-hour TTL. Frontend reads cached rates on load via PricingContext. Falls back to MarketConfig defaults if cache stale + API down. Replaces port-louis's client-side fetch.
- **Why:** Prevents CORS issues, API rate limits from many clients, gives all tenants same cached rates.
- **Pros:** One API call per hour for all users. Reliable fallback chain (API → cache → defaults).
- **Cons:** New Cloud Function to maintain. External API dependency (mitigated by cache + defaults).
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `functions/index.js`, `frontend/src/context/PricingContext.jsx`
- **Depends on:** Nothing

### TODO-037: Account Detail pricing tab
- **What:** New tab on Account Detail page (`/accounts/:accountId`) showing all portfolio wines linked to this account's products (via `productId` soft-link). Per-product waterfall, current margin, quick What-If. "Price a wine for this account" CTA when no products linked.
- **Why:** Where CRM meets pricing. A sales rep clicks an account and sees margin intelligence alongside volume history.
- **Pros:** Connects the two systems at the user workflow level. High perceived value.
- **Cons:** Requires portfolio + product catalog linking. Query across pricing/ filtered by productId.
- **Effort:** M (2-3 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/AccountDetailPage.jsx`, new pricing tab component
- **Depends on:** TODO-034, TODO-027 (already shipped)

### TODO-038: Firestore security rules for pricing collection
- **What:** Add Firestore rules for `tenants/{tenantId}/pricing/{document=**}` using existing `isTenantMember()` helper. Add rules for global `rates/` collection (read-only for authenticated users, write-only via Cloud Functions admin SDK).
- **Why:** Security is not optional. Every new Firestore collection needs explicit rules.
- **Pros:** ~10 lines. Follows proven pattern.
- **Cons:** None.
- **Effort:** XS (15 min)
- **Priority:** P1 — BLOCKS deployment of any pricing persistence feature
- **Files:** `firestore.rules`
- **Depends on:** Nothing

### TODO-039: Integration tests for pricing Firestore operations
- **What:** Vitest integration tests using Firebase Emulator (already configured per TODO-026) for: portfolio CRUD (save/read/update/delete wine), tenant isolation (tenant A can't read tenant B's pricing data), FX rate Cloud Function (fetch/cache/stale fallback), What-If snapshot save/load.
- **Why:** Portfolio data in Firestore is the new trust boundary. Mocks won't catch permission rule errors.
- **Pros:** Real Firestore behavior. Catches security rule gaps. Emulator already set up.
- **Cons:** ~5-10s per test. Worth it for data integrity.
- **Effort:** S (1-2 hours)
- **Priority:** P1
- **Files:** New `functions/__tests__/pricing.integration.test.js`
- **Depends on:** TODO-032, TODO-034, TODO-038

### Vision Items (Delight Opportunities — <30 min each)

- **"Price This SKU" from Account Detail** — Button on account page opens Pricing Studio pre-filled with account's market context. Depends on TODO-033, TODO-037.
- **Margin traffic lights on portfolio** — Green/yellow/red dots on portfolio table based on margin thresholds (>25%, 15-25%, <15%). Depends on TODO-034.
- **"Share Price Sheet" export** — Branded XLSX price list per market from portfolio, formatted for distributor consumption. Depends on TODO-034, TODO-018.
- **FX alert badge** — Sidebar notification when exchange rates move >2% since last session. Depends on TODO-036.
- **Product catalog auto-link** — On portfolio save, offer "Add to Product Catalog" when no matching product exists. Depends on TODO-034.

---

## P1 — Billback Phase 1: Trade Spend Ingestion (Must Ship After Phase 1 Foundation)

> Added from Cathedral Vision Review on 2026-03-16. SCOPE EXPANSION mode.
> Vision: Trade Spend Intelligence Engine — billback ingestion → agreement tracking → reconciliation → producer allocation → predictive budgeting.
> Architecture: Claude Vision API for PDF extraction (single-call extract + map), wine entity with AI dedup, extend existing DataImport.
> **Eng review refinements (2026-03-16):** Base64 callable (not Storage). Single Claude call with all pages (not per-page). Separate extractWines callable (not inside rebuildViews). New functions/billback.js (not in index.js monolith). Shared deduplicateEntities() helper (TODO-047). Vintage IS wine identity. Conditional DataContext loading behind feature flag. BillbackReviewStep sub-component in DataImport.

### TODO-040: PDF Billback Extraction Cloud Function
- **What:** New `parseBillbackPDF` callable Cloud Function in `functions/billback.js` (re-exported from `index.js`). Accepts PDF binary as base64 via `httpsCallable`. Sends ALL pages as multi-image in a SINGLE Claude Vision API call (Claude supports up to 20 images per message — full document context for best accuracy). Extracts structured billback line items (wine, producer, amount, quantity, rate, program type, distributor, period). Returns JSON array of line items + metadata (distributor name, billback date, page count). Handles both digital and scanned PDFs. Rate limited (max 10/hour per tenant, reuse existing pattern).
- **Why:** Core new infrastructure — no PDF parsing exists today. Claude Vision handles digital + scanned PDFs in a single API call (~$0.02/page). The extraction + field mapping happens in ONE Claude call, which is architecturally simpler than a two-step parse-then-map pipeline.
- **Pros:** Unlocks the entire billback feature. Reusable for future PDF imports (invoices, POs, price lists). Uses existing Anthropic SDK.
- **Cons:** ~$0.02/page AI cost. Extraction accuracy depends on PDF quality. Requires user review step to catch hallucinations.
- **Context:** Billback line item schema:
  ```
  {
    wine: string,           // wine/product name as printed
    producer: string,       // producer/winery name
    sku: string,            // optional SKU/item code
    programType: string,    // MDF, depletion incentive, volume discount, promo, etc.
    amount: number,         // dollar amount (negative = credit memo)
    quantity: number,       // cases/units (optional)
    rate: number,           // per-unit rate (optional)
    period: string,         // billing period
    notes: string           // any additional text
  }
  ```
- **Error handling:** Invalid/corrupt PDF → clear error. Password-protected → tell user. >20 pages → reject with message. Claude timeout → retry 2x with backoff. Malformed JSON → retry 1x. Claude refusal → log full response, return error. Empty extraction → suggest clearer scan.
- **Security:** Sanitize any text extracted from PDF before including in downstream prompts. Validate amounts against reasonable ranges (flag >$100K or <$0.01). Prompt injection defense: sandwich PDF content between strong system prompt boundaries.
- **Effort:** M (3-4 hours)
- **Priority:** P1 — BLOCKS all billback work
- **Testing:** Mock Anthropic client for CI (valid JSON, malformed, timeout, refusal, empty). Real PDF snapshot tests (skipped in CI, run on-demand) for extraction accuracy.
- **Files:** New `functions/billback.js`, `functions/index.js` (re-export only), Cloud Function config
- **Depends on:** TODO-020 (shared pipeline), TODO-021 (normalized model)

### TODO-041: Wine/Product Entity with AI Dedup
- **What:** New `wines/{wineId}` Firestore collection under each tenant. Auto-extract wine names from billback line items on import. `extractWines` is a SEPARATE callable Cloud Function (not inside rebuildViews — failure isolation). Uses shared `deduplicateEntities()` helper (TODO-047). Normalize → exact match → Claude fuzzy match → create new / link / queue for review. Schema: `{ name, normalizedName, displayName, producer, vintage, varietal, sku, region, sourceNames[], firstSeen, lastSeen, importIds[], metadata: {} }`. **Vintage IS identity** — "Margaux 2018" ≠ "Margaux 2019". Wine normalization: strip accents (chateau→chateau), remove bottle sizes (750ml), keep vintage years, handle abbreviations (Ch.→Chateau, Dom.→Domaine). Confidence thresholds: >0.85 auto-link, 0.5-0.85 pending review, <0.5 create new. New `pendingWineMatches/` subcollection for review queue. Add Firestore security rules for `wines/` and `pendingWineMatches/` (same pattern as accounts/).
- **Why:** Wine-level tracking IS the value proposition. Without a wine entity, can't deduplicate "Chateau Margaux 750ml" vs "Chateau Margaux 2018 750" vs "MARG 750" across billbacks from different distributors. Also becomes the entity that connects billback spend to depletion volume (cross-source intelligence).
- **Pros:** Completes the CRM entity model (accounts + contacts + wines). Enables spend-per-wine analytics. Reuses proven extractAccounts pattern.
- **Cons:** New entity = new CRUD, new Firestore security rules, new UI pages. AI dedup cost (~$0.01/import). Wine names are messier than account names (vintages, abbreviations, foreign characters).
- **Error handling:** Claude API timeout → retry 2x, skip dedup, create all as new (safe default). Malformed AI response → fall back to create new. NaN confidence → parseFloat guard, default 0 (routes to "create new"). Empty wine name → skip.
- **Effort:** L (5-6 hours)
- **Priority:** P1
- **Files:** `functions/billback.js` (extractWines export), `firestore.rules` (add wines/ + pendingWineMatches/ rules), new `frontend/src/components/WineList.jsx`, new `frontend/src/components/WineDetail.jsx`
- **Depends on:** TODO-040 (PDF extraction provides wine names), TODO-047 (shared dedup helper), TODO-023 (extractAccounts must exist to refactor into shared helper)

### TODO-042: Billback Transforms + Spend Views
- **What:** New `transformBillback()` in `packages/pipeline/`. Aggregates billback line items into dashboard views: `spendByWine` (total spend, avg rate, # of billbacks per wine, period trend), `spendByDistributor` (total spend, program breakdown per distributor), `billbackSummary` (total spend by period, program type breakdown, top wines, top distributors). Extend `rebuildViews` Cloud Function to call `transformBillback` when billback imports exist. Handle negative amounts (credit memos) as credits in totals.
- **Why:** Without pre-computed views, every dashboard load scans all raw billback rows. Follows the exact pattern of `transformDepletion` → `distScorecard`/`accountsTop`.
- **Pros:** Fast dashboard rendering. Consistent with existing architecture. Simple group-by + sum aggregations.
- **Cons:** Another transform to maintain. Views must rebuild when any billback import changes.
- **Context:** Guards: qty === 0 → avoid division by zero in spend-per-case. Missing amount → skip row with warning log. All-credits → show negative total (valid).
- **Effort:** M (2-3 hours)
- **Priority:** P1
- **Testing:** Mandatory `transformBillback.test.js` with ~15-20 cases: happy path (multiple wines/dists/periods), empty input, single item, credits (negative amounts), missing amount (skip+warn), qty=0 (no divide), group-by-wine totals, group-by-dist totals, billbackSummary KPIs.
- **Files:** New `packages/pipeline/src/transformBillback.js`, `functions/index.js` (extend rebuildViews)
- **Depends on:** TODO-040, TODO-022 (rebuildViews)

### TODO-043: Billback UI (DataImport Extension + Dashboard + Routes)
- **What:** Three UI pieces: (1) Extend `DataImport.jsx` to accept PDFs — detect mime type (`application/pdf`), route to `parseBillbackPDF` Cloud Function, show `BillbackReviewStep` sub-component (editable table of extracted line items: amount, wine, producer, program type) before save. User must confirm before data is persisted (hallucination guard). Single component with conditional step rendering (not separate import page). (2) New `BillbackDashboard.jsx` — spend-by-wine table, spend-by-distributor table, program type breakdown chart, period filter, total spend KPI cards. DataContext loads billback views CONDITIONALLY behind `features.billbacks` flag (not unconditionally). (3) New routes in `config/routes.js`: `/billbacks` (dashboard), `/wines` (wine list), `/wines/:wineId` (wine detail with spend history). Add to sidebar navigation and command palette. Feature-gated: `tenantConfig.features.billbacks`.
- **Why:** The user-facing layer that makes all the backend work visible. The review step is mandatory for AI hallucination protection. The dashboard is where the daily value lives.
- **Pros:** Follows existing patterns (DataGate for empty states, sidebar routing, BEM CSS). Single DataImport entry point (DRY). Feature-flagged for safe rollout.
- **Cons:** ~3 new components + route config. DataImport.jsx gets more complex (PDF branch alongside CSV/XLSX branch).
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** `frontend/src/components/DataImport.jsx` (extend), new `frontend/src/components/BillbackDashboard.jsx`, new `frontend/src/components/WineList.jsx`, new `frontend/src/components/WineDetail.jsx`, `frontend/src/config/routes.js`, `frontend/src/components/Sidebar.jsx`, `frontend/src/config/tenant.js` (add `features.billbacks`)
- **Depends on:** TODO-040 (extraction), TODO-042 (views), TODO-041 (wines)

### TODO-047: Extract shared deduplicateEntities() helper
- **What:** Extract entity dedup logic from `extractAccounts` (functions/index.js:678-900) into a shared `deduplicateEntities()` function in `functions/entityDedup.js`. Parameters: `{ entityType, collectionPath, normalizeFn, sanitizeFn, aiPromptTemplate, rawNames, existingEntities, tenantId, importId, db, anthropicClient }`. Returns `{ created, linked, pending }`. Refactor `extractAccounts` to use this helper. Then `extractWines` in `functions/billback.js` calls the same helper with wine-specific normalization + prompt.
- **Why:** DRY — ~150 LOC of dedup logic (sanitize, normalize, exact match, AI fuzzy match with retries, confidence routing to auto-link/pending/create-new, pending matches queue, fallback on AI failure) would otherwise be duplicated between accounts and wines. Bug fixes apply to both.
- **Pros:** Single source of truth for dedup behavior. Easy to add future entity types. Wine-specific normalization is cleanly injected, not hardcoded.
- **Cons:** Refactoring extractAccounts carries regression risk. Must verify existing behavior unchanged with tests.
- **Context:** Key differences between account and wine dedup: (a) normalization rules (accounts strip Inc/LLC; wines strip accents, bottle sizes, keep vintage), (b) AI prompt (wine matching vs account matching), (c) Firestore collection paths (accounts/ vs wines/, pendingMatches/ vs pendingWineMatches/). The helper abstracts over these.
- **Testing:** Mandatory tests: normalization per entity type, dedup flow with mocked AI (exact match, confidence routing, timeout fallback, malformed JSON fallback, NaN confidence), regression test that extractAccounts behavior is unchanged after refactor.
- **Effort:** M (2-3 hours)
- **Priority:** P1 — BLOCKS TODO-041
- **Files:** New `functions/entityDedup.js`, refactor `functions/index.js` (extractAccounts), `functions/billback.js` (extractWines uses helper)
- **Depends on:** TODO-023 (extractAccounts must exist first to refactor from)

---

## P2 — Billback Phase 2: Reconciliation

### TODO-044: Agreement Management + Auto-Reconciliation
- **What:** New `agreements/{agreementId}` Firestore collection. CRUD UI for marketing programs: define distributor, wine(s), program type (MDF, depletion incentive, volume discount, promo), agreed rate/amount, start/end date, terms text. Auto-reconciliation engine: when billbacks are imported, match line items against active agreements by distributor + wine + program type. Flag anomalies: wrong rate (>5% deviation from agreement), expired agreement, wine not covered by any agreement, duplicate charge (same wine + amount + period seen before). Show reconciliation status on billback dashboard with color-coded indicators (green = matches agreement, yellow = no agreement found, red = rate mismatch or anomaly).
- **Why:** This is where billback tracking goes from "organized data" to "money-saving tool." Importers routinely get overcharged on billbacks and don't catch it because they can't cross-reference against agreements at scale. This is the 10x differentiator.
- **Pros:** Direct ROI for users (catches billing errors = real money saved). Unique in the market. Natural extension of billback data.
- **Cons:** Complex domain logic (agreement terms vary wildly across distributors and programs). Needs real billback data to validate schema. Significant UI surface (agreement CRUD + reconciliation views).
- **Effort:** XL (10-15 hours)
- **Priority:** P2
- **Files:** New `frontend/src/components/Agreements.jsx`, new `frontend/src/components/ReconciliationView.jsx`, `functions/index.js` (reconciliation logic), `firestore.rules`
- **Depends on:** TODO-040, TODO-041, TODO-042, TODO-043 (all Phase 1 billback)

---

## P3 — Billback Phase 3: Intelligence

### TODO-045: Producer Allocation Dashboard
- **What:** Dashboard view showing marketing spend allocated per producer. For importers representing multiple wineries/producers: total spend by producer over time, spend per case (marketing efficiency = billback spend ÷ depletion cases when depletion data exists), ROI analysis (spend vs depletion lift), one-click XLSX/PDF export for producer reporting ("here's what we invested in your wines this quarter"). Formatted professionally for direct emailing to producers.
- **Why:** Importers NEED to report back to producers on marketing spend. Today this is a painful manual spreadsheet exercise. Automating it saves hours per quarter and looks more professional. Strengthens importer-producer relationships.
- **Pros:** High-value, low-effort once wine entities and billback views exist. Differentiating feature. Natural extension.
- **Cons:** Requires cross-source data (billbacks + depletions) for full ROI analysis. Export formatting takes effort.
- **Effort:** M (3-4 hours)
- **Priority:** P3
- **Files:** New `frontend/src/components/ProducerAllocation.jsx`, extend `packages/pipeline/src/transformBillback.js`
- **Depends on:** TODO-041 (wines), TODO-042 (spend views), ideally TODO-022 (depletion views for ROI)

### TODO-046: Predictive Spend Budgeting
- **What:** AI-powered spend forecasting. Based on historical billback patterns (6+ months of data), predict next quarter's marketing spend by wine, by distributor, by program type. Budget planning view: "Based on your history, expect ~$45K in billbacks next quarter — $18K from SGWS, $12K from RNDC..." Allow users to set budget targets per wine/distributor/program and get alerts when actuals deviate from budget (>15%).
- **Why:** Transforms reactive spend tracking into proactive budget planning. The data to power this is a natural byproduct of Phase 1 ingestion over time.
- **Pros:** Extremely high perceived value ("your CRM predicts your costs"). Low marginal effort once data exists.
- **Cons:** Needs 6+ months of data to be meaningful. Prediction accuracy depends on data consistency. Could be misleading with sparse data — need minimum data threshold before showing predictions.
- **Effort:** M (3-4 hours)
- **Priority:** P3
- **Files:** New `frontend/src/components/SpendForecast.jsx`, Cloud Function for AI forecasting
- **Depends on:** TODO-042 (spend views), 6+ months of billback history

### Billback Delight Items (S effort each, post-Phase 1)
- **Smart billback summary toast** — After extraction: "SGWS Q4 — $14,200 across 8 wines. 2 wines not in portfolio." (30 min)
- **Spend-per-case overlay** — On depletion dashboard, show marketing $/case per wine from billback data. (1 hour)
- **Producer report export** — One-click PDF/XLSX "Marketing Investment Report for [Producer]." (1 hour)
- **Duplicate charge detection** — Flag line items matching previous billbacks (same wine + amount + period). (1 hour)
- **Billback email forwarding** — Tenant-specific ingest email address for auto-import. (L effort, 4-6 hours, needs email infra)

---

## Phase Dependency Graph

```
TODO-020 (shared package)
    │
    ├── TODO-021 (normalized data model)
    │       │
    │       ├── TODO-022 (rebuildViews Cloud Function)
    │       │       │
    │       │       ├── TODO-026 (Firebase Emulator + integration tests)
    │       │       │
    │       │       └── TODO-042 (billback transforms + spend views)
    │       │               │
    │       │               ├── TODO-046 (predictive spend budgeting) ← Phase 3
    │       │               └── TODO-043 (billback UI) ← also needs TODO-040, TODO-041
    │       │                       │
    │       │                       └── TODO-044 (agreement mgmt + reconciliation) ← Phase 2
    │       │
    │       ├── TODO-023 (account extraction + AI dedup)
    │       │       │
    │       │       ├── TODO-027 (Account Detail Page) ← also needs TODO-007
    │       │       ├── TODO-028 (Daily Actions card)
    │       │       ├── TODO-029 (Account hover cards)
    │       │       └── TODO-047 (extract shared deduplicateEntities helper)
    │       │               │
    │       │               └── TODO-041 (wine entity + AI dedup) ← uses shared helper
    │       │                       │
    │       │                       └── TODO-045 (producer allocation dashboard) ← Phase 3
    │       │
    │       ├── TODO-040 (PDF billback extraction Cloud Fn) ← NEW INFRA
    │       │       │
    │       │       ├── TODO-041 (wine entity)
    │       │       └── TODO-042 (billback transforms)
    │       │
    │       ├── TODO-025 (content hash dupe detection)
    │       ├── TODO-014 (import comparison diff)
    │       ├── TODO-030 (import timeline)
    │       └── TODO-013 (data freshness)
    │
    └── TODO-024 (4 industry roles)
            │
            └── TODO-015 (onboarding wizard)

TODO-032 (pricing engine package) ✓ DONE ◄── PRICING TREE
    │
    ├── TODO-033 (Pricing Studio page) ✓ DONE
    │       │
    │       └── TODO-034 (portfolio in Firestore) ← also needs TODO-038
    │               │
    │               ├── TODO-035 (What-If stress testing)
    │               ├── TODO-037 (Account Detail pricing tab) ← also needs TODO-027 ✓
    │               └── Vision: margin lights, price sheet, auto-link
    │
    └── TODO-039 (pricing integration tests) ← also needs TODO-034, TODO-038

Independent (pricing):
    TODO-036 (FX rate Cloud Function)
    TODO-038 (Firestore security rules for pricing)
    Vision: FX alert badge ← needs TODO-036
    Vision: "Price This SKU" ← needs TODO-033, TODO-037

Independent:
    TODO-007 (React Router) ✓ DONE
    TODO-009 (OAuth HMAC signing) ← SECURITY
    TODO-012 (audit trail)
    TODO-016 (quick actions)
    TODO-017 (weekly digest) ← needs email service
    TODO-018 (XLSX export)
    TODO-031 (smart file detection UX)
```
