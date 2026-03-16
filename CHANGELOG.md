# Changelog

All notable changes to this project will be documented in this file.

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
