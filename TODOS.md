# TODOS — Sidekick BI (MT CRM Platform)

> Updated from CEO Financial Command Center Review on 2026-03-17.
> Previous: CEO CRM Pipeline Review on 2026-03-16.
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
>
> **Portfolio Pricing Book added 2026-03-16 (CEO Pricing Studio Review).**
> Vision: Transform Pricing Studio from disposable calculator into Portfolio Pricing Book — persistent, portfolio-first, distributor-aware.
> Key decisions: PricingContext with useReducer (TODO-061). Portfolio-first /pricing layout (TODO-062). Hybrid Firestore schema — flat `distributorPricing` map now, PricingContext API abstracts for future subcollection swap. Paginate 50/page + debounce 200ms for What-If (no virtual scroll). TODO-035 superseded by TODO-065.
> New TODOs: 061–066. New vision items: Quick Price via Cmd+K, margin health badges, copy-as-table, suggested price tier, pricing history sparkline.
>
> **Product Intelligence Hub added 2026-03-16 (CEO Portfolio Review).**
> Vision: Unified product catalog as the spine of the entire app. Merge three disconnected product concepts (wines/, products/, planned pricing portfolio) into ONE canonical products/ collection. Supplier → Brand/Producer → Wine → Vintage hierarchy. Rich Vinosmith-style wine detail fields. Sell sheet generation (PDF + XLSX). Product sheet import to seed catalog. AI product matching on ALL imports — fixes the QuickBooks-can't-find-wines problem.
> Key decisions: Flat products/ collection with parentId for vintage→wine linking (not subcollections). wines/ migrated into products/ (one-time, idempotent). PricingContext reads from products/ (no separate pricing/portfolio/ collection). Non-vintage wines are parent records, vintage SKUs are children. Feature-gated behind tenantConfig.features.portfolio. normalizeProductName() shared in packages/pipeline/src/. AI product matching is best-effort — import always succeeds, linking is bonus.
> TODO-058 (Product Catalog + Wine Picker) SUPERSEDED by TODO-070+071. TODO-041 updated to write to products/. TODO-034 stores pricing on product docs. TODO-066 partially superseded by TODO-072.
> New TODOs: 070–076. New vision items: Quick Add Wine from Cmd+K, wine count sidebar badge, auto-detect producer, copy wine info, vintage timeline, unmatched products badge, producer grouping toggle.
>
> **Financial Command Center added 2026-03-17 (CEO Review).**
> Vision: Revenue & Sales tab as the daily driver for sales managers. Executive Dashboard as the weekly board-prep view. Multi-source revenue (QuickBooks + Shopify/WooCommerce + manual), 4 hardcoded channels (Distributors, Website/DTC, Direct to Trade Off-Premise, Direct to Trade On-Premise), hybrid budget entry (annual spread → per-channel/month adjustment), AR/AP aging from QuickBooks aging report upload.
> Key decisions: Hardcoded channel list (industry standard). QB AR/AP Aging report upload (not manual entry). Hybrid budget (annual total → fine-tune). Revenue data extends existing DataContext + views pipeline. Executive tab always visible (shows whatever data is available). New datasets: revenueByChannel, revenueByProduct, revenueSummary, arAgingSummary, apAgingSummary, budgetData. Firestore rules for config/budget.
> New TODOs: 080–086. New vision items: budget pace indicator, AR aging color bands, channel trend sparklines, export executive summary PDF, revenue health score.
>
> **Eng Review Refinements (2026-03-17):**
> - HYBRID PRODUCT MATCHING: client-side exact match (instant, during import) + server-side AI fuzzy match (async, after save). Two-phase UX: "Matched 8/12 — 4 being analyzed..."
> - CrmContext OWNS products/ (real-time). DataContext keeps spendByWine (analytics only). Remove loadWines() from DataContext.
> - ProductSheetReviewStep as SEPARATE component file (not inline in DataImport.jsx). DataImport orchestrates, sub-flows are self-contained.
> - Product docs store FOB PRICE ONLY (input). PricingContext calculates sell prices based on market/tier at export time. Sell sheets let user choose pricing view (SRP, FOB, Case tiers, BTG).
> - PDF SELL SHEETS via @react-pdf/renderer in Cloud Function (not jsPDF client-side). Handles accent chars natively, ~1-2s cold start.
> - extractWines integration tests written BEFORE refactoring (safety net for riskiest change). TODO-075 Phase 0 is the FIRST thing built.

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

### TODO-034: Portfolio persistence in Firestore
- **What:** Firestore collection `tenants/{id}/pricing/portfolio/{wineId}` storing PortfolioWine documents: name, producer, region, vintage, tags[], markets (map of marketId → MarketPricingInputs), distributorPricing (flat map of accountId → margin/freight overrides — hybrid schema, swappable to subcollections later via PricingContext API), productId? (soft-link to product catalog), createdAt, updatedAt. CRUD operations with optimistic UI + error toast on failure. Concurrent write detection via updatedAt comparison.
- **Why:** Turns the calculator from a one-shot tool into a living portfolio. Multi-user, multi-device, persistent. Foundation for What-If, account pricing, and price sheet export.
- **Pros:** Real persistence. Team collaboration. Hybrid schema handles 2-20 distributors per wine without performance issues.
- **Cons:** Firestore reads/writes per portfolio operation. Flat distributorPricing map has write contention risk at scale (mitigated by PricingContext API abstraction).
- **Effort:** M (3-4 hours)
- **Priority:** P1
- **Files:** `frontend/src/context/PricingContext.jsx` (created by TODO-061), `frontend/src/services/firestoreService.js`
- **Depends on:** TODO-061, TODO-038

### ~~TODO-035: What-If stress testing on portfolio~~ SUPERSEDED
- **Superseded by:** TODO-065 (Portfolio What-If stress testing with enhanced scope: paginated, debounced, margin health indicators, snapshot persistence).

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

### TODO-061: PricingContext with useReducer
- **What:** New `frontend/src/context/PricingContext.jsx` with single useReducer. Action prefixes: PORTFOLIO_ (persisted), CALC_ (ephemeral), RATES_ (cached). Mounted globally in main.jsx (same pattern as CrmProvider). Portfolio uses on-demand load + optimistic updates (NOT real-time onSnapshot). State shape: portfolio[], portfolioLoading, activeWineId, activeMarketId, inputs, costInputMode, marketInputMemory, scenarioB*, activeRecapLayer, liveRates, ratesFetching. Portfolio CRUD abstracted behind API for future flat→subcollection migration. Replaces 8+ useState hooks in PricingStudio.jsx.
- **Why:** Foundation for all portfolio features. Current state sprawl in PricingStudio.jsx is unmanageable. Every subsequent pricing TODO depends on this.
- **Pros:** Clean state management, testable reducer, enables persistence layer, single source of truth.
- **Cons:** Refactor of working calculator code — risk of regression.
- **Eng review decisions:**
  - Global provider in main.jsx (consistent with CrmProvider pattern)
  - Single useReducer with prefixed actions (explicit > clever, minimal files)
  - On-demand load + optimistic updates (not real-time — portfolio changes infrequently)
  - Reducer unit tests required (~15 cases: all action types + edge cases)
- **Effort:** M (2-3 hours)
- **Priority:** P1
- **Files:** New `frontend/src/context/PricingContext.jsx`, refactor `PricingStudio.jsx` to consume context, add reducer tests to `frontend/src/__tests__/pricingReducer.test.js`, update `main.jsx` provider tree
- **Depends on:** Nothing
- **Blocks:** TODO-034, TODO-062, TODO-063, TODO-065

