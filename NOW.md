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

### 1. [empty]

---

### 2. [empty]

### 3. [empty]

---

## Recently shipped
<!-- Move items here when done. One line. Date + PR#. -->
- 2026-03-19 — PR #58 merged: server-authoritative rebuild for multi-import pipeline (code + 4 integration tests). Live smoke test FAILED — dashboard still empty after upload.
- 2026-03-19 — PR #59 + #60: fix upload-to-dashboard loop. Root causes: useNormalizedModel defaulted false (rebuild dead code), transformRevenue crashed on dateless QB rows, Admin SDK rejected undefined fields. Live smoke test PASSED — Revenue & Sales dashboard populates from QB upload.
