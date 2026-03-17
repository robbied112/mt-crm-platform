# TODOS — Sidekick BI (MT CRM Platform)

> Updated from CEO CRM Pipeline Review on 2026-03-16.
> Previous: CEO App Review (Onboarding & Activation) on 2026-03-16.
> Previous: CEO Disruption Review + Eng Review on 2026-03-16.
> Previous: Cathedral Vision Review + Eng Review on 2026-03-15.
> CEO review: SCOPE EXPANSION mode. Eng review: BIG CHANGE mode (full Phase 1).
> Key eng review correction: full rebuild only (not incremental) — momentum/consistency need ALL rows.
> Phase 1 = Foundation + Daily Value, Phase 2 = CRM + Connected Intelligence, Phase 3 = Industry Platform, Phase 4 = Moat + Scale.
>
> **CEO Review Key Decisions (2026-03-16):**
> - RENAME product from "Sidekick BI" — name undermines authority, doesn't signal wine/spirits
> - GO VERTICAL on wine & spirits — own the niche completely (Toast for restaurants playbook)
> - DAILY ACTIONS promoted to P1 — the feature that creates daily usage habit
> - CONNECTOR FRAMEWORK designed now — data source abstraction is the long-term moat
> - EXPORTS promoted to P1 — broken buttons = broken trust
> - STAGING + CI before TODO-021 migration — non-negotiable safety
> - VIEW VALIDATION added to TODO-022 — validate output before writing, warn on anomalies
>
> **Onboarding & Activation added 2026-03-16 (CEO App Review).**
> Vision: Data Setup Assistant — role-aware, distributor-specific guided activation with report guides, data health tracking, and setup analytics. TODO-048 through TODO-054.
> Key decisions: Static config for report guides (config/reportGuides.js). Non-blocking sidebar card (not forced wizard). Built-in analytics to Firestore (not Firebase Analytics dependency). Generic fallback + distributor request logging for unlisted systems.
> TODO-015 (onboarding wizard) and TODO-031 (smart file detection) superseded by TODO-049 and TODO-053.
>
> **Billback / Trade Spend Intelligence added 2026-03-16.**
> Vision: PDF billback ingestion → wine entity with AI dedup → spend dashboards → agreement reconciliation → producer allocation → predictive budgeting.
> Key decisions: Claude Vision API (single-call extract+map), extend DataImport (not separate page), wine entity follows account extraction pattern.
>
> **CRM Pipeline Unification added 2026-03-16 (CEO Pipeline Review).**
> Vision: Unified account lifecycle — pipeline IS the CRM. Typed opportunities (BTG, New Placement, Wine Dinner, etc.) with per-type stage workflows. Product catalog + wine picker. Mobile-first pipeline cards. Auto-promote prospect → active on Won. TODO-056 through TODO-062.
> Key decisions: Separate opportunities collection (not single-entity) because reps visit accounts weekly with new wines. Hardcoded type defaults in config, admin UI later. Cascade delete for opportunities on account delete. Guided empty state (not demo data) for first pipeline use.

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

### ~~TODO-020: Extract shared pipeline package (REPLACES TODO-006)~~ DONE
- Implemented in commit `b090f52`. Created `packages/pipeline/src/` with parseFile.js, transformData.js, semanticMapper.js, normalize.js. Both `frontend/` and `functions/` import from shared package.

### ~~TODO-021: Implement normalized data model (imports/ + views/)~~ DONE
- Implemented in commit `4ced48d`. firestoreService.js has saveImport, loadImports, loadImportRows, deleteImport, loadAllViews, saveAllViews. DataContext supports useNormalizedModel feature flag. Firestore rules updated for imports/, views/, pendingMatches/.

### ~~TODO-022: Build rebuildViews Cloud Function (full rebuild)~~ DONE (base implementation)
- Implemented in commit `3e8612d`. Full rebuild Cloud Function with rate limiting (10/hour), per-type transform, chunked view writes, rebuild history tracking. **Still needs:** output validation (TODO-046), concurrent lock (TODO-047), parallel row loading (eng review Issue 2).

### ~~TODO-023: Auto-extract account entities with AI dedup~~ DONE
- Implemented in commit `3e8612d`. extractAccounts Cloud Function with: exact match via normalized names, AI fuzzy match via Claude (confidence thresholds: >0.85 auto-link, 0.5-0.85 pending review, <0.5 create new), retry 2x with backoff, prompt injection sanitization, account metadata extraction from rows.

### ~~TODO-024: Expand role system to 4 industry roles~~ DONE
- Implemented in commit `ce26c26`. 4 roles (Winery, Importer, Distributor, Retailer) with role-specific terminology, field definitions, and semantic mapping. Role matrix in tenant.js.

### ~~TODO-026: Firebase Emulator + integration tests~~ DONE
- Implemented in commit `763da9f`. Firebase Local Emulator Suite configured. Integration test harness with Vitest. Tests for import → rebuild → verify views, account extraction + dedup, rate limiting.

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

### ~~TODO-015: Guided onboarding wizard~~ SUPERSEDED by TODO-049
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

### ~~TODO-018: XLSX export for all tabs~~ DONE ← PROMOTED TO P1 (CEO review)
- Created `frontend/src/utils/exportXlsx.js` utility. Wired up 6 export buttons across ReorderForecast, ScorecardTable, InventoryTable, AccountInsights, CustomerPipeline. Each exports filtered/sorted data with proper column headers.

### ~~TODO-019: Plan normalized data model for Phase 2~~ SUPERSEDED
- **Superseded by:** TODO-021. The normalized data model is now designed and will be implemented, not just planned.

