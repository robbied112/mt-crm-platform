# TODOS — Sidekick BI (MT CRM Platform)

> Updated from Cathedral Vision Review + Eng Review on 2026-03-15.
> CEO review: SCOPE EXPANSION mode. Eng review: BIG CHANGE mode (full Phase 1).
> Key eng review correction: full rebuild only (not incremental) — momentum/consistency need ALL rows.
> Phase 1 = Foundation, Phase 2 = CRM, Phase 3 = Intelligence, Phase 4 = Delight + Scale.

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

### TODO-032: Extract pricing engine as shared TypeScript package
- **What:** Create `packages/pricing-engine/` by extracting port-louis's `src/engine/` directory. TypeScript package with barrel exports. Copy existing tests (4 test files). Add Vite resolve alias (same pattern as xlsx alias). Includes: core types/enums/math, 8 US model calculators, generic market calculator, 8 market configs, reverse calculator, comparison engine, recap builder, presets, FX fetch logic.
- **Why:** Foundation for every pricing feature. DRY — single source of truth for pricing logic shared between frontend and (future) Cloud Functions. Engine is already built and tested in port-louis.
- **Pros:** ~30 files of battle-tested code. Strong TypeScript types document the domain. Zero new logic to write.
- **Cons:** Adds mixed TS/JS to the monorepo (Vite handles natively). ~30 files added.
- **Effort:** M (2-3 hours)
- **Priority:** P1 — BLOCKS all pricing work
- **Files:** New `packages/pricing-engine/`, `vite.config.js`
- **Depends on:** Nothing

### TODO-033: Pricing Studio page in Sidekick BI
- **What:** New React Router route `/pricing` with full pricing calculator UI: market selector, input form (dynamic per market config), waterfall visualization, recap panel, comparison panel, analysis panel (reverse pricing, FX sensitivity, value chain decomposition, price tier analysis), multi-market overview. Port UI components from port-louis, adapting to MT-CRM's CSS patterns (BEM + CSS custom properties). State managed via useReducer in parent component. Sidebar navigation link in new "Tools" section.
- **Why:** The core user-facing feature — the pricing calculator embedded in the CRM.
- **Pros:** Most UI components already exist in port-louis. Adaptation, not creation.
- **Cons:** Largest single piece of work. Port-louis uses Tailwind + Zustand; MT-CRM uses custom CSS + useReducer. UI adaptation needed.
- **Effort:** L (6-8 hours)
- **Priority:** P1
- **Files:** New `frontend/src/components/PricingStudio/`, `frontend/src/config/routes.js`, `frontend/src/components/Sidebar.jsx`, `frontend/src/components/index.js`, `frontend/src/App.jsx`
- **Depends on:** TODO-032
- **Implementation note:** Margin inputs MUST be clamped to max 99.9%. `applyMarginOnSelling(cost, 100)` computes `cost / 0` = Infinity, which propagates silently through the waterfall. Port-louis's NumberInput has max props that prevent this — ensure the adapted MarketInputForm preserves this guard.

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

## Phase Dependency Graph

```
TODO-020 (shared package)
    │
    ├── TODO-021 (normalized data model)
    │       │
    │       ├── TODO-022 (rebuildViews Cloud Function)
    │       │       │
    │       │       └── TODO-026 (Firebase Emulator + integration tests)
    │       │
    │       ├── TODO-023 (account extraction + AI dedup)
    │       │       │
    │       │       ├── TODO-027 (Account Detail Page) ← also needs TODO-007
    │       │       ├── TODO-028 (Daily Actions card)
    │       │       └── TODO-029 (Account hover cards)
    │       │
    │       ├── TODO-025 (content hash dupe detection)
    │       ├── TODO-014 (import comparison diff)
    │       ├── TODO-030 (import timeline)
    │       └── TODO-013 (data freshness)
    │
    └── TODO-024 (4 industry roles)
            │
            └── TODO-015 (onboarding wizard)

TODO-032 (pricing engine package) ◄── PRICING TREE
    │
    ├── TODO-033 (Pricing Studio page)
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
