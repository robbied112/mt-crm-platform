# CLAUDE.md

MT CRM Platform is a Firebase + React app for wine and spirits teams. The frontend is a Vite SPA. Firestore stores both dashboard datasets and CRM entities. Cloud Functions handle AI mapping, Stripe billing, rebuilds, account extraction, Google Drive sync, team invites, and transactional email.

## Architecture Overview

```text
Browser (React + Vite)
  |
  +-- AuthContext
  |     -> Firebase Auth
  |     -> users/{uid}
  |
  +-- DataContext
  |     -> firestoreService.js
  |     -> tenants/{tenantId}/data|imports|views|config
  |
  +-- CrmContext
  |     -> crmService.js
  |     -> tenants/{tenantId}/accounts|contacts|tasks|activityLog
  |
  +-- TeamContext
  |     -> teamService.js
  |     -> tenants/{tenantId}/invites, users (by tenantId)
  |
  +-- Components / Routes
        -> dashboard tabs, CRM pages, settings, import UI, join page

Shared Pipeline Package
  packages/pipeline/src/
    -> parseFile
    -> semanticMapper
    -> normalize
    -> transformData
    -> constants
    -> firestore

Cloud Functions (Node 20)
  functions/index.js
    -> ai.js
    -> rebuild.js
    -> accounts.js
    -> sync.js
    -> stripe.js
    -> helpers.js

Firebase
  -> Auth
  -> Firestore
  -> Hosting
  -> Scheduled Functions
```

## Repo Layout

```text
frontend/
  src/
    components/   UI + route-level screens
    context/      AuthContext, DataContext, CrmContext, TeamContext
    services/     Firestore CRUD, CRM CRUD, team service, demo data
    utils/        Shared pipeline re-exports and browser helpers
    config/       Firebase config, tenant terminology, roles
    hooks/        UI/state hooks

functions/
  ai.js          Claude-powered mapping/inference
  rebuild.js     Recompute normalized views
  accounts.js    Account extraction + dedup
  sync.js        Google Drive connector / scheduled sync
  stripe.js      Billing webhook
  team.js        Invite validation + joinTeam (transactional)
  email.js       Invite emails via Resend API
  billing.js     Checkout + portal sessions
  helpers.js     Admin init, secrets, shared function helpers
  lib/pipeline/  Copy of packages/pipeline/src for deploy/runtime

packages/pipeline/src/
  Shared pure logic used by frontend and functions
```

## Local Dev Setup

1. Install deps:

```bash
cd frontend && npm install
cd ../functions && npm install
```

2. Run the frontend:

```bash
cd frontend
npm run dev
```

3. Run Firebase emulators:

```bash
firebase emulators:start --only firestore,functions --project demo-test
```

4. Deploy-time copy behavior:

```text
firebase.json predeploy:
packages/pipeline/src -> functions/lib/pipeline
frontend -> frontend/dist
```

5. Useful build/test commands:

```bash
cd frontend && npm test
cd frontend && npm run build
cd functions && npm test
cd functions && npm run test:integration
```

## Key Conventions

- CSS uses BEM-style class naming in `frontend/src/styles/Global.css`.
- Component exports are centralized through barrel files like `frontend/src/components/index.js`.
- Tenant business terminology comes from `frontend/src/config/tenant.js` and `tenantConfig.userRole`.
- Shared data logic should live in `packages/pipeline/src/` first, then be copied into `functions/lib/pipeline/`.
- `DataContext` is the read model for dashboard data. `CrmContext` is the read/write model for account-level CRM data. `TeamContext` manages team members and invites.
- `tenantId` comes from `AuthContext`; avoid hardcoding tenant IDs.
- Role-based permissions are defined centrally in `config/roles.js`. Use `usePermissions()` hook to check capabilities.

## Critical Paths

### Auth Flow

```text
Login / signup
  -> Firebase Auth
  -> AuthContext fetchOrCreateProfile()
  -> users/{uid}
  -> tenant auto-provision on first signup
  -> DataContext / CrmContext boot once tenantId is known
```

- `AuthContext` derives `tenantId`, auth role, admin/manager status, and territory from the user profile.
- First-time signup creates both `users/{uid}` and `tenants/{tenantId}`.
- Demo data is seeded during first-tenant creation.
- Users joining via invite get their profile set by the `joinTeam` Cloud Function.

### Team & Invite Flow