### ~~TODO-028: "What should I do today?" daily actions card~~ DONE ← PROMOTED TO P1 (CEO review)
- Created `frontend/src/components/DailyActions.jsx` with rules-based v1. Computes up to 3 prioritized actions from: overdue reorders, declining accounts, low distributor health, stalling pipeline deals. Added to top of MyTerritory dashboard. BEM-styled with priority color borders. Shows positive empty state when all accounts on track.

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

### ~~TODO-031: Smart file type detection messaging~~ SUPERSEDED by TODO-053
- **What:** When a file is dropped, show a friendly detection message: "Looks like a VIP Depletion Report from Southern Glazer's — I see 2,400 rows across 3 states." or "This looks like a QuickBooks Sales by Customer report with 150 accounts."
- **Why:** Builds trust in the AI. When the system correctly identifies your file type, you trust it to map columns correctly. This is the "wow" moment in onboarding.
- **Effort:** S (30 min — AI mapper already detects type, just need better UX copy)
- **Priority:** P2 ← promoted from P3 in CEO review (delight opportunity)
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

## New from CEO Disruption Review (2026-03-16)

### TODO-032: Product rename (from "Sidekick BI")
- **What:** Rename product across all touchpoints: LandingPage.jsx, Login.jsx, index.html, nav bar, footer, email addresses (hello@sidekickbi.com), Stripe config, Firebase project display name. Choose a name that signals: wine & spirits industry, authority (not "sidekick" energy), and intelligence/clarity.
- **Why:** "Sidekick" = secondary/helper. "BI" = enterprise jargon the target user doesn't identify with. Neither word signals wine/spirits. The name is the #1 brand lever and the first thing every potential user sees.
- **Effort:** S (2-3 hours for code changes, separate branding exercise for choosing the name)
- **Priority:** P1 — must complete before any public launch
- **Depends on:** Branding exercise (choosing the new name)

### TODO-033: Promote daily actions card to P1 (see TODO-028)
- **Status:** TODO-028 has been updated in-place with P1 priority and rules-based v1 spec.

### TODO-034: Data source connector framework
- **What:** Design and build an abstraction layer for data sources. Each import gets a `source` field: `{ type: 'file_upload' | 'google_drive' | 'email_forward' | 'api_connector', sourceId, metadata: {...} }`. Build the framework with file_upload as the first connector. Google Drive sync (existing) becomes the second. Email forwarding (users forward distributor report emails to a tenant-specific address) as a Phase 2 win. Distributor API connectors (VIP, Encompass, iDIG) as the long-term moat.
- **Why:** Manual file upload is the ceiling on daily usage. If data flows in automatically, the product becomes always-current. Direct distributor integrations are what separates this from every competitor.
- **Pros:** Moat-building. Reduces user friction. Enables real-time data freshness.
- **Cons:** Framework complexity. Each connector is a maintenance surface. API access to distributor systems may require partnerships.
- **Effort:** L (6-8 hours for framework + email connector prototype)
- **Priority:** P1 for schema design (add `source` field to TODO-021 import schema), P2 for email connector, P3 for distributor API connectors
- **Files:** `frontend/src/services/firestoreService.js`, `functions/index.js`, new `functions/connectors/`
- **Depends on:** TODO-021 (normalized model with source field)

### TODO-035: Minimum viable compliance (tenant data deletion + privacy page)
- **What:** Build a "Delete all my data" Cloud Function that recursively deletes a tenant's Firestore data (imports, views, CRM, config, user profiles). Add a `/privacy` page describing what data is stored, how long, and how to request deletion. Add "Delete Account" button to Settings with confirmation flow.
- **Why:** Distributor reports contain PII (account names, addresses, buyer contacts). CCPA requires deletion capability for California businesses. Many wineries are in CA. This removes legal liability before launch.
- **Effort:** S (2-3 hours)
- **Priority:** P2 — before any paid customers
- **Depends on:** Nothing

### TODO-036: Firebase staging project + GitHub Actions CI
- **What:** Create a second Firebase project (e.g., `sidekick-bi-staging`) for pre-production testing. Add GitHub Actions workflow: on push to main, run Vitest suite. On PR, run tests + deploy to staging. Block merge if tests fail.
- **Why:** The normalized data model migration (TODO-021) is a schema change. Deploying directly to production with no test gate risks corrupting user data. Staging + CI is a 2-hour setup that protects every future deploy.
- **Effort:** S (2 hours)
- **Priority:** P1 — must be done BEFORE TODO-021 migration
- **Depends on:** Nothing
- **Status:** Staging Firebase project now exists (`mt-crm-platform-staging`) and GitHub Actions wiring is configured with repo variable `FIREBASE_PROJECT_STAGING` and secret `GCP_SA_KEY_STAGING`. Remaining gap: push the workflow to GitHub and enable branch protection / required status checks on `main` so failing CI actually blocks merges.

### TODO-037: Lightweight observability (Firebase Analytics + error alerts)
- **What:** Enable Firebase Analytics. Add event tracking for: file upload (with type + row count), signup (with role), feature usage (which tabs visited), export clicks, daily actions card interactions. Set up Cloud Function error alerting via Firebase monitoring (email on function failure).
- **Why:** You need to know what users actually do. Which features drive retention? What file types are most common? When do Cloud Functions fail? Without this, product decisions are guesses.
- **Effort:** S (2-3 hours)
- **Priority:** P2
- **Depends on:** Nothing

### ~~TODO-038: Create CLAUDE.md~~ DONE
- Added `CLAUDE.md` at project root with architecture diagram, local dev setup, conventions, critical paths, testing strategy, and Firestore schema map.

