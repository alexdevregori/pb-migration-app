# Productboard Workspace Migration Tool — Design Spec

**Date:** 2026-03-31
**Status:** Approved

---

## Overview

A locally-run web application for performing a one-time bulk migration of data between two Productboard workspaces. The app fetches data from a source workspace via the Productboard v2 API and recreates it in a destination workspace, preserving hierarchy and relationships while generating new IDs. The destination workspace uses a different entity structure than the source (source Products become Components under a new "Migration" product).

---

## Goals

- Migrate product hierarchy, notes, companies, and releases from source to destination workspace
- Insights are auto-generated server-side by Productboard when notes are linked to features — they are not directly migrated
- Allow the user to filter features and subfeatures by status before migrating
- Allow the user to filter releases by release group before migrating
- Allow the user to select which custom fields to carry over
- Provide a live progress dashboard with per-step visibility
- Support resume if the migration crashes mid-run
- Always create new entities in the destination (no deduplication or conflict resolution)

---

## Out of Scope

- Workspace members cannot be created via the Productboard API — they are matched by email to existing members in the destination and assigned as owners where a match is found
- Two-way sync or incremental updates after the initial migration
- Rollback / undo functionality
- opportunityNote type (cannot be created via API per spec)

---

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Runtime:** Node.js (local only, never deployed)
- **API communication:** Native `fetch` with server-side Next.js API routes (no CORS issues)
- **State persistence:** `migration-state.json` on disk (git-ignored)
- **Progress streaming:** Server-Sent Events (SSE) from API route to React UI

---

## Entity Type Mapping (Source → Destination)

| Source Entity | Destination Entity | Notes |
|---|---|---|
| — | Product: "Migration" | Created by the app as the root container |
| Product | Component | Created under the Migration product |
| Component | Component | Created under the destination component that represents its source parent product |
| Feature | Feature | Filtered by user-selected statuses |
| Subfeature | Subfeature | Filtered by user-selected statuses |
| Release Group | Release Group | Only user-selected release groups are migrated |
| Release | Release | Only releases belonging to selected release groups; linked to migrated features/subfeatures |
| Note | Note | Linked to destination features + destination users/companies |
| Insight | Insight | Auto-generated server-side by Productboard when notes are linked to features — not queryable or directly migratable via API |
| Company | Company | Customer companies discovered via notes/insights |
| User (customer) | User (customer) | Customer users discovered via notes/insights |
| Member (workspace) | Member (workspace) | Read-only — matched by email, not created |

---

## Migration Order

Steps run sequentially. Each step must complete before the next begins.

1. **Create Migration Product** — Create a single Product named "Migration" in the destination workspace. Save its ID.
2. **Products → Components** — Fetch all source products. Create each as a Component under the Migration product. Save source→destination ID map.
3. **Components → Components** — Fetch all source components. Create each as a Component under its parent (now a destination Component from step 2). Save ID map.
4. **Features** — Fetch source features filtered by user-selected statuses. Create each under its parent destination Component. Apply selected custom fields. Save ID map.
5. **Subfeatures** — Fetch source subfeatures filtered by user-selected statuses. Create each under its parent destination Feature. Apply selected custom fields. Save ID map.
6. **Release Groups** — Fetch source release groups. Create only the user-selected ones in the destination. Save ID map.
7. **Releases** — Fetch source releases whose parent release group is in the selected set. Create each in the destination under its destination release group. Link to migrated features/subfeatures via relationship API. Save ID map.
8. **Discover Notes** — For each migrated feature and subfeature, call `POST /v2/notes/search` on the source workspace with filter `relationships.link.ids` set to the source feature/subfeature IDs. Paginate through all results. No writes — discovery only. Extract and deduplicate companies and users from note relationships only. (Insights cannot be queried via API — they are auto-generated server-side by Productboard when notes are linked to features in Step 11.)
9. **Companies** — Create discovered customer companies in the destination. Save ID map.
10. **Users (customers)** — Create discovered customer users in the destination. Save ID map.
11. **Notes** — Create notes in the destination, linking to destination features/subfeatures (via ID map) and destination users/companies (via ID map). For `owner` and `creator` fields: match by email to existing destination workspace members; if no match, omit the field and log a warning. Insights are auto-generated server-side by Productboard when notes are linked to features.

---

## Architecture

```
migration-app/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Single-page UI
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── migrate/
│   │       │   └── route.ts              # POST: start migration / DELETE: stop
│   │       ├── status/
│   │       │   └── route.ts              # GET: SSE stream for live progress
│   │       └── workspaces/
│   │           └── route.ts              # GET: validate keys, fetch statuses + fields
│   ├── lib/
│   │   ├── productboard/
│   │   │   ├── client.ts                 # Fetch wrapper: auth, rate limiting, retry
│   │   │   └── types.ts                  # TypeScript types derived from YAML specs
│   │   ├── migrators/
│   │   │   ├── index.ts                  # Orchestrator — runs steps in order
│   │   │   ├── migration-product.ts
│   │   │   ├── products.ts
│   │   │   ├── components.ts
│   │   │   ├── features.ts
│   │   │   ├── subfeatures.ts
│   │   │   ├── release-groups.ts
│   │   │   ├── releases.ts
│   │   │   ├── notes.ts
│   │   │   ├── companies.ts
│   │   │   └── users.ts
│   │   ├── state.ts                      # Read/write migration-state.json
│   │   └── progress.ts                   # SSE event emitter helpers
│   └── components/
│       ├── ConfigForm.tsx                # API key inputs + Connect button
│       ├── StatusSelector.tsx            # Checkbox list of source feature/subfeature statuses
│       ├── ReleaseGroupSelector.tsx      # Checkbox list of source release groups
│       ├── FieldSelector.tsx             # Checkbox list of source custom fields
│       └── MigrationDashboard.tsx        # Per-step progress rows + error display
├── migration-state.json                  # Auto-created, git-ignored
├── api-v2-specs/                         # YAML API spec files (reference)
├── docs/
│   └── superpowers/specs/               # Design docs
└── .env.local                            # Not used — keys entered via UI
```

