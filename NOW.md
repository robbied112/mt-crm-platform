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

### 1. Fix upload-to-dashboard loop (live smoke test failing)

**Status:** DIAGNOSED + FIX IMPLEMENTED — pending deploy and live verification.

**Root causes found (2026-03-19 eng review):**
1. `useNormalizedModel` defaults to `false` in tenant.js and no code ever sets it to `true` → PR 58's rebuild path was dead code in production
2. `transformRevenue` silently returns empty arrays when QB rows have no valid dates → dashboard locked even though accounts populated

**Fixes applied:**
- `tenant.js`: `useNormalizedModel` default changed to `true` (activates rebuild path)
- `transformRevenue.js`: added dateless fallback — when >80% rows lack dates, aggregates by channel/product into "all-time" period
- 7 new unit tests for dateless fallback (883 total pass)
- 2 new integration tests: QB rebuild + dateless QB rebuild

**DONE when:**
- [ ] Upload a QuickBooks file → Revenue & Sales dashboard populates (not empty/locked)
- [ ] Data Intelligence banner + dashboard both show data from the same upload
- [ ] Verified on live site, not just emulator tests

---

### 2. [empty]

### 3. [empty]

---

## Recently shipped
<!-- Move items here when done. One line. Date + PR#. -->
- 2026-03-19 — PR #58 merged: server-authoritative rebuild for multi-import pipeline (code + 4 integration tests). Live smoke test FAILED — dashboard still empty after upload.
