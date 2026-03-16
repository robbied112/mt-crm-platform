# TODOS — Sidekick BI (MT CRM Platform)

> Generated from CEO Plan Review on 2026-03-15. SCOPE EXPANSION mode.

---

## P1 — Must Fix Before Production

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

### TODO-006: Extract shared pipeline package
- **What:** Create `packages/pipeline/` containing `parseFile`, `transformData`, `semanticMapper` logic. Use from both `frontend/` and `functions/`. Remove `functions/lib/pipeline.js` (490-line duplicate).
- **Why:** `functions/lib/pipeline.js` is a near-exact copy of frontend utils. They will diverge. Any bug fix in one place will be missed in the other.
- **Effort:** M (3-4 hours)
- **Priority:** P1
- **Files:** New `packages/pipeline/`, `functions/lib/pipeline.js` (delete), `frontend/src/utils/parseFile.js`, `frontend/src/utils/transformData.js`
- **Depends on:** TODO-005 (tests should exist before refactoring)

---

## P2 — Important, Ship Soon

### TODO-007: Add React Router
- **What:** Add `react-router-dom`. Convert tab state to URL routes (`/territory`, `/accounts`, `/settings`, etc.). Support deep linking, browser back/forward, bookmarkable views.
- **Why:** Currently using `useState` for tabs — no deep links, no browser back button, no bookmarkable views, no shareable URLs. For a BI product, this is table stakes.
- **Effort:** M (2-3 hours)
- **Priority:** P2
- **Files:** `frontend/src/App.jsx`, new route config
- **Depends on:** Nothing

### TODO-008: Snapshot-before-overwrite for data imports
- **What:** Before each import, save the current dataset state as a versioned snapshot (`tenants/{id}/snapshots/{timestamp}`). Add an 'undo last import' button in Settings.
- **Why:** Currently importing new data completely overwrites existing data with no versioning, no undo, no history. A mis-mapped file destroys all accumulated data.
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `frontend/src/services/firestoreService.js`, `frontend/src/components/DataImport.jsx`
- **Depends on:** Nothing

### TODO-009: HMAC-sign OAuth state parameter
- **What:** In `cloudSyncOAuthCallback`, generate the state parameter by HMAC-signing the tenantId + nonce with a server secret. Verify the signature on callback. Prevents tenant hijacking via state manipulation.
- **Why:** Currently the OAuth state is unsigned base64 JSON. An attacker could substitute a different tenantId to connect their Google Drive to someone else's tenant.
- **Effort:** S (30 min)
- **Priority:** P2
- **Files:** `functions/index.js` (cloudSyncOAuthCallback + the frontend code that initiates the OAuth flow)
- **Depends on:** Nothing

### ~~TODO-010: File size validation~~ DONE
- Added 10MB file size check and 0-byte check in `DataImport.handleFile` before parsing.

### ~~TODO-011: Load user role from profile~~ DONE
- AuthContext loads role from user profile. `App.jsx` uses `isAdmin` from context (no longer hardcoded). Settings tab gated to admin-only.

### TODO-012: Upload + mapping audit trail
- **What:** Log every upload with: file name, detected type, AI mapping vs user's final mapping, row count, success/failure, user email. Store in `tenants/{id}/uploadAudit/`. Enables AI mapping accuracy tracking.
- **Why:** No way to know if AI mapping is working well, what file types customers use most, or debug import failures after the fact.
- **Effort:** S (1-2 hours)
- **Priority:** P2
- **Files:** `frontend/src/components/DataImport.jsx`, `frontend/src/services/firestoreService.js`
- **Depends on:** Nothing

---

## P3 — Vision / Delight Opportunities

### TODO-013: Data freshness indicator
- **What:** Show "Data last updated: 3 days ago" in dashboard header. If data is >14 days old, show nudge: "Upload a fresh report?"
- **Why:** Wineries forget to re-upload. Subtle nudge drives re-engagement and data accuracy.
- **Effort:** S (30 min)
- **Priority:** P3
- **Files:** `frontend/src/components/Header.jsx`
- **Depends on:** Nothing

### TODO-014: Import comparison summary
- **What:** After importing new data, show diff summary: "vs. last upload: +12 new accounts, +15% volume, 3 accounts went inactive."
- **Why:** Turns mundane data upload into an insightful moment. Users understand what changed.
- **Effort:** M (1-2 hours)
- **Priority:** P3
- **Files:** `frontend/src/components/DataImport.jsx`
- **Depends on:** TODO-008 (snapshots)

### TODO-015: Guided onboarding wizard
- **What:** Replace bare "Welcome" screen with 3-step wizard: (1) Set business role, (2) Upload first file, (3) See dashboard. Progress indicator.
- **Why:** First-time user experience is currently confusing. Guided flow drives activation.
- **Effort:** M (2 hours)
- **Priority:** P3
- **Files:** New component, `frontend/src/App.jsx`
- **Depends on:** Nothing

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
- **Depends on:** TODO-003 (tenantId), email service setup

### TODO-018: XLSX export for all tabs
- **What:** Wire up all "Export" buttons (currently console.log stubs) to generate and download XLSX files using the `xlsx` library (already a dependency).
- **Why:** Every "Export" button currently does nothing. Users expect to export their data.
- **Effort:** M (2-3 hours)
- **Priority:** P3
- **Files:** All dashboard components with export buttons
- **Depends on:** Nothing

### TODO-019: Plan normalized data model for Phase 2
- **What:** Design and document a normalized Firestore schema that stores raw imported rows (with source metadata) instead of pre-aggregated arrays. Compute views on read or via Cloud Functions.
- **Why:** Current pre-aggregated model prevents time-series analysis, re-analysis with different parameters, and custom reports. This is the ceiling on the product.
- **Effort:** M (design only, no implementation)
- **Priority:** P3
- **Files:** New architecture doc
- **Depends on:** Nothing
