# Changelog

All notable changes to this project will be documented in this file.


## [0.6.2.0] - 2026-04-01

### Added
- Approximate data badges on charts and KPIs when the aggregation engine uses a fallback data source, so users know when numbers are estimates
- Analysis complete summary card with smooth fade-out after re-upload finishes
- Compact progress bar with step labels during re-upload analysis
- Test coverage for aggregation engine fallback paths, fuzzy field resolution, and grid sub-sections (+7 tests)

### Changed
- Narrative section and Actions Rail redesigned with tighter visual hierarchy and clearer structure
- Conversational Recovery component refined with improved card layout and better visual balance

### Fixed
- Single-object filter field names now resolved through case-insensitive matching (same as array filters)
- Non-array filter field collection for fuzzy resolution in aggregation engine
- Removed always-true guard in SuggestedQuestions that prevented default questions from rendering
- Animation/timeout race on complete summary card (JS timeout now outlasts CSS fade)

## [0.6.1.0] - 2026-04-01

### Added
- Ask Analyst Q&A — click a suggested question or type your own to chat with the AI Wine Analyst about your data, with multi-turn conversation history
- Custom question input on suggested questions section — always visible, even when no AI-generated questions exist

### Changed
- Data profile caching — analyzeUpload now saves a slimmed data profile alongside the blueprint so follow-up questions load instantly instead of re-reading all imports
- SuggestedQuestions always renders (no longer returns null for empty/null questions)

### Fixed
- Restored column mapping logic in analyzeUpload that was accidentally removed, fixing fallback template dashboards
- History validation on askAnalyst: type checks, length caps (2000 chars), max 6 turns

## [0.6.0.0] - 2026-03-31

### Added
- Import comparison diff ("What Changed") — after re-uploading data, a dismissible card highlights new/lost accounts, volume changes, overdue reorder shifts, inventory alerts, and revenue movement
- Weekly digest email — scheduled Cloud Function (Sundays 6 AM Pacific) generates an AI-written summary of your week's data via Claude Sonnet and delivers it through Resend to all team members
- Conversational error recovery — when the AI mapper is less than 70% confident on a column, a chat-style UI asks you to confirm uncertain mappings with sample data previews and dropdown corrections; learned mappings are saved for future auto-detection
- Account-level dashboard metrics — volume trend, last order date, reorder status, and health score cards on every CRM account detail page, with fuzzy name matching against view data
- Manager intelligence dashboard — team KPIs, per-rep performance table with territory filtering, territory comparison bars, AI-generated callouts (inactive reps, overdue clusters, territory gaps), and recent team activity feed

### Fixed
- HTML entity escaping on AI-generated digest email content to prevent trust boundary violations

## [0.5.1.1] - 2026-03-31

### Fixed
- Race condition in ActionsRail: "Task created" checkmarks now use stable keys instead of array indices, surviving blueprint updates
- Double-submit guard on CreateTaskModal using synchronous ref check before async call
- Crossfade ref staleness in AnalysisViewer: prevBlueprintRef now updates inside the fade branch
- Analysis step indicators reset on error instead of showing stale progress
- Metric pill regex tightened: bare numbers like "3 accounts" no longer pillified, only sign-prefixed (+5 accounts) or comma-formatted (1,200 cases) numbers match unit words
- Invalid timestamp handling in formatRelativeTime returns null instead of "Invalid Date"
- Drag-and-drop file type validation on UploadStrip filters to .csv/.xlsx/.xls/.tsv
- UploadStrip onChange handler now respects disabled prop
- Added aria-disabled attribute to UploadStrip for screen reader support
- Body scroll lock when CreateTaskModal is open prevents background scrolling
- CRM accounts query in analyzeUpload capped at 200 to prevent token budget blowout

## [0.5.1.0] - 2026-03-30