```text
Admin creates invite (TeamSettings / TeamSetupWizard)
  -> teamService.createInvite()
  -> tenants/{tenantId}/invites/{inviteId}
  -> shareable link: /join/{code}

Recipient clicks invite link
  -> JoinPage renders at /join/:code
  -> validateInvite Cloud Function (no auth required)
  -> displays company name, role, territory

Recipient joins (new or existing user)
  -> joinTeam Cloud Function (transactional)
  -> validates expiry + usage + plan user limit
  -> sets users/{uid} tenantId/role/territory
  -> increments invite usedCount + tenant memberCount
```

- Roles: `admin`, `manager`, `rep`, `viewer` — defined in `config/roles.js`.
- Role capabilities (canImport, canManageTeam, etc.) in `ROLE_CAPABILITIES` matrix.
- `usePermissions` hook derives boolean permission flags from role.
- `TeamContext` provides real-time member list, invite CRUD, role/territory updates.
- Territory filtering uses `utils/territory.js` `matchesUserTerritory()`.
- Firestore rules enforce tenant-scoped access and role-based write permissions.

### Import Flow

Manual upload:

```text
DataImport
  -> parseFile / semanticMapper / transformData
  -> normalizeRows()
  -> DataContext.importDatasets()
  -> saveImport() to imports/
  -> saveAllViews() or saveAllDatasets()
```

Cloud sync:

```text
Google Drive file
  -> functions/sync.js processTenantSync()
  -> parseFileBuffer + AI mapping
  -> normalizeRows()
  -> save raw import to imports/ with source metadata
  -> rebuildViewsForTenant()
  -> views/ + _summary
```

Normalized model notes:

- `imports/` is the source of truth for uploaded rows.
- `views/` contains precomputed dashboard datasets for fast reads.
- `data/` is the legacy path still used when `tenantConfig.useNormalizedModel !== true`.

### CRM Flow

```text
Route loads
  -> CrmContext subscribes to Firestore
  -> accounts / contacts / tasks / activityLog streams
  -> CRUD via crmService.js
  -> notes live under accounts/{accountId}/notes
```

- CRM data is tenant-scoped and realtime.
- Deleting an account cascades related contacts, activities, tasks, and notes in the client service layer.

## Firestore Schema

```text
users/{uid}
  email
  displayName
  tenantId
  role              (admin/manager/rep/viewer)
  territory         (territory name or "all")
  managerId         (uid of reporting manager, optional)
  joinedAt
  invitedBy

tenants/{tenantId}
  companyName
  subscription
  memberCount       (transactional counter for plan limit enforcement)
  territories       (map of territory name → state abbreviation arrays)
  createdAt

tenants/{tenantId}/config/main
  userRole
  useNormalizedModel
  cloudSync
  rebuildLock

tenants/{tenantId}/data/{dataset}
  legacy precomputed dashboard docs

tenants/{tenantId}/imports/{importId}
  fileName
  type
  mapping
  source
  rowCount
  createdAt
  rows/{chunkId}

tenants/{tenantId}/views/{dataset}
  chunked precomputed dashboard docs
  rows/{chunkId}

tenants/{tenantId}/views/_summary
  text

tenants/{tenantId}/invites/{inviteId}
  code              (UUID, globally unique)
  role
  territory
  maxUses
  usedCount
  expiresAt
  createdBy
  createdAt

tenants/{tenantId}/accounts/{accountId}
  notes/{noteId}

tenants/{tenantId}/contacts/{contactId}
tenants/{tenantId}/tasks/{taskId}
tenants/{tenantId}/activityLog/{logId}
tenants/{tenantId}/uploads/{uploadId}
tenants/{tenantId}/pendingMatches/{matchId}
tenants/{tenantId}/syncState/{doc}
tenants/{tenantId}/syncHistory/{doc}
tenants/{tenantId}/rebuildHistory/{doc}
tenants/{tenantId}/secrets/{doc}  (server-only)
```

## Testing Strategy

- Frontend data pipeline and Firestore service tests use Vitest in `frontend/src/__tests__/`.
- Rebuild logic has frontend snapshot tests plus Firestore emulator integration coverage in `functions/__tests__/rebuildViews.integration.test.js`.
- Functions integration tests rely on the Firebase Local Emulator Suite and `functions/__tests__/emulator-helpers.js`.
- For storage-model changes, verify both:
  - client tests around `firestoreService`
  - emulator tests around import -> rebuild -> views

## Current Implementation Notes

- `functions/index.js` is a barrel re-exporter only.
- Shared chunked Firestore behavior now lives in `packages/pipeline/src/firestore.js`.
- `processTenantSync()` writes normalized imports and triggers rebuilds; it no longer writes legacy `data/`.
- `CloudSyncSettings` manual sync calls `cloudSyncSyncNow`.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
