# Changelog

All notable changes to this project will be documented in this file.


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