### Added
- Narrative formatting with visual weight — AI-generated text now renders **bold** account/SKU names and metric pills (+47% green, -12% red, 38 DOH neutral) instead of flat text
- Actions rail with CRM task creation — numbered priority actions from AI analysis with "Create Task" modal (pre-filled title, account, due date) and "View Account" deep link when account ID matches
- Suggested questions as interactive buttons (wired to chat panel in PR 3)
- Compact upload strip replacing full-width hero zone — "Add more reports" when data exists, "Drop your first reports here" when empty
- Step-based analysis progress indicator replacing generic spinner — shows file count, detected type, pattern-finding, and chart-building steps with checkmarks
- Re-upload banner with crossfade transition when adding new data to existing analysis
- Warm empty state naming supported distributors (iDig, VIP, SGWS, Breakthru, RNDC)
- Responsive breakpoints: desktop narrative+sidebar, tablet stacked, mobile single-column
- 56 new tests across 8 test files (NarrativeSection, ActionsRail, CreateTaskModal, SuggestedQuestions, UploadStrip, AnalysisSkeleton, BlueprintContext, AnalysisViewer)

### Changed
- AnalysisViewer refactored from 357 lines of inline components to composition of 6 extracted sub-components with BEM CSS classes
- AI prompt now instructs Claude to use **bold markdown** for entity names and include specific percentage changes in narrative
- Actions schema includes optional `accountId` field — analyzeUpload loads CRM accounts and passes names+IDs to Claude for action matching

### Fixed
- BlueprintContext activeTab not resetting when re-uploading with different data — new blueprint with different tab IDs would try to render a stale tab reference

## [0.5.0.1] - 2026-03-30

### Fixed
- AI analyst uploads saved with type "unknown" instead of detecting file type, causing all chart data to route to wrong source bucket and show "No data available"

## [0.5.0.0] - 2026-03-30

### Added
- AI Wine Analyst homepage — upload distributor reports and get AI-generated dashboards with narrative analysis, suggested questions, and recommended actions
- `analyzeUpload` Cloud Function — single Claude Sonnet call generates both dashboard blueprint (tabs, charts, KPIs, tables) and narrative briefing from raw uploaded data
- Wine industry system prompt (~3K tokens) — three-tier system, depletion metrics, distributor formats, seasonal patterns, pricing terminology, account types
- `AnalysisViewer` component — upload zone + narrative section + existing BlueprintRenderer dashboard, no new context providers needed
- `aiAnalyst` feature flag — when enabled, homepage shows AI analysis instead of static briefing, sidebar hides static analytics routes
- Template-based fallback — if Claude API fails, generates dashboard from matched industry templates with generic narrative
- Rate limiting — 10 analyses per hour per tenant
- 27 new tests across 5 test files (analyzeUpload unit + integration, AnalysisViewer, useVisibleRoutes, importDatasets)

### Changed
- `DataContext.importDatasets()` accepts `rawRows` parameter for storing unparsed column names (enables AI analysis of original data)
- `DataContext` exposes `analyzeAndRefresh()` for batch upload completion in AI analyst mode
- Import metadata now stores `originalHeaders` for richer AI context in future chat features

### Fixed
- Firestore rules: `reportBlueprints` subcollection path corrected from `tabs/` to `computedData/` matching actual code paths

## [0.4.5.1] - 2026-03-30

### Fixed
- Inventory view showing all zeros for On Hand, Daily Rate, 90D Depletion, and Projected Orders — data was grouped by state instead of distributor, missing the fields the table expects
- Inventory table now shows computed daily depletion rate, 90-day projections, reorder signals, and per-SKU breakdown for each distributor

## [0.4.5.0] - 2026-03-29

### Added
- Import configuration memory — caches AI analysis results by file structure hash, skipping Claude API calls on repeat uploads of similar reports
- Learned mappings LRU eviction — caps `learnedMappings` collection at 200 entries, evicts least-recently-used on overflow
- Lower auto-confirm thresholds for learned/cached mappings (0.5 vs 0.7) with tolerance for up to 2 low-confidence fields
- Import config cache lookup in multi-file queue — checks Firestore cache before calling comprehendReport, uses cached mapping with 0.95 confidence
- Firestore rules for `learnedMappings` and `importConfigs` collections
- Test exports for comprehend.js internals (`validateExtractionSpec`, `sanitizeForPrompt`, `buildMarkdownTable`)
- 29 new comprehend unit tests, 19 AI mapping helper tests, 18 new firestoreService/useFileQueue tests

