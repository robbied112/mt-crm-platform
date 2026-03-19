# NOW — Active Work (max 3 items)

> This is the entire active workload. If it's not here, it's not happening.
> TODOS.md is the archive. This file is the contract.
>
> Rules:
> - Maximum 3 items at any time
> - Each item has a DONE definition
> - No item stays here longer than 1 week
> - To add a 4th, one must ship or be cut

---

### 1. Fix multi-import pipeline (server-authoritative rebuild)

**Problem:** Uploading a second file of the same type overwrites the first file's dashboard views. The frontend calls `saveAllViews()` with only the new import's transformed data, clobbering the previous import. The `rebuildViews` Cloud Function (which aggregates ALL imports) is never called from the manual upload path.

**Fix:** Change `importDatasets()` in `DataContext.jsx` so that when `useNormalizedModel=true`, the frontend ONLY saves the raw import to `imports/`. Then call `rebuildViews` Cloud Function, which reads ALL imports, runs `transformAll()` across the combined data, and writes to `views/`. Remove the frontend `saveAllViews()` call for normalized model.

**Files:**
- `frontend/src/context/DataContext.jsx` — remove `saveAllViews()` call, add `rebuildViews` callable
- `functions/rebuild.js` — verify it handles being called from frontend (already a callable)
- `frontend/src/components/DataImport/index.jsx` — may need loading state for rebuild

**DONE when:**
- [ ] Upload file A → dashboard shows A's data
- [ ] Upload file B (same type) → dashboard shows A+B combined data
- [ ] Delete import B → dashboard shows only A's data (rebuild after delete)
- [ ] Integration test covers the multi-import aggregation path
- [ ] Frontend test covers the importDatasets → rebuild → refresh flow

---

### 2. End-to-end smoke test for upload → dashboard

**Problem:** No test verifies the complete path: file parsed → AI comprehend → transform → save to Firestore → views rebuilt → dashboard data loads. Individual pieces are tested (866 unit tests pass) but the integration is untested.

**Fix:** Write an integration test using the Firebase emulator that:
1. Calls `saveImport()` with realistic normalized rows
2. Calls `rebuildViews()`
3. Reads from `views/` and verifies correct aggregated data
4. Verifies that a second import produces correct combined views

**Files:**
- `functions/__tests__/rebuildViews.integration.test.js` — extend existing test file

**DONE when:**
- [ ] Test passes with 1 import → correct views
- [ ] Test passes with 2 imports (same type) → correct combined views
- [ ] Test passes with import delete → views update correctly
- [ ] Runs in CI (`npm run test:integration` in functions/)

---

### 3. [empty — ship 1 and 2 first]

---

## Recently shipped
<!-- Move items here when done. One line. Date + PR#. -->
