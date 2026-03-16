# Changelog

All notable changes to this project will be documented in this file.

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