### Fixed
- Import config cache gated behind `smartImportEnabled` flag to respect feature toggle
- Removed pre-confirmation cache write in single-file flow — configs now cached only after user confirms import

## [0.4.4.0] - 2026-03-28

### Fixed
- Fix multiple depletion files overwriting each other — "sales" type imports now merged with "depletion" before transformation
- Fix month columns being positional instead of temporal — files covering different time periods now aligned chronologically via `buildUnifiedAxis`
- Fix hardcoded "Nov/Dec/Jan/Feb" month labels — replaced with positional `m0/m1/m2/m3` fields plus `monthAxis` metadata for actual month names
- Fix summary type selection picking arbitrary first type — now uses deterministic priority order

### Added
- Per-view ownership map (`VIEW_OWNERS`) prevents lower-priority import types from overwriting higher-priority dashboard views
- New `alignMonths.js` module: `parseMonthLabel` parses date headers ("Nov 2025", "Case Equivs [1M Dec 2025]", etc.), `buildUnifiedAxis` aligns rows across imports with per-import fallback for unparseable labels
- `_monthLabels` stored alongside `_months` during normalization for downstream temporal alignment
- `monthAxis` exposed from views `_summary` doc through `DataContext` to frontend components
- Dynamic month columns in AccountInsights and DistributorHealth — adapts to actual data period instead of hardcoded 4 months
- 15 new tests: alignMonths (7), normalize (1), transformData (2), firestoreService (3), plus 2 updated

## [0.4.3.0] - 2026-03-19

### Fixed
- Fix depletion mapping for VIP/iDig distributor reports — "SUPPLIER NAME" now correctly maps to distributor instead of account
- Add VIP/iDig-specific aliases for SKU ("prod cd", "corp item cd") and quantity ("case equivs", "depl cases") fields
- Prevent auto-confirm when critical fields are missing (qty for depletions/sales, acct+qty for purchases, oh for inventory)
- Block auto-confirm for unknown upload types
- Fix unmapped columns warning including internal month/week column arrays

### Added
- SKU Mix chart now uses real depletion data (aggregated by product SKU) instead of static product catalog
- Critical field warnings in MappingStep — shows required/recommended fields with impact descriptions
- SKU Mix chart label indicates "(all data)" when dashboard filters are active
- Cap skuBreakdown to top 25 SKUs to bound Firestore writes

## [0.4.2.2] - 2026-03-19

### Fixed
- Fix "Delete All Data" failing with "Missing or insufficient permissions" — `deleteAllData` was querying a non-existent `rows` subcollection under `uploads/` which has no Firestore rule
- Split delete helper into `deleteChunkedCollection` (data/views/imports with rows) and `deleteFlatCollection` (uploads without rows)
- Add missing collections to delete: `uploadAudit`, `pendingMatches`, `pendingWineMatches` in dashboard data; `wines`, `pipeline` in CRM data
- Clean up account `emails` and `files` subcollections (not just `notes`) during CRM delete

## [0.4.2.1] - 2026-03-19