---

## UI Flow

### Panel 1: Config
- Source API key input
- Destination API key input
- "Connect" button — validates both keys via `GET /api/workspaces`, then unlocks Panel 2

### Panel 2: Migration Settings (unlocked after connect)
- **Status selector** — checkboxes populated from source workspace statuses (fetched via `/v2/entities/configurations/feature`). User selects which statuses to include for features and subfeatures.
- **Release Group selector** — checkboxes of all release groups fetched from source workspace (`GET /v2/entities?type[]=releaseGroup`). User selects which release groups (and their releases) to migrate.
- **Field selector** — checkboxes of all custom fields on features/subfeatures from the source workspace config. User selects which to carry over.
- **"Start Migration"** button
- **"Resume"** button (shown only if a prior partial run exists in `migration-state.json`)

### Panel 3: Progress Dashboard (visible after migration starts)
- One row per step: step name, status indicator (waiting / running / done / error), count migrated out of total
- Errors shown inline per step — each error displays the source entity name and the error message
- Non-blocking: one entity error does not stop the step

---

## State File Schema

`migration-state.json` — written after each entity is successfully migrated.

```json
{
  "config": {
    "sourceApiKey": "...",
    "destinationApiKey": "...",
    "selectedStatuses": ["In Progress", "Planned"],
    "selectedReleaseGroups": ["release-group-uuid-1", "release-group-uuid-2"],
    "selectedFields": ["field-uuid-1", "field-uuid-2"]
  },
  "migrationProductId": "dest-uuid",
  "idMap": {
    "products": {},
    "components": {},
    "features": {},
    "subfeatures": {},
    "releaseGroups": {},
    "releases": {},
    "companies": {},
    "users": {},
    "notes": {}
  },
  "steps": {
    "migrationProduct": "pending",
    "products": "pending",
    "components": "pending",
    "features": "pending",
    "subfeatures": "pending",
    "releaseGroups": "pending",
    "releases": "pending",
    "discoverNotes": "pending",
    "companies": "pending",
    "users": "pending",
    "notes": "pending"
  },
  "errors": []
}
```

Step values: `pending` | `in_progress` | `completed` | `failed`

**Resume behavior:** On resume, the orchestrator skips all `completed` steps and restarts from the first `in_progress` or `pending` step.

---

## API Client Design

All Productboard API calls go through a single `client.ts` wrapper that handles:

### Rate Limiting
- **Limit:** 50 requests/second per access token (source and destination are separate tokens with independent buckets)
- **Proactive throttling:** Monitor `X-RateLimit-Remaining` header on every response. When remaining drops below 5, pause before the next request.
- **429 handling:** Read `Retry-After` header and wait exactly that many seconds before retrying. No exponential backoff needed — the API specifies the exact wait time.
- **Retry limit:** Retry up to 3 times on 429. After 3 failures, log as an error and move on.

### Pagination
- Cursor-based: use `pageCursor` query param, follow `links.next` in responses until null.
- All list operations in migrators use a shared `paginate()` helper that collects all pages automatically.

### Authentication
- Bearer token in `Authorization` header for all requests.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Single entity creation fails | Log error with source ID + name + message. Continue to next entity. |
| 429 Too Many Requests | Wait `Retry-After` seconds, retry up to 3 times. |
| Step-level crash (network, bad key) | Mark step as `failed` in state. Halt migration. User fixes issue and resumes. |
| Member not found in destination | Log as warning (not error). Create entity without owner assigned. |
| Note linked to unmigrated feature | Skip note, log as warning. |
| Note owner/creator not found in destination | Log as warning. Create note without owner/creator field. |

---

## Key API Endpoints Used

| Operation | Endpoint |
|---|---|
| Validate API key / fetch config | `GET /v2/entities/configurations/{type}` |
| Fetch statuses for features | `GET /v2/entities/fields/{id}/values` |
| List entities (all types) | `GET /v2/entities?type[]={type}` |
| List release groups | `GET /v2/entities?type[]=releaseGroup` |
| Search entities by status | `POST /v2/entities/search` |
| Create entity (all types incl. releaseGroup, release) | `POST /v2/entities` |
| Set field value | `PATCH /v2/entities/{id}` |
| Create relationship | `POST /v2/entities/{id}/relationships` |
| List notes | `GET /v2/notes` |
| Search notes by feature | `POST /v2/notes/search` |
| Create note | `POST /v2/notes` |
| List members | `GET /v2/members` |
| Search members by email | `POST /v2/members/search` |

---

## Constraints & Assumptions

- The destination workspace is assumed to exist and be accessible with the provided API key
- Workspace members are pre-existing in both workspaces; matched by email
- The "Migration" product name is hardcoded — if a product with that name already exists in the destination, a new one is still created (per the "always create new" rule)
- `opportunityNote` type is excluded — cannot be created via API
- The app runs locally only; no deployment, no auth layer needed
- Both API keys are stored in `migration-state.json` on disk — the user is responsible for keeping this file secure
- Insights cannot be queried or migrated directly via the Productboard API — they are auto-generated server-side when notes are linked to features