### Eng Review TODOs (2026-03-16)

### ~~TODO-043: Split functions/index.js into domain modules~~ DONE
- Split into `functions/helpers.js`, `functions/stripe.js`, `functions/ai.js`, `functions/rebuild.js`, `functions/accounts.js`, `functions/sync.js`. `index.js` is now a 17-line barrel re-exporter.

### ~~TODO-044: Extract shared chunked Firestore helper + DATASETS constant~~ DONE
- Added `packages/pipeline/src/constants.js` + `packages/pipeline/src/firestore.js` and mirrored them into `functions/lib/pipeline/`. `frontend/src/services/firestoreService.js`, `functions/rebuild.js`, `functions/helpers.js`, and test helpers now share dataset constants and chunked read/write logic. Versioning normalized on integer increments.

### ~~TODO-045: Refactor processTenantSync to use normalized model~~ DONE
- `functions/sync.js` now stores Drive-ingested rows in `imports/` with `source.type = "google_drive"` metadata and then calls `rebuildViewsForTenant()`. Removed the inline legacy `data/` write path. Manual sync UI also now calls `cloudSyncSyncNow`.

### ~~TODO-046: NaN guard clauses in transforms + validation sweep in rebuildViews~~ DONE
- Added `validateViews(mergedViews, tenantId)` in `functions/rebuild.js`. Scans all numeric values for NaN/Infinity, replaces with 0, logs warnings per field. Called after transform loop, before write loop.

### ~~TODO-047: Concurrent rebuild lock for rebuildViews~~ DONE
- Added rebuild lock in `functions/rebuild.js`. Checks `rebuildLock` on config/main with 5-minute TTL. Acquires before rebuild, releases on success or error.

### Delight TODOs (from CEO review)

### TODO-039: Personalized morning greeting + territory snapshot
- **What:** Replace neutral MyTerritory header with "Good morning, Sarah" + 3-line territory snapshot: "847 active accounts | 3 overdue reorders | Southern Glazer's health dropped to Yellow."
- **Why:** Makes the product feel personal. Says "I know who you are and I already read your data."
- **Effort:** S (30 min — data already exists in DataContext)
- **Priority:** P2 (delight)
- **Depends on:** Nothing

### TODO-040: Distributor health trend sparklines
- **What:** Next to each distributor's health score in the scorecard table, show a tiny 3-month trend sparkline (up/flat/down). Requires storing historical scores (one snapshot per rebuild).
- **Why:** Static scores are informative. Trends are actionable. A declining sparkline triggers a call. A static "78" triggers nothing.
- **Effort:** M (2-3 hours — need historical score storage + sparkline component)
- **Priority:** P3 (delight)
- **Depends on:** TODO-022 (rebuild stores historical snapshots)

### TODO-041: "Copy as table" for dashboard sections
- **What:** Clipboard icon on every table/scorecard. Click copies formatted TSV that pastes beautifully into email, Slack, or Google Docs.
- **Why:** Sales managers constantly share data from tools. One-click copy makes this the source of truth for team communication.
- **Effort:** S (1 hour)
- **Priority:** P3 (delight)
- **Depends on:** Nothing

### TODO-042: Account auto-complete + keyboard navigation
- **What:** Extend Command Palette for universal account search. Add keyboard shortcuts: `g t` for territory, `g a` for accounts, `g d` for depletions (like GitHub navigation).
- **Why:** Power users judge tools by navigation speed. Keyboard shortcuts signal "built by people who use it."
- **Effort:** M (2 hours)
- **Priority:** P3 (delight)
- **Depends on:** TODO-023 (accounts collection)

---

## P1 — Onboarding & Activation (from CEO App Review 2026-03-16)

> Added from CEO App Review on 2026-03-16. SCOPE EXPANSION mode.
> Core insight: The app has 17 routes of deep functionality but near-zero guidance on what data to bring, from which distributor systems, or what workflow to follow. Users who sign up see demo data, think "cool," then bounce because they don't know how to replicate it with their own data. Every new user currently requires a white-glove onboarding call — that doesn't scale.
> Vision: Data Setup Assistant — role-aware, distributor-specific guided activation. User selects their distributors, gets step-by-step report download instructions per system, uploads with confirmation ("Looks like a SGWS Weekly Depletion Report — 2,400 rows!"), and sees a Data Health Card tracking what's loaded and what's missing.
> Architecture: Static config file (config/reportGuides.js), persistent sidebar card, /setup route, lightweight Firestore analytics. No new Cloud Functions. Fully reversible.

### TODO-048: Report Guide Content System (config/reportGuides.js)
- **What:** Static config file with structured report guides for major distributor systems. **Unified schema** serving both Setup Assistant UI (human text) and file detection (column signatures). Each guide entry includes: system name, shortName, portalName, logo URL, `headerSignatures[]` (arrays of column names for fingerprinting uploaded files), `filenamePatterns[]` (regexes for filename matching), and `reports{}` object with per-report-type entries containing title, steps[], tips[], expectedColumns[]. Start with 5 systems: Southern Glazer's (SGWS Portal), Breakthru Beverage (Encompass), Republic National (iDIG), Young's Market, and a Generic fallback. Each system has guides for 2-3 report types (Depletion, Inventory, Shipment). Include role-aware recommendations (wineries vs importers see different "start here" suggestions).
- **Why:** This is the content that makes the Setup Assistant valuable. Without it, we're just another "upload a file" wizard. The specificity ("Go to Reports > Depletion > Weekly > Export as Excel") is what builds trust. The unified schema means one source of truth for both human guidance and automated file detection (DRY).
- **Pros:** Version-controlled. No API calls. Easy to update. Unified schema prevents drift between guide content and detection logic. Can upgrade to CMS later without architectural changes.
- **Cons:** Requires content research per distributor system. Screenshots may go stale as portals change.
- **Effort:** M (3-4 hours — mostly content research + structuring)
- **Priority:** P1 — blocks Setup Assistant
- **Testing:** `reportGuides.test.js` — validates every guide has required fields (name, reports, headerSignatures), lookup works, generic fallback works, header signature matching returns correct distributor ID.
- **Files:** New `frontend/src/config/reportGuides.js`
- **Depends on:** Nothing