### Changed
- Update NOW.md: mark upload-to-dashboard fix as shipped (PRs #58–#60)
- Add barrel exports for distributorFormats, productNormalize, and importDiff to Cloud Functions pipeline index

## [0.4.2.0] - 2026-03-18

### Changed
- Upgrade Firebase Cloud Functions from 1st Gen (v4) to 2nd Gen (v7.2.2)
- Upgrade Node.js runtime from 20 to 22
- Migrate all 20 callable functions to v2 onCall pattern: `(data, context) => req => req.data, req.auth`
- Replace `functions.config()` with `process.env` for environment variables (Stripe price IDs)
- Update memory units: "MB"/"GB" → "MiB"/"GiB" for v2 compatibility

### Removed
- Heuristic sheet merge logic (`detectMergeableSheets`) in favor of AI-driven merge via Cloud Functions
- Manual sync retry/timeout logic in JoinPage (v2 functions handle timeouts automatically)

## [0.4.1.0] - 2026-03-18

### Added
- **Multi-user team account model** — complete invite-based team joining with 4 roles (admin, manager, rep, viewer), territory assignment, and plan-based user limits enforced transactionally
- **Invite flow** — admins generate shareable invite links with role/territory/usage-limit config; recipients join via `/join/:code` with signup or existing-account flow
- **TeamContext provider** — real-time Firestore listener for team members, invite CRUD, role/territory updates, manager hierarchy
- **Team management UI** — TeamSettings panel with member table, role/territory dropdowns, invite generation, activity leaderboard with 30-day sparklines
- **Team setup wizard** — 4-step guided onboarding: company name, territories, first invite, share link
- **Role-based permissions** — `usePermissions` hook with capability matrix (canImport, canManageTeam, canDeleteData, etc.) gating UI features
- **Territory configuration** — named territory groups mapped to US states, auto-detected from imported data, visualized via SVG territory map
- **Role-aware filtering** — filter-by-rep dropdowns on Accounts, Activities, and Tasks pages; territory-scoped dashboard filtering
- **Account ownership** — owner column with member name resolution, yellow "Unassigned" badge, right-click context menu to assign rep
- **Manager hierarchy** — `managerId` field on user docs with "Reports To" dropdown in team settings
- **Contextual invite emails** — rich HTML emails via Resend API with company name, role, territory, and account count
- **Firestore security rules** — tenant-scoped access control, role-based write permissions, subscription field protection, viewer read-only enforcement
- **Team delight items** — role badge in sidebar, post-import team invite prompt, sparkline activity trends

### Fixed
- **Cross-tenant user list leak** — Firestore rules now scope user list queries to the caller's own tenant
- **Race condition in joinTeam** — member count check now uses transactional counter on tenant doc instead of non-transactional query
- **JoinPage input focus indicator** — removed `outline: none` to restore keyboard accessibility

## [0.4.0.0] - 2026-03-18

### Added
- **Multi-sheet Excel import with AI-driven merge** — when importing Excel files with multiple sheets, the system now analyzes all sheets via the `comprehendReport` Cloud Function to intelligently merge related data instead of discarding non-primary sheets
- **AI merge instructions** — `comprehendReport` returns `sheetsToMerge` (sheet names to combine), `sheetMappings` (per-sheet column mappings), `mergeStrategy` (dedup_by_key, append, enrich), and `mergeKeyField` (dedup/join field)
- **Lazy two-phase parsing** — `peekAllSheets()` samples all sheets with dynamic token budget (50 rows ÷ N sheets) for AI analysis; full parsing only happens for merge target sheets (performance optimization)
- **Shared merge utilities** — `mergeSheets()` pure function and `runComprehend()` helper extracted to `packages/pipeline/src/` for reuse by frontend DataImport + useFileQueue + functions/sync.js
- **Server-side multi-sheet support** — `functions/sync.js` detects multi-sheet Google Drive files, applies heuristic merge when AI instructions unavailable (header similarity check), streams normalized imports with source metadata
- **React component tests with RTL** — comprehensive test suite for core import flows: `ProductSheetReviewStep`, `MappingStep`, `PreviewStep` (39 test files, 814 tests total)
- **Error boundary regression test** — covers `getDerivedStateFromError`, fallback UI rendering, and `componentDidCatch` logging

### Changed
- `parseFile()` now exports `peekAllSheets()` (returns headers + sample rows for all sheets without full parse) and `parseSheets()` (full-parse specific sheets from cached workbook)
- `comprehendReport` Cloud Function now accepts optional `allSheets` parameter and extends system prompt with multi-sheet merge analysis instructions
- DataImport and useFileQueue now use shared `runComprehend()` helper, eliminating ~65 lines of duplicate comprehend orchestration logic
- `ProductSheetReviewStep` accepts optional `preBuiltProducts` prop to skip `buildProducts()` when merge already produced product-shaped objects
- CI workflow: removed non-fatal `firebase deploy` failures by adding `--force` flag (bypasses missing IAM permission)

### Fixed
- **Dead code in functions/sync.js** — removed unreachable try-catch block attempting to call non-existent `./comprehend-helpers` module; kept working heuristic merge
- **ErrorBoundary placement** — moved to wrap entire provider tree in `main.jsx` so crashes during provider initialization show fallback UI instead of blank screen

### Removed
- Removed manual code paths in DataImport/useFileQueue for comprehend calling (consolidated into `runComprehend()`)
- Removed unused `smartSampleRows()` helper (replaced by dynamic `peekAllSheets()` budget)

## [0.3.3.0] - 2026-03-18

### Fixed
- **Blank screen on direct URL navigation** — moved ErrorBoundary to wrap the entire provider tree in `main.jsx` so crashes during provider initialization show a fallback UI instead of a completely blank page
- **CI production deploys failing** — added `--force` flag to `firebase deploy` in GitHub Actions to bypass missing `secretmanager.secrets.setIamPolicy` IAM permission

### Added
- Regression test for ErrorBoundary covering `getDerivedStateFromError`, fallback rendering, and `componentDidCatch` logging
- TODO-130: Grant Secret Manager IAM to CI service account (deferred)
- TODO-131: Upgrade Cloud Functions to Node.js 22 + firebase-functions 5.x (deadline 2026-04-30)

## [0.3.2.0] - 2026-03-18

### Added
- **Smart sheet selection for multi-sheet Excel files** — when uploading Excel workbooks with multiple sheets, the system now auto-selects the data-rich sheet using a quality heuristic (scores by row count, header quality, data density, and sheet name pattern matching)
- **Sheet scoring heuristic** (`scoreSheet()` in `frontend/src/utils/parseFile.js`) — evaluates sheets by data volume (capped at 5000 rows), header presence (3+ columns bonus, <3 penalty), data density (filled-cell ratio in first 10 rows), and name penalties/bonuses (e.g., "Summary" → -500, "Sales" → +50)
- **Workbook caching** — XLSX workbooks are cached in-memory by `file.name|size|lastModified` to avoid re-reading files when manually switching sheets
- **Manual sheet selection UI** (`SheetSelector` component) — dropdown shows all sheets with row/column counts in scored order; users can switch sheets and re-run mapping without re-uploading
- **AI sheet validation** — `comprehendReport` Cloud Function receives per-sheet summaries and can recommend a different sheet via `recommendedSheet` field; browser re-parses automatically if recommended sheet differs
- **63 unit tests** covering sheet scoring, penalty/bonus regex patterns, multi-sheet heuristics, CSV/single-sheet passthrough, and `requestedSheet` override flows
- **TODO-127** — Cloud Sync Multi-Sheet Support (deferred to next phase) — tracks future parity for auto-synced files from Google Drive

### Changed
- `parseFile(file)` now accepts optional `{ sheet: sheetName }` parameter for explicit sheet selection
- `parseFile()` result now always includes `sheetInfo` object with `{ sheetNames, selectedSheet, sheets: [{name, score, rowCount, headerCount}], multiSheet }`
- DataImport stores `originalSheetInfo` before AI sheet re-parse to preserve full scoring data
- useFileQueue passes sheet context (`sheetNames`, `selectedSheet`, `sheetSummaries`) to `comprehendReport` for AI analysis
- SheetSelector inline styles calibrated to DESIGN.md (border-radius 8px cards, Input Border color, 4px spacing scale)

### Fixed
- useFileQueue sheetInfo loss after AI-recommended sheet re-parse — now stores `originalSheetInfo` before reassignment to preserve full scoring metadata

## [0.3.1.0] - 2026-03-17

### Added
- **Multi-file upload** — drop or select multiple files at once; a queue processes them sequentially with auto-confirm for high-confidence mappings and manual review for low-confidence, PDFs, and product sheets
- **useFileQueue hook** (`hooks/useFileQueue.js`) — queue state management with file validation (10MB limit, 20-file batch cap), duplicate detection against recent uploads, smart sampling for AI comprehension, and auto-confirm threshold logic
- **Queue Panel UI** — inline file list with status badges, progress bar, duplicate warnings, review/remove buttons, and batch completion summary
- **loadRecentUploads** service function — queries last 100 uploads for duplicate detection
- 18 unit tests covering auto-confirm logic, smart sampling, file validation constants, and status flow contracts

### Changed
- DataImport refactored to support both single-file (original flow) and multi-file (queue) modes
- Drop zone updated to accept multiple files with `multiple` attribute
- Back/cancel buttons in mapping, billback, and product sheet review steps are queue-aware — return to queue instead of resetting in batch mode
- Confirm functions (spreadsheet, billback, product sheet) detect queue items and mark them done

## [0.3.0.1] - 2026-03-17

### Fixed
- Wired up 4 broken admin Settings buttons: Change Password (sends Firebase reset email), Reset All Settings (resets tenant config to defaults with confirmation), Manage Subscription (placeholder alert), and Upgrade Plan (scrolls to billing section)
- Added user feedback when Change Password fails due to missing email
- Included `userRole` in Reset All Settings so it resets completely
- Removed redundant route navigation from Upgrade Plan button (already on Settings page)

## [0.3.0.0] - 2026-03-16

### Added
- **Data Setup Assistant** (`/setup` route, `SetupAssistant.jsx`) — guided onboarding flow with role confirmation, distributor selection, step-by-step report download instructions, data upload launcher, and data health tracking
- **Report Guide Content System** (`config/reportGuides.js`) — unified schema serving both UI guidance and file detection, supporting 5 major distributor systems (SGWS, Breakthru, RNDC, Young's, Generic) with role-aware recommendations
- **Data Health Card** (`DataHealthCard.jsx`) — reusable component showing data completeness across 5 data types with visual checklist, health score percentage, and contextual nudge for next upload
- **Setup Analytics** (`services/setupAnalytics.js`) — fire-and-forget event logging (setup_started, guide_viewed, guide_not_found, upload_started, setup_completed) with silent error handling
- **Sidebar Setup Progress Card** — persistent non-blocking card showing onboarding progress (e.g., "2/5 steps complete") with dismiss button and continue link; collapsed sidebar mode shows icon with pulsing badge
- 5 comprehensive test files (165+ tests) covering onboarding state machine transitions, distributor/filename matching, data health computation, analytics fire-and-forget pattern, and sidebar card visibility logic
- Firestore security rules for `analytics/setup/events` subcollection with member write and admin read permissions

### Changed
- Deduplicated `ONBOARDING_STEPS` constant across SetupAssistant, Sidebar, and test files — now single export from `config/reportGuides.js`
- Fixed Importer role secondary recommendations to exclude deferred "billback" data type (will be added when billback feature ships with matching DATA_TYPE entry)

## [0.2.1.0] - 2026-03-16

### Added
- Pricing engine shared TypeScript package (`packages/pricing-engine/`) — 8 international market configs (US Import, US Domestic, UK, Australia, NZ, South Africa, EU Internal, South America), generic market calculator, reverse pricing, FX sensitivity analysis, comparison engine, recap builder, presets
- Pricing Studio page (`/pricing`) with market selector, dynamic input form, waterfall visualization, stakeholder P&L recap, scenario comparison with delta table, analysis panel (target price, FX risk, value chain decomposition), and multi-market overview
- "Tools" section in sidebar navigation with Pricing Studio link
- Vite resolve alias for `pricing-engine` package (TypeScript consumed natively by Vite)
- 7 new pricing engine test files (319 tests total passing)
- Margin guard: all margin inputs clamped to max 99.9% to prevent division-by-zero in `applyMarginOnSelling`
- Bold product-led landing page redesign with pricing tiers, feature showcase, and streamlined signup flow

### Fixed
- Pricing component property access bugs: `result.summary.*` paths, `ChainLayer.label`, `TaxDef.inputLabel`/`defaultValue`, `LogisticsDef.label`/`defaultValue`, `LayerRecap.layerId`/`buyPrice`/`sellPrice`
- `getRateForMarket()` and `formatRateAge()` function signature mismatches in MarketInputForm
- Layer toggle state: `inputs.activeLayers` array (was incorrectly checking `inputs.layers` object)
- Pathway button labels: `pw.label` (was `pw.name`, rendering empty buttons)

## [0.2.0.0] - 2026-03-15

### Added
- Shared pipeline package (`packages/pipeline/src/`) — single source of truth for parseFile, transformData, semanticMapper, normalize (eliminates 490-line duplicate in `functions/lib/pipeline.js`)
- Normalized data model with `imports/` (raw rows) + `views/` (pre-computed dashboards), feature-flagged via `useNormalizedModel`
- Import CRUD: saveImport, loadImports, loadImportRows, deleteImport
- `rebuildViews` Cloud Function — full rebuild from all import rows, rate limited (10/hour), per-type concat with last-type-wins
- `extractAccounts` Cloud Function — auto-extract CRM entities with 3-phase AI dedup (exact match → Claude fuzzy → create new), confidence routing (>0.85 auto-link, 0.5-0.85 pending review, <0.5 create new)
- 4 industry roles: Winery, Importer, Distributor, Retailer (with role-specific terminology and field definitions)
- Firebase emulator config (Firestore, Functions, UI) and integration test harness
- 78 new unit tests (137 total): firestoreService (17), rebuildViews snapshot (6), terminology (10), account extraction (18), semanticMapper roles (7), normalize (13), + integration tests (5)
- Firestore security rules for imports/, views/, pendingMatches/, rebuildHistory/
- LLM output shape validation for AI match responses
- Prompt injection defense via sanitizeAccountName (special char stripping, 100-char truncation)

### Changed
- Frontend utils (parseFile, transformData, semanticMapper) now re-export from shared pipeline package
- Cloud Functions use shared pipeline via predeploy copy (`cp -r packages/pipeline/src functions/lib/pipeline`)
- Extracted `verifyTenantMembership`, `buildAIPrompt`, `parseAIResponse` helpers (were duplicated 3-4x)
- Tightened accounts/ Firestore write rules from `isTenantMember` to `isTenantAdmin`
- `functions/package.json` test scripts: `npm test` runs `*.unit.test.js`, `test:integration` runs emulator tests

### Removed
- `functions/lib/pipeline.js` — replaced by shared package

## [0.1.0.0] - 2026-03-16

### Added
- Vitest test suite with 59 unit tests covering parseFile, semanticMapper, and transformData
- Realistic synthetic test fixtures (QuickBooks grouped, depletion, purchase, inventory, pipeline)
- Chunked subcollection storage for datasets exceeding Firestore 1MB document limit
- Version-flagged chunk writes with automatic old-version cleanup
- User profile auto-provisioning on first login (creates user profile + tenant doc)
- Auth role enforcement (admin/rep/viewer) loaded from Firestore user profile
- File size validation (10MB limit) in DataImport before parsing
- Auth error screen with sign-out option
- VERSION and CHANGELOG files

### Changed
- Firebase Hosting now serves from `frontend/dist` instead of project root (security fix)
- AI column mapper now uses Firebase callable function exclusively (removed browser-direct Anthropic API path)
- AuthContext is now the single source of truth for tenantId and user role
- DataContext receives tenantId from AuthContext instead of hardcoding "default"
- DataImport uses real tenantId for upload audit logging
- Settings tab gated to admin role only (was hardcoded `isAdmin={true}`)
- Firestore service functions no longer default to "default" tenantId

### Fixed
- O(n^2) performance in transformDepletion placementSummary/reEngagement (now uses groupBy)
- Dead variable `authUserRole` removed from DataContext
- `MAX_FILE_SIZE` constant moved to module scope (was re-created every render)
