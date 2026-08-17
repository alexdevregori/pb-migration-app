# Productboard Migration App

A Next.js tool for migrating data from one Productboard workspace to another. You provide a source and destination API key, choose what to copy, and the app recreates the selected entities in the destination workspace — streaming live progress as it goes.

> **Read-and-create only.** The app only ever issues `GET` and `POST` requests to the Productboard API. It never updates or deletes anything in either workspace. Existing destination data is left untouched; migrated entities are always created fresh.

## What it migrates

The migration runs as an ordered, resumable pipeline. Each step is tracked independently so an interrupted run can pick up where it left off:

1. **Discovery** — scans the source workspace and resolves the parent hierarchy for the selected entities.
2. **Migration Product** — creates a top-level product to hold migrated data.
3. **Products** — only those containing relevant features.
4. **Components** — only those containing relevant features.
5. **Release Groups** — when selected.
6. **Releases** — migrated before features so release links can be set on feature creation.
7. **Features** — with custom fields, statuses, tags, owners, source-ID stamping, and Jira issue keys.
8. **Subfeatures**
9. **Dependencies** — links between migrated features.
10. **Notes** (with **Companies** and **Users** as prerequisites) — feedback notes attached to migrated features, plus optional orphan/linked-note strategies.

## Configuration options

Configured through the UI (`ConfigForm` and the selector components) and carried in `MigrationConfig`:

- **Source & destination API keys**
- **Status filter** — only features in the selected statuses are migrated, with optional source→destination **status mapping**.
- **Product filter** — restrict the migration to specific source products.
- **Release groups** — select which to bring over.
- **Custom & built-in feature fields** — choose which fields to copy, with optional source→destination **field mapping** and cross-workspace select-option resolution.
- **Owner filter** — migrate only features/subfeatures owned by selected users.
- **Tag filter** — copy only tags matching given keywords (`contains` or `exact` match).
- **Source ID stamping** — write each source entity's original API ID into a destination text field.
- **Jira integration mapping** — copy Jira issue keys into destination text fields, one mapping per integration.
- **Note migration** — opt in to linked notes, notes on non-migrated features, and processed/unprocessed orphan notes, each with an optional max-age limit. Optionally append the source owner's email to unassigned notes.

## How it works

- **UI** (`src/app/page.tsx`, `src/components/*`) — a single-page configuration and dashboard experience. Selectors load live workspace data from the source via the API routes.
- **API routes** (`src/app/api/*`):
  - `POST /api/migrate` — starts (or resumes) a migration run in the background.
  - `GET /api/migrate` — reports whether a prior run exists on disk.
  - `GET /api/migrate/state` — returns saved run state.
  - `GET /api/workspaces` — loads source workspace metadata for the UI.
  - `GET /api/status` — SSE stream of live progress events.
- **Migrators** (`src/lib/migrators/*`) — one module per entity type, orchestrated by `runMigration` in `index.ts`.
- **State** (`src/lib/state.ts`) — run progress and source→destination ID maps are persisted to `migration-state.json` in the project root, making runs resumable.
- **Progress** (`src/lib/progress.ts`) — per-step status is streamed to the dashboard over Server-Sent Events.

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste your source and destination Productboard API keys, choose what to migrate, and start the run. Progress streams live in the dashboard; a run can be resumed if interrupted.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Run Jest in watch mode |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19
- TypeScript
- Tailwind CSS 4
- Jest + Testing Library

## Notes on Next.js

This project targets a version of Next.js with breaking changes relative to older releases. Consult the bundled docs in `node_modules/next/dist/docs/` before making framework-level changes (see `AGENTS.md`).