### TODO-049: Setup Assistant Page (/setup route + SetupAssistant.jsx)
- **What:** New `/setup` route with multi-section page: (1) Role confirmation — pre-filled from signup, editable. (2) Distributor selector — "Which distributors do you work with?" with checkboxes for major systems + "Other" free text field. (3) Report guide viewer — select a distributor, see step-by-step instructions for pulling each report type from config/reportGuides.js. Screenshots lazy-loaded. Text-only fallback when no screenshots. (4) Upload launcher — "Ready? Drop your file here" linking directly to DataImport. (5) Data Health Card (TODO-051) — visual progress meter showing which data types are loaded and what's still missing. Reads/writes onboarding state to `tenants/{id}/config/main.onboarding` (distributors[], completedSteps[], dataHealth{}, dismissedAt). Handles resume (user can leave and come back — state persists). Generic guide shown when user's distributor isn't in the guide list (with Firestore logging of requested distributor name for analytics). Responsive BEM CSS.
- **Why:** This is the core activation flow. Turns "I signed up, now what?" into "I know exactly what to download, from where, and what happens next." Targets self-serve activation without white-glove onboarding calls.
- **Pros:** Non-blocking (user can explore demo data alongside). Resumable. Role-aware. Builds on existing AuthContext/DataContext.
- **Cons:** 6-8 hours of work. New route + component. Needs TODO-048 content to be useful.
- **Context:** Onboarding state schema on config/main:
  ```
  onboarding: {
    distributors: ["sgws", "breakthru"],
    completedSteps: ["role", "distributors", "first-upload"],
    dataHealth: { depletions: true, inventory: false, pipeline: false },
    dismissedAt: null | timestamp
  }
  ```
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Eng review decisions:** DistributorSelector and ReportGuide are INLINE in SetupAssistant.jsx (not separate files) — they're only used here. DataHealthCard.jsx IS a separate file (reused in MyTerritory). Always write the full `onboarding{}` object to Firestore, never partial patches (avoids shallow merge bugs).
- **Testing:** `onboardingState.test.js` — state machine transitions (fresh→in-progress→complete). `sidebarSetupCard.test.js` — show/hide/dismiss/collapsed states.
- **Files:** New `frontend/src/components/SetupAssistant.jsx`, new `frontend/src/components/DataHealthCard.jsx`, `frontend/src/config/routes.js`, `frontend/src/components/Sidebar.jsx`, `frontend/src/components/CommandPalette.jsx`
- **Depends on:** TODO-048 (report guide content)

### TODO-050: Setup Progress Sidebar Card
- **What:** Persistent card in the sidebar (above user menu, below nav links) showing onboarding progress: "Setup: 2/4 complete" with mini progress bar and "Continue Setup →" link to /setup. Shows only when onboarding is not complete and not dismissed. Dismissable with X (stores `dismissedAt` timestamp on config/main.onboarding). Re-accessible anytime via /setup URL or Command Palette. Card styling: subtle background, consistent with sidebar BEM classes.
- **Why:** The sidebar is always visible. This keeps the activation path in peripheral vision without blocking the user from exploring. The best onboarding doesn't force — it reminds.
- **Pros:** Non-intrusive. Always visible. Dismissable. Re-accessible.
- **Cons:** Adds visual element to sidebar. Need to handle collapsed sidebar state.
- **Eng review decision:** Collapsed sidebar mode shows a small setup icon with progress dot/badge (like a notification indicator). Matches existing sidebar patterns where collapsed = icon-only. Full card renders when sidebar is expanded.
- **Effort:** S (1-2 hours)
- **Priority:** P1
- **Files:** `frontend/src/components/Sidebar.jsx`
- **Depends on:** TODO-049 (Setup Assistant page)

