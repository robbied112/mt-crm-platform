# TODOS — Sidekick BI (MT CRM Platform)

> Updated from CEO Disruption Review + Eng Review on 2026-03-16.
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

### TODO-031: Smart file type detection messaging ← PROMOTED TO P2 (CEO review)
- **What:** When a file is dropped, show a friendly detection message: "Looks like a VIP Depletion Report from Southern Glazer's — I see 2,400 rows across 3 states." or "This looks like a QuickBooks Sales by Customer report with 150 accounts."
- **Why:** Builds trust in the AI. When the system correctly identifies your file type, you trust it to map columns correctly. This is the "wow" moment in onboarding.
- **Effort:** S (30 min — AI mapper already detects type, just need better UX copy)
- **Priority:** P2 ← promoted from P3 in CEO review (delight opportunity)
- **Files:** `frontend/src/components/DataImport.jsx`
- **Depends on:** Nothing

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

## Phase Dependency Graph (Updated 2026-03-16)

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

P2+:
    TODO-027 (Account Detail Page) ← needs TODO-007 (DONE)
    TODO-025 (content hash dupe detection)
    TODO-014 (import comparison diff)
    TODO-030 (import timeline)
    TODO-013 (data freshness)
    TODO-015 (onboarding wizard) ← needs TODO-024 (DONE)
    TODO-031 (smart file detection UX) ← PROMOTED P2
    TODO-039 (morning greeting) ← P2 delight
    TODO-009 (OAuth HMAC signing) ← SECURITY, P1 before production
    TODO-012 (audit trail)
    TODO-016 (quick actions)
    TODO-017 (weekly digest) ← needs email service

P3 delight:
    TODO-040 (sparklines)
    TODO-041 (copy as table)
    TODO-042 (keyboard nav)
    TODO-029 (account hover cards)

Compliance:
    TODO-035 (data deletion + privacy) ← P2, before paid customers
    TODO-037 (observability) ← P2
```