### TODO-062: Portfolio-first /pricing layout
- **What:** Restructure /pricing to land on PortfolioTable — list of all wines with key metrics (name, producer, market, SRP, margin health). "Price a Wine" button opens calculator as detail view. Clicking a wine row opens it in calculator with saved inputs restored. Paginated (50/page), sortable by any column, filterable by producer/market/tag. Empty state for new users with 0 wines → CTA to price their first wine.
- **Why:** Transforms Pricing Studio from disposable calculator into living portfolio book. Portfolio-first layout signals that Crufolio is a pricing system, not a calculator. This is the UX that makes importers say "I can't go back to Excel."
- **Pros:** The signature differentiator. Portfolio IS the product.
- **Cons:** Significant UI work. Needs well-designed empty state for new users.
- **Effort:** L (4-6 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/PricingStudio/PortfolioTable.jsx`, refactor `PricingStudio.jsx` layout
- **Depends on:** TODO-061, TODO-034

### TODO-063: Distributor-specific pricing overrides
- **What:** On calculator view, add "Distributor Pricing" section. User selects a CRM account (distributor) from dropdown populated via CrmContext. Can override margins, freight, and custom terms for that specific relationship. Stored as `distributorPricing` map in portfolio wine doc. Shows delta vs base pricing. Multiple distributors per wine supported.
- **Why:** This is how real importers work — same wine, different deal for each distributor. SGWS gets 28% margin, RNDC gets 32%. Without this, the portfolio book is incomplete.
- **Pros:** Core value prop for importers with multiple distributor relationships.
- **Cons:** UI complexity — need clear visual separation between base pricing and distributor overrides.
- **Effort:** M (3-4 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/PricingStudio/MarketInputForm.jsx`, `PricingContext.jsx`
- **Depends on:** TODO-061, TODO-034

### TODO-064: Pricing Studio design polish
- **What:** Single design polish pass: (1) CSS class name audit — ensure all JSX classes have matching CSS rules (fix drift like __values vs __right), (2) Replace inline hex colors in AnalysisPanel.jsx (lines 9-13, 176) with CSS custom properties (var(--danger), var(--success)), (3) Extract duplicated `fmt()` from 5 components and `NumInput` from 2 components to shared `PricingStudio/utils.js`, (4) Add empty states for all panels, (5) Responsive improvements for tablet, (6) Fix waterfall row spacing and column alignment.
- **Why:** CSS bug (case/bottle values smashed together) signals there are likely more drift issues. Best-in-class pricing tool needs best-in-class design. Single pass catches everything.
- **Pros:** Immediate visual improvement. Catches all CSS drift at once.
- **Cons:** Purely cosmetic — no new functionality.
- **Effort:** S (2-3 hours)
- **Priority:** P1
- **Files:** `frontend/src/styles/Global.css`, all PricingStudio/*.jsx components
- **Depends on:** Nothing — can ship independently

### TODO-065: Portfolio What-If stress testing
- **What:** New WhatIfPanel component. Global override sliders: FX shift (%), tariff override (%), freight delta ($/case). Applies overrides to portfolio wines **in the active market only** (not all markets), recalculates in real-time (debounced 200ms). Shows delta SRP, delta wholesale, and margin health indicators (green >25%, yellow 15-25%, red <15%). Wines that go negative-margin flash red with callout. Save snapshots to `tenants/{id}/pricing/snapshots/{id}` for historical comparison. Paginated at 50 wines per page. User switches market to see impact on other markets.
- **Why:** THE power feature. "Tariffs just went to 25% — show me the damage across my entire book." Pure client-side recalculation, no server needed. This is what makes importers show Crufolio to their peers.
- **Pros:** Unmatched competitive differentiator. No wine pricing tool does this. Engine logic already exists and is tested. Active-market-only keeps recalc under 100ms for 500 wines.
- **Cons:** Snapshot storage adds Firestore docs. Cross-market impact requires switching markets (acceptable tradeoff for performance).
- **Effort:** L (4-5 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/PricingStudio/WhatIfPanel.jsx`, PricingContext updates
- **Depends on:** TODO-061, TODO-034, TODO-062
- **Supersedes:** TODO-035

### TODO-066: Price Sheet Export (PDF/XLSX)
- **What:** Export branded price sheet from portfolio. User selects wines + market + distributor, gets a formatted document: wine name, producer, region, vintage, case pack, bottle price, case price, distributor margin. Two formats: XLSX (for distributor buying teams, using existing exportXlsx.js pattern) and PDF (for presentations, using jsPDF client-side). Branded with tenant company name.
- **Why:** This is how importers communicate pricing to distributors today — via Excel price sheets. Crufolio generating these automatically from the portfolio replaces the most tedious part of their workflow.
- **Pros:** Direct workflow replacement. Tangible "I saved 2 hours" moment.
- **Cons:** PDF formatting is finicky. Need to handle variable wine counts gracefully.
- **Effort:** M (3-4 hours)
- **Priority:** P2
- **Files:** New `frontend/src/components/PricingStudio/PriceSheetExport.jsx`, `frontend/src/utils/exportXlsx.js`
- **Depends on:** TODO-062

### Vision Items (Delight Opportunities — <30 min each)

- **"Price This SKU" from Account Detail** — Button on account page opens Pricing Studio pre-filled with account's market context. Depends on TODO-033, TODO-037.
- **Margin traffic lights on portfolio** — Green/yellow/red dots on portfolio table based on margin thresholds (>25%, 15-25%, <15%). Depends on TODO-034.
- **"Share Price Sheet" export** — Branded XLSX price list per market from portfolio, formatted for distributor consumption. Depends on TODO-034, TODO-018.
- **FX alert badge** — Sidebar notification when exchange rates move >2% since last session. Depends on TODO-036.
- **Product catalog auto-link** — On portfolio save, offer "Add to Product Catalog" when no matching product exists. Depends on TODO-034.
- **"Quick Price" via Command Palette** — Cmd+K → type wine name → jumps to calculator pre-filled with saved inputs. If not in portfolio, opens blank calculator with name pre-filled. ~20 min. Depends on TODO-061, TODO-034.
- **Margin health badges on sidebar** — Small red/yellow/green dot next to "Pricing Studio" in sidebar. Green = all wines >25% margin. Yellow = some 15-25%. Red = any <15% or negative. ~15 min. Depends on TODO-061, TODO-034.
- **"Copy as table" on waterfall/recap** — Clipboard icon on Pricing Snapshot and P&L cards. Copies data as formatted text table for email/Slack/Docs. ~15 min.
- **Suggested price tier callout** — After calculating, show "Your SRP $22.03 falls between $19.99 and $24.99 tiers. Retailers will likely shelf at $24.99." Data already computed by calculatePriceTiers(). ~10 min.
- **Wine pricing history sparkline** — Tiny sparkline on portfolio table showing SRP change over time. Driven by What-If snapshot history. ~30 min. Depends on TODO-065.

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

### ~~TODO-056: Opportunities Entity + CRM Service Layer~~ DONE
> Fixed by /qa on robbied112/taipei, 2026-03-17. Commit `f3b2f3d`.
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

### ~~TODO-057: Unified Pipeline View (Kanban + Table)~~ DONE
> Fixed by /qa on robbied112/taipei, 2026-03-17. Commit `f3b2f3d`. Note: Mobile shows all merged stages when unfiltered (ISSUE-002 deferred).
- **What:** Replace `CustomerPipeline.jsx` with a new pipeline component backed by CRM opportunities. Kanban board on desktop (drag-and-drop between stage columns), responsive card list on mobile. Filter by opportunity type, stage, owner, account. Type-aware stage columns (each opp type shows its own stage workflow). KPIs: total pipeline value, weighted, by type. BEM CSS classes replacing all 657 lines of inline styles.
- **Why:** Current pipeline is a read-only spreadsheet table with no entity backing. `onAddNew` literally `console.log`s (App.jsx:306). Mobile is unusable — 11-column table with forced horizontal scroll. Reps can't interact with deals, can't drag stages, can't create opportunities.
- **Pros:** Interactive pipeline that reps will actually use daily. Mobile-usable. Type-aware stages make it a wine CRM, not generic.
- **Cons:** Full rewrite of CustomerPipeline.jsx. Drag-and-drop needs touch handling for mobile. Stage validation adds complexity.
- **Effort:** L
- **Priority:** P1
- **Files:** New `frontend/src/components/PipelineKanban.jsx`, `frontend/src/components/PipelineCard.jsx`, `frontend/src/styles/Global.css`. Replaces `CustomerPipeline.jsx`.
- **Depends on:** TODO-056 (opportunities entity)

### ~~TODO-058: Product Catalog + Wine Picker~~ SUPERSEDED by TODO-070 + TODO-071
- **Superseded by:** TODO-070 (Unified Product Catalog Schema + Migration) and TODO-071 (Portfolio Page + Product Detail). The unified product catalog replaces the basic product catalog planned here with a full hierarchy, rich fields, sell sheet generation, and AI matching. Wine picker for opportunities continues to work unchanged against the enriched products/ collection.

### ~~TODO-059: Account Detail — Opportunities Tab + Conversion Flow~~ DONE
> Fixed by /qa on robbied112/taipei, 2026-03-17. Commit `f3b2f3d`. Auto-promote, auto-log activity (Won/Lost/Completed), inline stage advance all verified.
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

## P1 — Product Intelligence Hub (CEO Portfolio Review 2026-03-16)

> Added from CEO Portfolio Review on 2026-03-16. SCOPE EXPANSION mode.
> Core insight: The app has three disconnected "product" concepts — wines/ (billback extraction), products/ (manual CRM catalog), and planned pricing/portfolio/ — that don't talk to each other. Users can't see "everything about my 2022 Cabernet" in one place. When QuickBooks data is imported, the AI can't link descriptions to wines because there's no canonical catalog. This is the #1 blocker to being a real wine industry platform.
> Vision: Unified Product Intelligence Hub — one canonical products/ collection with supplier → brand → wine → vintage hierarchy, rich Vinosmith-style detail fields, sell sheet generation, product sheet import, and AI product matching on all imports.
> Architecture: Flat products/ collection with parentId for vintage→wine linking. wines/ migrated (one-time, idempotent). PricingContext reads pricing from product docs (no separate collection). normalizeProductName() shared in packages/pipeline/src/. Feature-gated behind tenantConfig.features.portfolio.

### TODO-070: Unified Product Catalog Schema + Migration
- **What:** Extend products/ collection with rich wine fields: varietal, appellation, region, country, alcoholPct, caseSize, bottleSize, supplier, tags, status, sourceNames[], parentId (vintage→wine link), normalizedName, displayName, labelImageUrl, tastingNotes, description, pricing (denormalized map), wineEntityId (legacy link during migration). Vintage hierarchy: non-vintage wines (type="nv", parentId=null) are parents; vintage SKUs (type="vintage", parentId=wineId) are children. Shared `normalizeProductName()` in `packages/pipeline/src/productNormalize.js` (strip accents, bottle sizes, abbreviations, keep vintage years). One-time `migrateWinesToProducts` callable Cloud Function: copy wines/ docs into products/ with schema mapping, idempotent (skip already-migrated via wineEntityId), dedup on normalizedName (merge sourceNames). Refactor `extractWines` in `functions/billback.js` to write to products/ instead of wines/. Update `entityDedup.js` for product-specific normalization.
- **Why:** Three disconnected product concepts are the #1 architectural blocker. Can't build sell sheets, AI matching, portfolio analytics, or cross-source intelligence until there's one canonical wine catalog. The hierarchy (supplier → producer → wine → vintage) is how the industry thinks about its book.
- **Pros:** Single source of truth. Every feature that touches wines gets simpler. Enables sell sheets, AI matching, portfolio analytics. PricingContext writes pricing on product docs directly — eliminates the third disconnected concept.
- **Cons:** Migration of wines/ requires careful dedup. Refactoring extractWines carries regression risk (mitigated by existing billback integration tests). Schema is large (~20 fields) but most are optional.
- **Context:** Firestore schema:
  ```
  tenants/{tenantId}/products/{productId}
    name, normalizedName, displayName, type ("vintage"|"nv"), parentId
    supplier, producer, vintage, varietal, appellation, region, country
    alcoholPct, caseSize, bottleSize, upc, sku
    tastingNotes, description, labelImageUrl, tags[], status
    sourceNames[], importIds[], wineEntityId (migration link)
    pricing: { us: { srp, wholesale }, ... }
    distributors[], createdAt, updatedAt, createdBy
  ```
- **Error handling:** Migration: skip malformed docs + log warning, idempotent rerun, dedup merge on collision. extractWines refactor: existing retry + fallback patterns preserved.
- **Effort:** L (6-8 hours)
- **Priority:** P1 — BLOCKS all portfolio work
- **Testing:** `normalizeProductName.test.js` (~15 cases: accents, bottle sizes, abbreviations, vintage extraction, empty, null, unicode). Integration: migration idempotency, dedup merge, tenant isolation. Regression: existing billback extraction tests pass against products/.
- **Files:** `packages/pipeline/src/productNormalize.js`, `functions/billback.js` (refactor extractWines), `functions/entityDedup.js` (product normalization), new `functions/migration.js` (migrateWinesToProducts), `frontend/src/services/crmService.js` (extend product fields), `frontend/src/context/CrmContext.jsx`
- **Depends on:** TODO-047 (shared deduplicateEntities helper — DONE)
- **Blocks:** TODO-071, TODO-072, TODO-073, TODO-074, TODO-075

### TODO-071: Portfolio Page + Product Detail (/portfolio route)
- **What:** New `/portfolio` top-level route replacing `/wines`. Three views: (1) Portfolio list — browse wines with search/filter/sort, grouped by supplier → producer → wine. Paginated 50/page. Toggle between flat list and grouped-by-producer view. (2) Product detail page (`/portfolio/:productId`) — all wine fields, vintage timeline (horizontal cards for 2018/2019/2020...), pricing summary, spend data (from billback views), distributor badges, "Edit" button, "Add Vintage" button. (3) Product create/edit form — all Vinosmith-style fields (name, producer, supplier, vintage, varietal, appellation, region, country, alcohol%, case size, bottle size, SKU, UPC, tasting notes, tags). Empty state: "Add your first wine" CTA. BEM CSS in Global.css (no inline styles). Sidebar nav item: "Portfolio" with wine count badge. Replace old WineList.jsx and WineDetail.jsx.
- **Why:** Current WineList.jsx is a bare table with inline styles and billback-only data. No way to manually manage wines, no hierarchy view, no rich details. The Portfolio page is the heart of the product — where users manage their wine book. SevenFifty and Vinosmith set the bar.
- **Pros:** Central hub for all wine data. Rich detail views that importers expect. Hierarchy matches how the industry thinks. Replaces two weak components with one strong one.
- **Cons:** Large UI build (~6-8 hours). Needs well-designed empty state for new users with 0 wines.
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/Portfolio/PortfolioList.jsx`, `Portfolio/ProductDetail.jsx`, `Portfolio/ProductForm.jsx`, `frontend/src/config/routes.js`, `frontend/src/styles/Global.css`, `frontend/src/components/Sidebar.jsx`
- **Depends on:** TODO-070 (unified schema)

### TODO-072: Sell Sheet Generator (PDF + XLSX)
- **What:** Export branded sell sheets from portfolio. User selects wines (checkbox on portfolio list or "Export All") + market/tier context. Two formats: (1) PDF — professional wine sell sheet layout via **Cloud Function using `@react-pdf/renderer`** (eng review decision: server-side, not jsPDF client-side — handles accent characters natively, no font embedding issues, ~1-2s cold start). (2) XLSX — spreadsheet for distributor buying teams using existing `exportXlsx.js` pattern. Pricing is context-dependent: user selects which view to show (SRP, FOB, Case 1/3/5 wholesale, BTG) — follows industry standard (SevenFifty/Vinosmith filter model). Product docs store `fobPrice` (input only); PricingContext calculates sell prices based on selected market/tier at export time. "Export Sell Sheet" button on Portfolio page and Product Detail page.
- **Why:** This is how importers communicate pricing to distributors today — via PDF sell sheets and Excel price lists. SevenFifty and Vinosmith both have this. Automating sell sheet generation replaces the most tedious part of the importer workflow. "I saved 2 hours" moment.
- **Pros:** Direct workflow replacement. Tangible ROI. Competitive parity with SevenFifty/Vinosmith. @react-pdf/renderer is lightweight and handles Unicode natively.
- **Cons:** Adds a new Cloud Function for PDF generation (~1-2s cold start). Need to handle: long wine names (truncate), missing prices ("--"), variable wine counts.
- **Eng review decisions:** (1) Server-side PDF via @react-pdf/renderer in Cloud Function (not jsPDF client-side — accent chars + layout reliability). (2) Product docs store fobPrice only (input), not calculated prices. PricingContext calculates based on market/tier at export time. (3) Pricing view selector: SRP, FOB, Case tiers, BTG — matches industry UX patterns.
- **Error handling:** PDF Cloud Function error → fall back to XLSX + toast. Missing prices → show "--". 200+ wine cap with warning. Empty selection → button disabled.
- **Effort:** M (4-5 hours — increased from 3-4 due to Cloud Function + pricing filter UI)
- **Priority:** P1
- **Files:** New `frontend/src/components/Portfolio/SellSheetExport.jsx`, new `functions/sellSheet.js` (@react-pdf/renderer), extend `frontend/src/utils/exportXlsx.js`, `functions/index.js` (re-export)
- **Depends on:** TODO-071 (portfolio page provides selection UI)

### TODO-073: Product Sheet Import
- **What:** New import type `product_sheet` detected by semanticMapper + AI mapper. When user uploads a CSV/XLSX that looks like a wine catalog (columns matching: name, producer, vintage, varietal, region, sku, price, case size — detected via header signatures), route to a Product Sheet Review Step: editable table of extracted products before saving to products/. Dedup against existing catalog using normalizeProductName(). Handles near-duplicates: "This looks like 'Château Margaux 2018' already in your catalog — merge or create new?" Bulk import: 500 wines in 60 seconds.
- **Why:** Users have existing wine lists in Excel. Manual entry of 200 wines is a non-starter. Product sheet import seeds the catalog in one upload. Once the catalog exists, AI product matching on transaction imports (TODO-074) becomes useful — this is how you solve the QuickBooks problem. Upload product sheet first → upload QuickBooks → wines auto-link.
- **Pros:** Fast catalog seeding. Dedup prevents duplicates. Review step prevents bad data. Leverages existing DataImport flow.
- **Cons:** DataImport.jsx gets another conditional branch (product_sheet alongside csv/xlsx/pdf). Need clear UX to distinguish "this is a product list" from "this is transaction data."
- **Context:** Detection heuristic: if headers contain 3+ of [name, producer, varietal, vintage, appellation, region, sku, upc, case size, bottle size] AND <2 of [qty, amount, revenue, date, invoice], classify as product_sheet. Requires adding new FIELD_DEFS to semanticMapper: varietal, appellation, region, caseSize, bottleSize.
- **Eng review decisions:** (1) ProductSheetReviewStep is a SEPARATE component file (not inline in DataImport — DataImport is already 802 lines). DataImport detects product_sheet type and routes to the sub-component. Follows the BillbackReviewStep pattern.
- **Effort:** M (3-4 hours)
- **Priority:** P1
- **Testing:** `productSheetDetection.test.js` — header combinations that should/shouldn't trigger product_sheet type. `productImport.test.js` — dedup, merge, create new, empty sheet, duplicate rows.
- **Files:** `packages/pipeline/src/semanticMapper.js` (add product_sheet detection + new FIELD_DEFS), new `frontend/src/components/ProductSheetReviewStep.jsx`, `frontend/src/components/DataImport.jsx` (route to sub-component), `functions/ai.js` (AI mapper product_sheet type)
- **Depends on:** TODO-070 (products collection schema)

### TODO-074: AI Product Matching on All Imports
- **What:** Hybrid matching on all imports (eng review decision: two-phase for instant feedback + AI intelligence). **Phase 1 — Client-side exact match (instant, runs during import):** After semanticMapper maps the sku/product column, `clientExactMatch(rows, products)` runs in the browser. Products already loaded in CrmContext. Normalizes names and compares against normalizedName, sku, and sourceNames[]. Attaches productId to matched rows immediately. UI shows "Matched 8/12 wines — 4 being analyzed..." **Phase 2 — Server-side AI fuzzy match (async, runs after save):** `matchProductsFromImport()` Cloud Function receives unmatched names and import metadata. Uses entityDedup pattern with product-specific prompt. Confidence routing: >0.85 auto-link, 0.5-0.85 pending review, <0.5 add to unmatchedProducts[]. Updates import doc with matched productIds. Surface in UI after import: "3 products not in your catalog — add them?" with one-click add. Client-side function is a pure utility in `packages/pipeline/src/productMatch.js` (shared, testable).
- **Why:** This directly fixes the user's core complaint: "when I uploaded the QuickBooks data, it didn't find that the description had the wine." With a product catalog + AI matching, every import auto-links to wines. QuickBooks "Memo/Description" containing "Chateau Margaux 750ml" now matches to the catalog entry. Hybrid approach gives instant results for exact matches (common case) while still catching abbreviations and variations via AI.
- **Pros:** Instant feedback for exact matches. Cross-source linking (depletion + QuickBooks + billback → same wine). Unmatched surface drives catalog growth. Client-side matching adds zero latency to import. Server-side runs async.
- **Cons:** AI cost (~$0.01/import for fuzzy matching). Two-phase UX is slightly more complex. False matches possible (mitigated: confidence thresholds + pending review queue).
- **Eng review decisions:** (1) Hybrid: client exact match (instant) + server AI fuzzy (async). (2) clientExactMatch is a pure function in packages/pipeline/src/ (testable, shared). (3) Phase 2 runs AFTER save — import always succeeds, matching is best-effort.
- **Error handling:** Claude timeout → skip fuzzy matching, keep exact matches only, log warning. Malformed JSON → retry 1x, then skip. NaN confidence → parseFloat guard → 0 → "create new" (safe default). Empty catalog → skip matching entirely. No sku column mapped → skip matching (OK).
- **Effort:** L (5-6 hours)
- **Priority:** P1
- **Testing:** Unit: `clientExactMatch.test.js` — 10 cases (exact name, normalized, sku, sourceNames, no match, empty catalog, accents, case insensitive). Integration: server fuzzy match (mock AI), timeout fallback, NaN guard, batch dedup.
- **Files:** New `packages/pipeline/src/productMatch.js` (clientExactMatch), new `functions/productMatch.js` (server matchProductsFromImport callable), `frontend/src/components/DataImport.jsx` (two-phase matching UI + unmatched products prompt), `functions/ai.js` (product matching prompt)
- **Depends on:** TODO-070 (products schema), TODO-073 (catalog needs wines to match against)

### TODO-075: Portfolio Integration Tests
- **What:** Vitest integration tests using Firebase Emulator. **Eng review: write extractWines baseline tests BEFORE refactoring (TODO-070) — safety net for the riskiest change.** Full test plan: (1) **Phase 0 (pre-refactor):** extractWines baseline — 4 tests: new wine creation, existing wine merge, pending match routing, error fallback. These establish behavior BEFORE changing the write target from wines/ to products/. (2) Product CRUD with rich fields — create, read, update, delete. (3) Tenant isolation — tenant A can't read tenant B's products. (4) wines/ → products/ migration — migrate 5 wines, verify schema mapping, idempotent rerun (no duplicates), normalizedName dedup merge. (5) Product matching — exact match by normalizedName, exact match by sourceNames[], fuzzy match (mock AI with confidence routing), timeout fallback (skip matching), NaN confidence guard. (6) Vintage hierarchy — query children by parentId, orphan vintage handling. (7) Sell sheet data formatting — currency, missing fields, long name truncation. ~25-30 test cases.
- **Why:** Products are now the canonical entity — every feature depends on them. extractWines currently has ZERO test coverage — the refactor to write to products/ is the highest-risk change in this feature. Integration tests ensure the schema, security rules, migration, and matching all work correctly together.
- **Eng review decisions:** (1) Write extractWines tests BEFORE refactoring — establish baseline, verify after refactor. (2) Phase 0 tests are the first thing built (before any TODO-070 code changes).
- **Pros:** Real Firestore behavior. Safety net for riskiest refactor. Catches security rule gaps. Emulator already set up (TODO-026).
- **Cons:** ~5-10s per test. Worth it for data integrity.
- **Effort:** M (3-4 hours — increased from 2-3 to include Phase 0 baseline tests)
- **Priority:** P1 — **START HERE** (before TODO-070 code changes)
- **Files:** New `functions/__tests__/portfolio.integration.test.js`, new `packages/pipeline/src/__tests__/productNormalize.test.js`
- **Depends on:** Nothing (Phase 0 tests current behavior)
- **Depends on:** TODO-070 (schema + migration to test)

### TODO-076: Supersede/Update Existing Product TODOs
- **What:** Update TODOS.md for consistency with unified product catalog: (1) Mark TODO-058 (Product Catalog + Wine Picker) as SUPERSEDED by TODO-070+071. (2) Update TODO-041 (Wine/Product Entity with AI Dedup) to note that extractWines now writes to products/ not wines/. (3) Update TODO-034 (Portfolio persistence in Firestore) to store pricing inputs on product docs instead of separate pricing/portfolio/ collection — PricingContext reads from products/. (4) Update TODO-062 (Portfolio-first /pricing layout) to read from products/. (5) Update TODO-066 (Price Sheet Export) as partially superseded by TODO-072 (sell sheets). (6) Update dependency graph.
- **Why:** Keeping TODOS.md accurate prevents confusion and ensures the dependency graph reflects reality.
- **Effort:** S (30 min)
- **Priority:** P1
- **Files:** `TODOS.md`
- **Depends on:** TODO-070 approved (it is)

### TODO-077: Batch Product Import with Progress Indicator
- **What:** Replace sequential `createProduct()` × N with Firestore batch writes (max 500 docs per batch). Add progress bar to ProductSheetReviewStep showing "Importing 42/200 products…". Tag each product doc with `importBatchId` for future undo/rollback capability. Atomic per-batch — all-or-nothing prevents partial imports on network failure.
- **Why:** A 300-wine Excel fires 300 parallel writes with no feedback. Users think the app is frozen. Batch writes are atomic, prevent partial state on network drops, and enable future "undo last import" functionality.
- **Pros:** Better UX, prevents partial imports, enables undo. Foundation for large-catalog onboarding.
- **Cons:** Slightly more complex write logic. 500-doc batch limit means 600-wine file needs 2 batches (still atomic per batch, not across batches).
- **Effort:** M
- **Priority:** P2
- **Files:** `frontend/src/components/DataImport.jsx` (confirmProductSheetImport), `frontend/src/components/ProductSheetReviewStep.jsx` (progress UI), `frontend/src/services/crmService.js` (batch write helper)
- **Depends on:** Nothing

### TODO-078: Pending Product Matches Resolution UI
- **What:** New UI section on Portfolio page showing AI-suggested product matches with 50–85% confidence. Each pending match shows: new product name, suggested existing match, confidence score, and approve/reject/create-new actions. Badge on Portfolio sidebar nav: "Portfolio (3 to review)". Resolving a match updates the product's `sourceNames[]` (approve) or creates a new product (create-new). Mark pendingMatch doc as `status: "resolved"` on action.
- **Why:** The `pendingMatches/` collection accumulates data users can never see. Medium-confidence AI matches are black holes — the system wrote them but provided no way to act. This is the bridge between "AI tried to match" and "user confirms."
- **Pros:** Makes AI matching visible and actionable. Turns imports into catalog-building moments. Builds user trust in AI matching by giving them the final say.
- **Cons:** New UI surface to maintain. Requires loading pendingMatches in CrmContext (new subscription).
- **Effort:** M
- **Priority:** P2
- **Files:** New `frontend/src/components/Portfolio/PendingMatches.jsx`, update `frontend/src/components/Portfolio/PortfolioList.jsx`, update `frontend/src/context/CrmContext.jsx` (subscribe to pendingMatches)
- **Depends on:** TODO-074 (AI product matching on all imports)

### Portfolio Vision Items (Delight Opportunities — <30 min each)

- **"Quick Add Wine" from Cmd+K** — Type wine name in command palette → fast-add form. Seeds catalog while working. (~20 min, depends on TODO-071)
- **Wine count badge on sidebar** — "Portfolio (42)" next to nav item. Real-time update. (~10 min, depends on TODO-071)
- **Auto-detect producer from wine name** — Type "Chateau Margaux 2018" → auto-suggest "Chateau Margaux" as producer. Regex + existing producer list matching. (~20 min, depends on TODO-070)
- **"Copy Wine Info" on detail page** — One-click copy formatted wine info for email/text. Reps share wine details with buyers constantly. (~15 min, depends on TODO-071)
- **Vintage year timeline** — Horizontal timeline on wine detail showing 2018, 2019, 2020... vintage cards. Click to see that year's data. Like a discography view for wine. (~30 min, depends on TODO-071)
- **"Unmatched Products" notification badge** — After import with unmatched names, badge on Portfolio nav: "Portfolio (3 new)". Click opens quick-add for unmatched. Turns imports into catalog-building moments. (~15 min, depends on TODO-074)
- **Producer grouping toggle** — Toggle between flat list and grouped-by-producer cards. Grouped shows producer name with wine count + SKU count. Matches how importers think about their book. (~20 min, depends on TODO-071)

---

## P1 — Financial Command Center (CEO Review 2026-03-17)

> Added from CEO Financial Command Center Review on 2026-03-17. SCOPE EXPANSION mode.
> Core insight: The app is a BI platform with NO financial views. No revenue breakdown, no budget tracking, no AR/AP, no executive rollup. This is like selling a car without a dashboard. The app currently tracks depletions, inventory, CRM, pipeline, and pricing — but the #1 thing every sales manager and founder needs is "are we hitting our numbers?"
> Vision: Financial Command Center — Revenue & Sales as the daily driver for sales managers (channel × SKU × month with budget variance), Executive Dashboard as the weekly board-prep view (cross-dataset rollup with AR/AP aging). Multi-source revenue ingestion (QB for distributor, Shopify for DTC, manual for direct-to-trade). Hardcoded 4-channel model matching wine/spirits industry standard.
> Architecture: New transforms in packages/pipeline/src/ (transformRevenue, transformArAp). New precomputed views in Firestore (revenueByChannel, revenueByProduct, revenueSummary, arAgingSummary, apAgingSummary). Budget config at tenants/{id}/config/budget. Extends existing DataContext, semanticMapper, rebuildViews. Two new routes (/executive, /revenue). Feature: revenue datasets conditionally loaded behind availability flags.

### TODO-080: Revenue Transform Pipeline
- **What:** New `transformRevenue()` in `packages/pipeline/src/transformRevenue.js`. Aggregates raw revenue import rows into 3 precomputed views: `revenueByChannel` (channel × month grid with actuals — 4 channels: Distributors, Website/DTC, Direct to Trade Off-Premise, Direct to Trade On-Premise), `revenueByProduct` (SKU × month with totals), `revenueSummary` (YTD total, annual run rate, top channel, top SKU, monthly totals). Extend `rebuildViews` to call `transformRevenue` when revenue imports exist. Add revenue column detection to `semanticMapper` (amount/revenue/sales, date, customer/account, product/SKU/item, channel/type). Support QuickBooks Sales by Customer Detail format + Shopify export format. Channel assignment logic: map customer/source to channel enum based on import source type (QB → Distributors, Shopify → Website/DTC) + optional channel column in the data.
- **Why:** The data backbone. Without transforms, no dashboard. Follows the exact pattern of `transformDepletion` — proven architecture.
- **Pros:** Pure function, testable, follows existing patterns. Enables Revenue & Sales tab.
- **Cons:** Another transform to maintain. Needs to handle multiple source formats (QB, Shopify).
- **Context:** Channel enum: `{ distributors: "Distributors", dtc: "Website / DTC", offPremise: "Direct to Trade - Off Premise", onPremise: "Direct to Trade - On Premise", other: "Other" }`. Hardcoded — covers 95% of wine/spirits sales models.
- **Error handling:** NaN amounts → skip row + warn. Invalid dates → skip row + warn. Empty input → return empty views. Missing channel → default to "Other". Division by zero in avg calculations → guard with `|| 0`.
- **Effort:** M (3-4 hours)
- **Priority:** P1 — BLOCKS Revenue & Sales tab
- **Testing:** Mandatory `transformRevenue.test.js` (~20 cases): happy path multi-channel/multi-SKU/multi-month, empty input, NaN amounts (skip+warn), missing dates (skip+warn), single channel, single month, negative amounts (refunds), channel assignment logic, YTD totals accuracy, annual run rate, all-zeros.
- **Files:** New `packages/pipeline/src/transformRevenue.js`, `packages/pipeline/src/semanticMapper.js` (add revenue + Shopify column patterns), `functions/rebuild.js` (extend), `packages/pipeline/src/constants.js` (add new dataset names)
- **Depends on:** Nothing (packages/pipeline infrastructure exists)
- **Blocks:** TODO-081, TODO-083

### TODO-081: Revenue & Sales Tab
- **What:** New `/revenue` route with `RevenueSales.jsx`. KPI cards: YTD Revenue, YTD Budget, YTD vs Budget %, Variance, Annual Budget, % of Annual. Revenue by Channel table with monthly actual vs budget columns per channel (4 rows × 12+ columns). Revenue Mix by Channel pie chart (Recharts). Monthly Revenue by SKU line chart. Revenue by SKU horizontal bar chart. Monthly Distributor Orders vs Forecast section (from `qbDistOrders`). Channel filter bar. XLSX export button. Budget editor accessible from tab (gear icon or "Set Budget" CTA, see TODO-083). When no revenue data: DataGate empty state. When revenue but no budget: show actuals, hide variance columns. When budget but no revenue: show budget only, actuals $0.
- **Why:** THE missing tab. Every sales manager needs to see revenue vs budget by channel and SKU. Without it, the app isn't a BI platform — it's a depletion tracker. The screenshots show exactly this layout.
- **Pros:** Table-stakes for any sales BI tool. Uses existing Recharts + DataGate + XLSX export patterns.
- **Cons:** Large component (~400 lines). Monthly table can be wide — needs horizontal scroll or responsive design.
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/RevenueSales.jsx`, `frontend/src/config/routes.js` (add route), `frontend/src/components/Sidebar.jsx` (add nav), `frontend/src/App.jsx` (add Route), `frontend/src/styles/Global.css` (BEM styles), `frontend/src/components/CommandPalette.jsx` (register)
- **Depends on:** TODO-080 (revenue transform provides data), TODO-083 (budget config for variance)

### TODO-082: Executive Dashboard Tab
- **What:** New `/executive` route with `ExecutiveDashboard.jsx`. Cross-dataset rollup — always visible (shows whatever data is available, gracefully hides sections with no data). Sections: (1) KPI cards: 13W Depletions, Distributor Inventory, Net Placements (30d), YTD Revenue. (2) Classic Inventory Sellout Tracker — progress bar showing sold vs remaining with deadline and pace calculation (behind pace / on pace / ahead). (3) Weekly Depletion Trend chart (13W line). (4) Top Distributors by 13W CE horizontal bar. (5) AR Aging Summary — table with aging buckets (Current, 1-30, 31-60, 61-90, 90+) and total outstanding, with color-coded bands. (6) AP Aging Summary — same format. (7) Inventory snapshot — Total OH, Avg DOH, top reorder items. Reads from: `distScorecard`, `inventoryData`, `placementSummary`, `revenueSummary`, `arAgingSummary`, `apAgingSummary`. Each section shows independently based on data availability. XLSX export for full executive summary.
- **Why:** The Monday morning view for founders and VPs. Pulls from every data source into one screen. Today users must click through 6+ tabs to get this picture. Executive tab collapses the "how is my business doing?" question into one page.
- **Pros:** High-fan-in rollup that adds massive perceived value. Uses existing datasets — minimal new data infrastructure.
- **Cons:** Reads 6+ datasets — more context to manage. Layout must handle partial data gracefully (some sections present, others not).
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/ExecutiveDashboard.jsx`, `frontend/src/config/routes.js`, `frontend/src/components/Sidebar.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/Global.css`, `frontend/src/components/CommandPalette.jsx`
- **Depends on:** TODO-080 (revenue data), TODO-084 (AR/AP data), existing depletions + inventory datasets

### TODO-083: Budget Configuration & Editor
- **What:** New budget config stored at `tenants/{id}/config/budget`. Schema: `{ annualTotal, year, channels: { distributors: [12 monthly values], dtc: [...], offPremise: [...], onPremise: [...] } }`. UI: Budget editor accessible from Revenue & Sales tab (gear icon or "Set Budget" CTA when no budget exists). Hybrid entry: type annual total → auto-spreads evenly across 4 channels and 12 months → user can adjust individual channel/month cells in an editable grid. Save to Firestore with debounce (500ms). Persists across sessions. Validate: amounts ≥ 0, NaN rejected. Add Firestore security rules for `config/budget` (same `isTenantMember()` pattern, ~2 lines). DataContext loads budget from `config/budget` doc.
- **Why:** Without budgets, there's no variance tracking. Variance is what makes revenue data actionable ("are we on track?"). The hybrid approach gives instant value (type $2.85M, see monthly tracking) while allowing fine-tuning.
- **Pros:** Instant value from one number. Fine-tuning for power users. Follows existing Firestore patterns.
- **Cons:** Editable grid UI is moderately complex. Need to handle: partially filled grid, year rollover.
- **Effort:** M (2-3 hours)
- **Priority:** P1 — BLOCKS variance display on Revenue & Sales tab
- **Files:** `firestore.rules` (add budget rules), `frontend/src/context/DataContext.jsx` (load budget), new budget editor component (inline in RevenueSales or separate), `frontend/src/services/firestoreService.js` (budget CRUD)
- **Depends on:** Nothing
- **Blocks:** TODO-081 (variance columns)

### TODO-084: AR/AP Aging Import & Transform
- **What:** New `transformArAp()` in `packages/pipeline/src/transformArAp.js`. Parses QuickBooks A/R Aging Summary and A/P Aging Summary exports. Produces `arAgingSummary` and `apAgingSummary` views with: total outstanding, aging buckets (Current, 1-30, 31-60, 61-90, 90+), top 10 accounts/vendors by amount, overdue total (31+ days), overdue percentage. Add AR/AP column detection to `semanticMapper` — detect aging report format by column signatures (customer/vendor, current, 1-30/31-60/61-90/over 90, total). Extend `rebuildViews` to call `transformArAp` when AR/AP imports exist. Handle: AR but no AP (show AR only), very old aging data (show freshness warning).
- **Why:** AR/AP is what makes the Executive tab valuable for founders/CFOs. "Who owes us money and how old is it?" is the #1 financial health question. QuickBooks exports this as a standard report.
- **Pros:** Small transform (aging is already pre-bucketed by QB). High value for executive visibility.
- **Cons:** QB aging format varies slightly across QB versions (desktop vs online). Need to detect both.
- **Effort:** M (2-3 hours)
- **Priority:** P1 — BLOCKS Executive Dashboard AR/AP sections
- **Testing:** Mandatory `transformArAp.test.js` (~12 cases): happy path, empty, missing buckets, negative values (overpayments), single account, all-current (no overdue), large values, QB Desktop vs QB Online format differences.
- **Files:** New `packages/pipeline/src/transformArAp.js`, `packages/pipeline/src/semanticMapper.js` (add AR/AP detection), `functions/rebuild.js` (extend), `packages/pipeline/src/constants.js` (add dataset names)
- **Depends on:** Nothing
- **Blocks:** TODO-082 (Executive Dashboard)

### TODO-085: Revenue & Financial Test Suite
- **What:** New `transformRevenue.test.js` (~20 cases) and `transformArAp.test.js` (~12 cases) in `frontend/src/__tests__/`. Revenue tests: happy path with multi-channel/multi-SKU/multi-month data, empty input, NaN amounts (skip+warn), missing dates (skip+warn), single channel, single month, negative amounts (refunds), channel assignment logic, YTD totals accuracy, annual run rate calculation, all-zeros edge case. AR/AP tests: happy path, empty, missing buckets, negative values (overpayments), single account, all-current, boundary values. Extend existing `semanticMapper` tests for revenue column detection (QB Sales by Customer Detail, Shopify export) and AR/AP aging column detection. Budget round-trip test: save → load → verify.
- **Why:** These transforms compute every number on two new tabs. If they're wrong, the product looks broken. The 2am-Friday confidence test.
- **Effort:** S (2 hours)
- **Priority:** P1 — ship with transforms
- **Files:** New `frontend/src/__tests__/transformRevenue.test.js`, new `frontend/src/__tests__/transformArAp.test.js`, extend `frontend/src/__tests__/semanticMapper.test.js` (if exists) or add cases to `parseFile.test.js`
- **Depends on:** TODO-080, TODO-084

### TODO-086: Shared KpiCard Component
- **What:** Extract the KPI card pattern (title, big number, subtitle/trend, optional color accent) that's duplicated inline across 7+ tabs into a shared `KpiCard.jsx` component. Props: `title`, `value`, `subtitle`, `trend` (up/down/flat), `color`, `prefix` ($), `suffix` (%). Replaces inline KPI markup in Depletions, Inventory, Opportunities, Reorder, MyTerritory, and the new Revenue & Executive tabs. BEM CSS class: `kpi-card`, `kpi-card__value`, `kpi-card__title`, `kpi-card__trend--up/down/flat`.
- **Why:** Every tab has 3-5 KPI cards with the same markup pattern repeated. Adding 2 more tabs means 8-10 more inline copies. DRY violation that compounds with every new tab.
- **Pros:** Consistent styling across all tabs. One place to update card design. Reduces per-tab boilerplate.
- **Cons:** Touches 7+ existing components to swap inline markup. Low risk but wide blast radius.
- **Effort:** S (1 hour)
- **Priority:** P2
- **Files:** New `frontend/src/components/KpiCard.jsx`, refactor all existing tab components
- **Depends on:** Nothing

### Financial Command Center Vision Items (Delight Opportunities — <30 min each)

- **Budget pace indicator** — "At current run rate, you'll hit budget by [month]" or "On pace to finish at $X (Y% of budget)." Green/yellow/red. Math: YTD actual / months elapsed × 12 vs annual budget. (~15 min, depends on TODO-081 + TODO-083)
- **AR aging color bands** — Color-code aging buckets on Executive tab: green (Current), yellow (31-60), orange (61-90), red (90+). CSS-only, 4 background-color rules. (~15 min, depends on TODO-082)
- **Channel trend sparklines** — Tiny Recharts sparkline in each Revenue by Channel table row showing 3-month trend. Instant pattern recognition without reading numbers. (~20 min, depends on TODO-081)
- **Export Executive Summary PDF** — One-click "Export Summary" button on Executive tab. Branded PDF with all visible KPIs, sellout tracker, AR aging. Uses @react-pdf/renderer (planned for sell sheets). For board meetings / investor updates. (~30 min, depends on TODO-082 + TODO-072 pattern)
- **Revenue Health Score** — Single 0-100 number combining: budget pace (40%), channel diversification (20%), revenue trend (20%), AR health (20%). Circular SVG gauge with green/yellow/red zones. Like a credit score for your sales operation. (~30 min, depends on TODO-081 + TODO-082)

### TODO-087: Pending Matches Review UI
- **What:** Build a review panel/page showing AI-suggested product matches from `pendingMatches/` with accept/reject actions.
- **Why:** `matchProductsFromImport` writes medium-confidence matches to `pendingMatches/` with `status: "pending"`, but there's no UI to review, accept, or reject them. The AI matching pipeline is fire-and-forget with no human-in-the-loop resolution.
- **Pros:** Completes the matching loop. High perceived intelligence ("the system noticed these might be duplicates"). Improves catalog accuracy over time as sourceNames accumulate.
- **Cons:** New UI component + Firestore queries. Medium effort.
- **Context:** `pendingMatches/` collection already stores `newName`, `suggestedMatch`, `confidence`, `entityType`, `status`. Accept action = merge sourceNames from pending match into the matched product + delete pending doc. Reject action = delete pending doc. Could live as a panel on the Portfolio page or as a notification badge in the sidebar. The collection is shared with account matching (filter by `entityType: "product"`).
- **Effort:** M (3-4 hours)
- **Priority:** P2
- **Files:** New `frontend/src/components/Portfolio/PendingMatchesPanel.jsx`, update `PortfolioList.jsx` or sidebar badge
- **Depends on:** TODO-074 (product matching — already implemented)

### TODO-088: Firestore Subscription Architecture Review
- **What:** Audit all real-time Firestore subscriptions for efficiency — evaluate lazy loading per route vs subscribe-all-on-mount.
- **Why:** CrmContext subscribes to 6+ collections simultaneously on login (accounts, contacts, activities, tasks, opportunities, products). Each is an unbounded real-time listener. As more features ship (Revenue, Executive Dashboard), this fan-out grows — unnecessary reads + memory for features the user may not visit.
- **Pros:** Reduces Firestore costs, improves initial load time, scales with feature growth. Prevents cost surprises at scale.
- **Cons:** Adds complexity to context providers. Lazy subscriptions need loading states per page. May require splitting CrmContext.
- **Context:** All subscriptions are in `CrmContext.jsx` (6 listeners) and `DataContext.jsx` (bulk load). Current pattern: subscribe-all-on-mount in CrmContext's useEffect. Alternative approaches: subscribe-on-route-enter with unsubscribe-on-leave (via route-level hooks), or stale-while-revalidate with periodic refresh. Should be done after feature set stabilizes (post Revenue & Sales + Executive Dashboard).
- **Effort:** M (4-6 hours for audit + refactor)
- **Priority:** P3
- **Files:** `frontend/src/context/CrmContext.jsx`, `frontend/src/context/DataContext.jsx`, potentially new per-feature context providers
- **Depends on:** TODO-081 (Revenue tab), TODO-082 (Executive Dashboard) — wait until feature set is stable

### TODO-089: Portfolio Feature Gate
- **What:** Add `tenantConfig.features.portfolio` gate — hide sidebar link + route if disabled for a tenant.
- **Why:** CEO Portfolio Review specified "Feature-gated: tenantConfig.features.portfolio" but the current implementation always shows Portfolio. For multi-tenant rollout, you may want to control which tenants see the feature.
- **Pros:** Standard feature flag pattern. Enables controlled rollout per tenant. ~15 min implementation.
- **Cons:** Extra config surface. May not be needed if all tenants benefit from Portfolio. DataGate + EmptyState already handle the no-data case gracefully.
- **Context:** No other features are currently gated, so this would be the first feature flag. Implementation: check `tenantConfig.features?.portfolio` in `Sidebar.jsx` to hide/show link, and in route definition or `App.jsx` to redirect. The tenantConfig is already loaded in DataContext and available app-wide.
- **Effort:** S (30 min)
- **Priority:** P3
- **Files:** `frontend/src/components/Sidebar.jsx`, `frontend/src/App.jsx` or route guard
- **Depends on:** Nothing

---

## Phase Dependency Graph (Updated 2026-03-17 — CEO Financial Command Center Review)

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
        ├── ~~TODO-058 (product catalog + wine picker)~~ SUPERSEDED by TODO-070+071
        │
        ├── TODO-059 (account detail opportunities tab + conversion)
        │
        ├── TODO-061 (quick-add FAB + Cmd+K shortcuts) ← P2
        │
        └── TODO-062 (pipeline migration helper) ← P2

    ── Phase F: Product Intelligence Hub ──
    TODO-070 (unified product catalog schema + migration) ← DO FIRST in this phase
        │
        ├── TODO-071 (Portfolio page + product detail /portfolio route)
        │       │
        │       └── TODO-072 (sell sheet generator — PDF + XLSX)
        │
        ├── TODO-073 (product sheet import)
        │
        ├── TODO-074 (AI product matching on all imports) ← also needs TODO-073
        │       │
        │       └── TODO-078 (pending matches resolution UI)
        │
        ├── TODO-075 (portfolio integration tests)
        │
        └── TODO-077 (batch product import + progress) ← no deps, can do anytime

    TODO-076 (supersede/update existing TODOs) ← housekeeping, do with TODO-070

    ── Phase G: Financial Command Center ──
    TODO-080 (revenue transform pipeline) ← DO FIRST in this phase
        │
        └── TODO-081 (Revenue & Sales tab)
                │
                └── TODO-083 (budget config + editor) ← also needed by TODO-081

    TODO-084 (AR/AP aging import + transform) ← independent, parallel with TODO-080
        │
        └── TODO-082 (Executive Dashboard tab) ← also needs TODO-080

    TODO-085 (revenue + financial test suite) ← ship with TODO-080 + TODO-084
    TODO-086 (shared KpiCard component) ← P2, independent

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
        │       │
        │       ├── TODO-064 (design polish) ← independent, ship anytime
        │       │
        │       └── TODO-061 (PricingContext + useReducer)
        │               │
        │               ├── TODO-034 (portfolio persistence in Firestore) ← also needs TODO-038
        │               │       │
        │               │       ├── TODO-062 (portfolio-first /pricing layout)
        │               │       │       │
        │               │       │       ├── TODO-065 (What-If stress testing) ← supersedes TODO-035
        │               │       │       └── TODO-066 (price sheet export PDF/XLSX)
        │               │       │
        │               │       ├── TODO-063 (distributor-specific pricing overrides)
        │               │       └── TODO-037 (Account Detail pricing tab) ← also needs TODO-027
        │               │
        │               └── TODO-039 (pricing integration tests) ← also needs TODO-034, TODO-038
        │
        └── TODO-038 (Firestore security rules for pricing) ← BLOCKS persistence

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
- **TODO-080: Revenue Transform Pipeline** — `transformRevenue()` with channel aggregation, SKU breakdown, and revenue summary views. Semantic mapper extended for revenue/AR/AP column detection. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-081: Revenue & Sales Tab** — `/revenue` route with KPI cards, revenue by channel table (actual vs budget), channel mix doughnut, monthly trend line, SKU bar chart, and inline budget editor. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-082: Executive Dashboard Tab** — `/executive` route with cross-dataset rollup: KPI cards, sellout tracker, weekly depletion trend, top distributors, AR/AP aging tables, inventory snapshot. Gracefully hides sections with no data. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-083: Budget Configuration & Editor** — Budget stored at `config/budget`, hybrid entry (annual total → auto-spread → fine-tune per channel/month), integrated into Revenue & Sales tab. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-084: AR/AP Aging Import & Transform** — `transformArAp()` parsing QuickBooks aging reports into bucketed summaries with top entities. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-085: Revenue & Financial Test Suite** — `transformRevenue.test.js` and `transformArAp.test.js` with comprehensive edge case coverage. **Completed:** v0.3.1.0 (2026-03-17)
- **TODO-086: Shared KpiCard Component** — Extracted `KpiCard.jsx` with label, value, subtext props, used across Revenue & Sales and Executive Dashboard tabs. **Completed:** v0.3.1.0 (2026-03-17)