### TODO-051: Data Health Card Component
- **What:** Reusable `DataHealthCard.jsx` that computes and displays data completeness. Reads from DataContext availability flags to determine which data types are loaded (depletions, inventory, accounts, pipeline, billbacks). Shows: visual checklist with ✅/⬜ per data type, overall "health score" percentage, contextual nudge for the next recommended upload ("Upload inventory data to unlock reorder forecasting →"), and role-aware messaging (wineries see different recommendations than importers). Used on /setup page AND optionally on MyTerritory dashboard (replacing or enhancing WelcomeState for partial-data users).
- **Why:** Solves the "what am I missing?" problem. Users who uploaded depletions but not inventory don't know they're leaving value on the table. Makes the invisible visible.
- **Pros:** Reusable across setup page and dashboard. Reads from existing DataContext flags (no new queries). Role-aware.
- **Cons:** Need to define "complete" per role (wineries need different data than importers).
- **Effort:** M (2-3 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/DataHealthCard.jsx`
- **Depends on:** TODO-049 (setup page uses it), but component is independently useful

### TODO-052: Setup Analytics
- **What:** Lightweight event tracking for the Setup Assistant activation funnel. Logs to Firestore at `tenants/{id}/analytics/setup/{eventId}`: setup_started, distributor_selected, guide_viewed, guide_not_found (with free-text distributor name for prioritizing new guides), upload_started_from_guide, setup_completed (with time_to_complete), setup_dismissed (with step_at_dismissal). No Firebase Analytics dependency. Simple batch-safe Firestore writes.
- **Why:** The Setup Assistant is a growth feature. Without activation funnel data, you can't tell if it works, where users drop off, or which distributor guides to build next. This is the "test suite" for the feature.
- **Eng review decisions:** NO global `distributorRequests/` collection — distributor names logged in tenant-scoped analytics only (guide_not_found event). Aggregate later with Cloud Function or manual query. This avoids new security rules for a global collection. Fire-and-forget pattern: catch all Firestore errors silently, `console.warn` only, never block UI or surface to user.
- **Testing:** `setupAnalytics.test.js` — events dispatched correctly, Firestore errors swallowed (never throws).
- **Effort:** S (1-2 hours)
- **Priority:** P1 — ships with Setup Assistant
- **Files:** New `frontend/src/services/setupAnalytics.js`, `firestore.rules` (add `analytics/` subcollection rules using existing `isTenantMember()` pattern)
- **Depends on:** TODO-049

### TODO-053: Smart File Detection Messaging (supersedes TODO-031)
- **What:** After a file is dropped in DataImport, show a rich detection message referencing the distributor system: "Looks like a Weekly Depletion Report from Southern Glazer's — I see 2,400 rows across 3 states. Nice!" or "This looks like a QuickBooks Sales by Customer report with 150 accounts." Distributor system recognition via filename patterns and header column signatures (SGWS reports have "PREMISE TYPE", VIP has "CORP ITEM CD", Encompass has specific header patterns). When the user came from a Setup Assistant report guide, show: "✅ This matches the report type we recommended." Leverages existing AI mapper detection + adds system fingerprinting from reportGuides.js column signatures.
- **Why:** This is the "wow" moment. When the system correctly identifies your specific distributor report, trust goes through the roof. Says "this tool was built for people like me." Directly addresses the activation problem — confirms users got the right report.
- **Effort:** S (1-2 hours — AI mapper already detects type, this adds UX copy + distributor pattern matching)
- **Priority:** P1 — ships with or right after Setup Assistant
- **Files:** `frontend/src/components/DataImport.jsx`, reads from `frontend/src/config/reportGuides.js`
- **Depends on:** TODO-048 (distributor system definitions with column signatures)

### TODO-054: Post-Import "What's Next" Card
- **What:** After a successful import (Step 4 of DataImport), replace the bare "Import Complete" message with a contextual "What's Next" card: (1) Direct link to the relevant dashboard tab ("Your depletions are live — check your Distributor Scorecard →"). (2) Data Health update ("Setup progress: 3/4 — upload inventory data to unlock reorder forecasting"). (3) First real import celebration: if this was the user's first non-demo import, show "Welcome to YOUR territory. Here's what your data tells us:" with 2-3 quick stats from the just-imported data (account count, weeks of history, states covered).
- **Why:** The moment after first import is the highest-intent moment in the user journey. Right now it dead-ends at "Done." This turns it into a springboard to value discovery.
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/DataImport.jsx`
- **Depends on:** TODO-051 (Data Health Card), TODO-049 (onboarding state)

### TODO-055: Unify data-type descriptions across EmptyState, WelcomeState, and DataHealthCard
- **What:** Create a shared `DATA_TYPE_INFO` config (in `config/dataTypes.js` or similar) mapping each data type (depletions, inventory, pipeline, accounts, billbacks) to its description, benefits list, recommended action, and icon. Refactor `EmptyState.jsx`, `WelcomeState` (inline in MyTerritory), and `DataHealthCard.jsx` to all read from this single source instead of having their own copies of "what each data type enables."
- **Why:** Three components currently describe the same information with overlapping but not identical copy. A fourth consumer will appear (landing page, onboarding emails). DRY violation accepted during initial Setup Assistant build but should be cleaned up before it spreads further.
- **Pros:** Single source of truth. Adding a new data type updates all three places at once. Prevents copy drift.
- **Cons:** Touches 3 existing files. Risk of subtle regression in existing empty state messaging.
- **Effort:** S (1 hour)
- **Priority:** P3 (cleanup)
- **Files:** New `frontend/src/config/dataTypes.js`, `frontend/src/components/EmptyState.jsx`, `frontend/src/components/DataHealthCard.jsx`, MyTerritory WelcomeState
- **Depends on:** TODO-051 (DataHealthCard exists first)

### Onboarding Delight Items (from CEO App Review 2026-03-16)

- **"Your Data Report Card"** — After first real import, show diagnostic: "Data Quality: A- — 847 accounts, 13 weeks of history, 3 states. Missing: inventory." Makes the system feel like it understood your data, not just ingested it. (S, 30 min)
- **Animated dashboard unlock** — On MyTerritory, show all sections but dim/lock those without data. When user imports depletions, Distributor Scorecard animates to full color. Upload inventory → Reorder Forecast lights up. "Collecting power-ups" game feel without being cheesy. (M, 2 hours)
- **Contextual "Did you know?" tips** — Small dismissable tip cards on MyTerritory, one per session, rotating: "Use ⌘K to jump to any page" / "Export any table as Excel" / "Try the Pricing Studio for margin modeling." Driven by config array, shown based on what user hasn't dismissed. Progressive feature discovery. (S, 1 hour)
- **"Share with your team" prompt** — After first real import populates dashboard, one-time prompt: "Your territory is live! Invite your team." Links to Settings > Users. Catches user at peak enthusiasm. Multi-user tenants are stickier. (S, 30 min)
- **Landing page system-specific social proof** — Show distributor logos and system-specific messaging: "Works with Southern Glazer's, Breakthru, Republic National." Add system-specific 3-step walkthrough selector. Signals "built for MY world" before signup. (M, 2 hours)

---

## P1 — CRM Pipeline Unification (CEO Pipeline Review 2026-03-16)

### TODO-056: Opportunities Entity + CRM Service Layer
- **What:** Add `opportunities` and `products` Firestore collections with full CRUD in `crmService.js` and `CrmContext.jsx`. Opportunity types config with per-type stage workflows (New Placement, BTG Program, Wine Dinner, List Expansion, Reorder/Restock, Staff Training, Seasonal Program, Custom). Cascade delete opportunities on account delete (extend existing pattern in CrmContext.jsx:64-81). Auto-promote account status from `prospect` to `active` when any opportunity reaches "Won" stage. Stage history tracking on every advance (`stageHistory: [{ stage, date, by }]`).
- **Why:** Pipeline and CRM are currently disconnected. `CustomerPipeline.jsx` renders spreadsheet data (`pipelineAccounts` from DataContext) while CRM accounts live in a separate entity world. A rep can't track recurring deals per account or attach wines. "Closed Won" is a dead end — nothing happens. This is the data foundation for the entire unified pipeline.
- **Firestore schema:**
  - `tenants/{tenantId}/opportunities/{oppId}` — type, accountId, accountName, title, stage, wines[], estValue, owner, tier, channel, state, nextStep, dueDate, notes, stageHistory[], createdAt, closedAt, outcome
  - `tenants/{tenantId}/products/{productId}` — name, producer, vintage, sku, type, createdAt
  - `tenants/{tenantId}/config/opportunityTypes` — types[] with key, label, stages[], defaultValue, icon
- **Pros:** Single source of truth for deals. Real entity model (not spreadsheet overlay). Recurring opportunities per account. Foundation for all downstream features.
- **Cons:** Largest CRM change to date. Adds 2 new Firestore collections + subscriptions. Need Firestore security rules update.
- **Effort:** L
- **Priority:** P1
- **Files:** `frontend/src/services/crmService.js`, `frontend/src/context/CrmContext.jsx`, `firestore.rules`, `frontend/src/config/tenant.js`
- **Depends on:** Nothing (but blocks TODO-057 through TODO-062)

### TODO-057: Unified Pipeline View (Kanban + Table)
- **What:** Replace `CustomerPipeline.jsx` with a new pipeline component backed by CRM opportunities. Kanban board on desktop (drag-and-drop between stage columns), responsive card list on mobile. Filter by opportunity type, stage, owner, account. Type-aware stage columns (each opp type shows its own stage workflow). KPIs: total pipeline value, weighted, by type. BEM CSS classes replacing all 657 lines of inline styles.
- **Why:** Current pipeline is a read-only spreadsheet table with no entity backing. `onAddNew` literally `console.log`s (App.jsx:306). Mobile is unusable — 11-column table with forced horizontal scroll. Reps can't interact with deals, can't drag stages, can't create opportunities.
- **Pros:** Interactive pipeline that reps will actually use daily. Mobile-usable. Type-aware stages make it a wine CRM, not generic.
- **Cons:** Full rewrite of CustomerPipeline.jsx. Drag-and-drop needs touch handling for mobile. Stage validation adds complexity.
- **Effort:** L
- **Priority:** P1
- **Files:** New `frontend/src/components/PipelineKanban.jsx`, `frontend/src/components/PipelineCard.jsx`, `frontend/src/styles/Global.css`. Replaces `CustomerPipeline.jsx`.
- **Depends on:** TODO-056 (opportunities entity)

### TODO-058: Product Catalog + Wine Picker
- **What:** New `products` collection UI. Wine picker component for attaching wines to opportunities (multi-select with search/filter). Manual product creation (name, producer, vintage, sku, type). Auto-seed from billback wine extraction when available. Products management tab in Settings for admins. Visual wine picker modal with search, grouped by producer.
- **Why:** Reps can't record which wines they showed a customer. This is THE differentiator — "I showed them the new Cab and the Reserve Pinot" tracked per opportunity. Makes this a wine-industry CRM.
- **Pros:** Wine attachment to opportunities. Catalog grows organically (billbacks + manual). Product visibility across pipeline.
- **Cons:** New collection + subscription adds to initial load. Catalog could get messy without dedup.
- **Effort:** M
- **Priority:** P1
- **Files:** New `frontend/src/components/WinePicker.jsx`, extend `crmService.js` with product CRUD, Settings section
- **Depends on:** TODO-056 (products collection)

### TODO-059: Account Detail — Opportunities Tab + Conversion Flow
- **What:** Add "Opportunities" tab to `AccountDetailPage.jsx` showing all open + closed opportunities for that account with stage badges and type icons. Quick-create opportunity from account detail (pre-filled accountId). Stage advance buttons inline. When any opp hits Won on a prospect account, auto-promote to `active` with celebration toast + auto-logged activity entry: "Closed Won: [opp title]".
- **Why:** Account detail page currently has no pipeline visibility. A rep looking at "Harbor Restaurant" can't see what deals are in flight. The Won→Active conversion is the bridge between pipeline and CRM that doesn't exist today.
- **Pros:** Complete account view — relationship + active deals + history. Conversion flow makes pipeline meaningful.
- **Cons:** AccountDetailPage.jsx already has 6 tabs. Opportunities tab adds UI complexity.
- **Effort:** M
- **Priority:** P1
- **Files:** `frontend/src/components/AccountDetailPage.jsx`
- **Depends on:** TODO-056 (opportunities entity)

### TODO-060: Mobile-First Pipeline Cards + Responsive CRM
- **What:** Mobile card layout for pipeline (swipeable stage indicators, tap to expand opportunity detail). Replace all inline styles in pipeline components with BEM CSS. Responsive account forms (single-column on mobile, already partially handled by `form-grid` in Global.css). Touch-friendly stage advance buttons with adequate tap targets. Pipeline cards show: account name, opp title, type badge, value, wines count, days in stage.
- **Why:** CEO question: "does it work on mobile?" — today the answer is no. Pipeline table has 11 columns forcing `min-width: 600px` horizontal scroll on phones. A field rep standing in a restaurant needs to update a deal in 10 seconds on their phone.
- **Pros:** Field reps can use the pipeline on their phones. Touch-friendly interactions. Professional mobile experience.
- **Cons:** Needs careful responsive design. Swipe interactions need testing across devices. Card layout is a different paradigm from table.
- **Effort:** M
- **Priority:** P1
- **Files:** `frontend/src/styles/Global.css`, pipeline components from TODO-057
- **Depends on:** TODO-057 (unified pipeline view)

### TODO-061: Quick-Add Account + Opportunity From Anywhere
- **What:** Floating "+" action button (FAB) accessible from pipeline, territory, and daily actions pages. Quick-add modal with minimal required fields: account name, type, then optional "create first opportunity" with type picker. Command Palette (Cmd+K) gains "New Account" and "New Opportunity" shortcuts. Pre-fill context when adding from territory (state) or daily actions (account name).
- **Why:** CEO question: "can they easily add new customers?" — today account creation is buried under CRM > Accounts > + New (3 clicks). A rep meeting someone at a trade show should add them in 5 seconds.
- **Pros:** Removes friction from the most common action. Contextual pre-fill reduces data entry. Cmd+K integration for power users.
- **Cons:** FAB is an additional floating UI element. Need to handle mobile placement (not overlap bottom nav if added later).
- **Effort:** S
- **Priority:** P2
- **Files:** New `frontend/src/components/QuickAddFAB.jsx`, `frontend/src/components/CommandPalette.jsx`, `frontend/src/App.jsx`
- **Depends on:** TODO-056 (opportunities entity)

### TODO-062: Pipeline Migration Helper
- **What:** Admin tool in Settings that imports existing `pipelineAccounts` (from spreadsheet data in DataContext) into the new opportunities model. Maps old stages (Identified/Outreach Sent/Meeting Set/RFP/Proposal/Negotiation/Closed Won/Lost) to closest match per opportunity type (defaults to "New Placement" type). Creates CRM accounts for any pipeline accounts that don't already exist (matched by name). Runs once per tenant, optional, with preview before commit.
- **Why:** Existing tenants have pipeline data from spreadsheet imports. Without migration, switching to the new pipeline would lose all that historical context. Preserves continuity for early adopters.
- **Pros:** Smooth upgrade path. No data loss. Preview before commit prevents surprises.
- **Cons:** Stage name mapping is imperfect — needs manual review for edge cases. One-time tool that adds code complexity.
- **Effort:** M
- **Priority:** P2
- **Files:** New admin section in Settings, `frontend/src/services/migrationService.js`
- **Depends on:** TODO-056 (opportunities entity)

### CRM Pipeline Delight Items (from CEO Pipeline Review 2026-03-16)

- **Stage auto-advance suggestions** — When a rep logs a "Wine Tasting" activity on an account that has a BTG opportunity stuck at "Identified", prompt: "Move BTG opportunity to Tasting stage?" One tap to advance. Pipeline updates itself based on daily work. (S, 30 min)
- **"Wines in Play" badge on pipeline cards** — Each pipeline card shows small count badge ("3 wines") for wines attached to that opportunity. Clicking expands the list. Rep glances at pipeline and instantly knows what they're pitching at each account. Visual richness that signals "wine CRM." (S, 20 min)
- **Opportunity type quick stats** — Pipeline page header shows sparkline-style stats per type: "12 BTG programs ($48K) · 8 New Placements ($32K) · 3 Wine Dinners ($4.5K)." Manager-level insight at a glance. (S, 30 min)
- **"Last Visited" freshness indicator** — Green/yellow/red dot on pipeline + territory cards based on most recent activity date (<7d / 7-21d / >21d). Drives daily visit behavior — the #1 habit you want reps building. (S, 20 min)
- **Won deal celebration + weekly wins feed** — Brief celebration animation on "Won" stage + auto-post to "Wins This Week" feed on My Territory. "4 deals closed, $18K new revenue, 12 wines placed." Positive reinforcement that makes reps WANT to update stages. (M, 45 min)

---

## Phase Dependency Graph (Updated 2026-03-16 — CRM Pipeline Review)

```
FOUNDATION (DONE):
    ✅ TODO-020 (shared package)
    ✅ TODO-021 (normalized data model)
    ✅ TODO-022 (rebuildViews — base impl)
    ✅ TODO-023 (account extraction + AI dedup)
    ✅ TODO-024 (4 industry roles)
    ✅ TODO-026 (Firebase Emulator + integration tests)

REMAINING P1 — IMPLEMENTATION ORDER:
    ── Phase A: Infrastructure (no code dependencies) ──
    TODO-036 (staging + CI) ← DO FIRST
    TODO-038 (CLAUDE.md) ← DO FIRST
    TODO-032 (product rename) ← blocked on branding decision

    ── Phase B: Code quality + bug fixes ──
    ✅ TODO-043 (split functions/index.js) DONE
        │
        └── ✅ TODO-044 (shared chunked helper + DATASETS) DONE
                │
                └── ✅ TODO-045 (refactor processTenantSync → normalized model) DONE

    ✅ TODO-046 (NaN guards + validation sweep) DONE
    ✅ TODO-047 (concurrent rebuild lock) DONE

    ── Phase C: Features ──
    ✅ TODO-018 (XLSX export) DONE
    ✅ TODO-028 (Daily Actions card) DONE
    TODO-034 (connector schema) ← schema in TODO-045, email connector P2

    ── Phase D: Onboarding & Activation ──
    TODO-048 (report guide content system) ← DO EARLY, no code deps
        │   Eng review: unified schema with headerSignatures[] for detection
        │
        ├── TODO-049 (Setup Assistant page /setup)
        │       │   Eng review: DistributorSelector + ReportGuide inline (not separate files)
        │       │   Eng review: always write full onboarding{} object, never partial patches
        │       │
        │       ├── TODO-050 (sidebar setup card)
        │       │       Eng review: collapsed mode = icon + badge (matches existing patterns)
        │       ├── TODO-051 (Data Health Card component) ← separate file (reusable)
        │       │       └── TODO-055 (unify data-type descriptions) ← P3 cleanup
        │       └── TODO-052 (setup analytics)
        │               Eng review: NO global distributorRequests/ collection
        │               Log distributor name in tenant-scoped analytics only
        │               Fire-and-forget: catch errors silently, console.warn only
        │
        └── TODO-053 (smart file detection messaging) ← supersedes TODO-031
                Reads headerSignatures from reportGuides.js (unified config)

    ── Phase E: CRM Pipeline Unification ──
    TODO-056 (opportunities entity + service layer) ← DO FIRST in this phase
        │
        ├── TODO-057 (unified pipeline view — Kanban + table)
        │       │
        │       └── TODO-060 (mobile-first pipeline cards)
        │
        ├── TODO-058 (product catalog + wine picker)
        │
        ├── TODO-059 (account detail opportunities tab + conversion)
        │
        ├── TODO-061 (quick-add FAB + Cmd+K shortcuts) ← P2
        │
        └── TODO-062 (pipeline migration helper) ← P2

P2+:
    TODO-054 (post-import "What's Next" card) ← needs TODO-049, TODO-051
    TODO-027 (Account Detail Page) ← needs TODO-007 (DONE)
    TODO-025 (content hash dupe detection)
    TODO-014 (import comparison diff)
    TODO-030 (import timeline)
    TODO-013 (data freshness)
    ~~TODO-015 (onboarding wizard)~~ SUPERSEDED by TODO-049 (Setup Assistant)
    ~~TODO-031 (smart file detection UX)~~ SUPERSEDED by TODO-053
    TODO-039 (morning greeting) ← P2 delight
    TODO-009 (OAuth HMAC signing) ← SECURITY, P1 before production
    TODO-061 (quick-add FAB) ← needs TODO-056
    TODO-062 (pipeline migration helper) ← needs TODO-056

Billback / pricing tree:
    TODO-040 (PDF billback extraction Cloud Fn) ✓ DONE
        │
        ├── TODO-041 (wine entity + AI dedup)
        ├── TODO-042 (billback transforms + spend views)
        │       ├── TODO-043 (billback UI)
        │       ├── TODO-044 (agreement mgmt + reconciliation)
        │       └── TODO-046 (predictive spend budgeting) ← Phase 3
        └── TODO-045 (producer allocation dashboard) ← Phase 3

    TODO-032 (pricing engine package) ✓ DONE
        │
        ├── TODO-033 (Pricing Studio page) ✓ DONE
        │       └── TODO-034 (portfolio in Firestore)
        │               ├── TODO-035 (What-If stress testing)
        │               └── TODO-037 (Account Detail pricing tab) ← also needs TODO-027
        └── TODO-039 (pricing integration tests) ← also needs TODO-034

Independent:
    TODO-007 (React Router) ✓ DONE
    TODO-009 (OAuth HMAC signing) ← SECURITY, P1 before production
    TODO-012 (audit trail)
    TODO-016 (quick actions)
    TODO-017 (weekly digest) ← needs email service
    TODO-018 (XLSX export) ✓ DONE

P3 delight:
    TODO-040 (sparklines)
    TODO-041 (copy as table)
    TODO-042 (keyboard nav)
    TODO-029 (account hover cards)

Compliance:
    TODO-035 (data deletion + privacy) ← P2, before paid customers
    TODO-037 (observability) ← P2
```

---

## Completed

- **TODO-048: Report Guide Content System** — Static config (`config/reportGuides.js`) with unified schema for 5 distributor systems + role-aware recommendations. **Completed:** v0.3.0.0 (2026-03-16)
- **TODO-049: Setup Assistant Page** — Full `/setup` route with 5-step guided onboarding flow, role/distributor selection, report guides, upload launcher, data health tracking. Onboarding state persisted to Firestore. **Completed:** v0.3.0.0 (2026-03-16)
- **TODO-050: Setup Progress Sidebar Card** — Persistent card in sidebar showing setup progress ("2/5 complete"), dismissable, with collapsed-mode badge. **Completed:** v0.3.0.0 (2026-03-16)
- **TODO-051: Data Health Card Component** — Reusable component showing data completeness across 5 types with health score, checklist, and nudge logic. **Completed:** v0.3.0.0 (2026-03-16)
- **TODO-052: Setup Analytics** — Fire-and-forget Firestore event logging (setup_started, guide_viewed, guide_not_found, upload_started, setup_completed) with silent error handling. **Completed:** v0.3.0.0 (2026-03-16)
