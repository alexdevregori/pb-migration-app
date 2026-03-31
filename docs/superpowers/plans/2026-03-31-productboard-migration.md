# Productboard Workspace Migration Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-run Next.js + TypeScript web app that migrates products, components, features, subfeatures, release groups, releases, notes, companies, and users between two Productboard workspaces using the v2 API.

**Architecture:** A single Next.js App Router app where server-side API routes call the Productboard API (avoiding CORS), stream live progress to the React UI via Server-Sent Events, and persist migration state to a local JSON file enabling resume on crash. Each entity type has its own migrator module; an orchestrator runs them in dependency order.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Jest, @testing-library/react, Node.js 18+

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/productboard/types.ts` | TypeScript interfaces for all PB API entities, responses, and state |
| `src/lib/productboard/client.ts` | Rate-limited fetch wrapper with retry and pagination helpers |
| `src/lib/state.ts` | Read/write `migration-state.json`; initialize and update state |
| `src/lib/progress.ts` | Module-level EventEmitter; `emitProgress()` helper |
| `src/app/api/workspaces/route.ts` | Validate API keys; return statuses, release groups, custom fields |
| `src/app/api/migrate/route.ts` | Start migration in background; delegate to orchestrator |
| `src/app/api/status/route.ts` | SSE stream — subscribe to progress emitter, push events to client |
| `src/lib/migrators/index.ts` | Orchestrator — runs all migrators in dependency order |
| `src/lib/migrators/migration-product.ts` | Create "Migration" product in destination |
| `src/lib/migrators/products.ts` | Migrate source products as destination components |
| `src/lib/migrators/components.ts` | Migrate source components as destination components |
| `src/lib/migrators/features.ts` | Migrate features filtered by status; apply selected custom fields |
| `src/lib/migrators/subfeatures.ts` | Migrate subfeatures filtered by status; apply selected custom fields |
| `src/lib/migrators/release-groups.ts` | Migrate user-selected release groups |
| `src/lib/migrators/releases.ts` | Migrate releases under selected release groups; link to features |
| `src/lib/migrators/notes.ts` | Discover notes linked to migrated features; create in destination |
| `src/lib/migrators/companies.ts` | Create customer companies discovered from notes |
| `src/lib/migrators/users.ts` | Create customer users discovered from notes |
| `src/components/ConfigForm.tsx` | API key inputs + Connect button |
| `src/components/StatusSelector.tsx` | Checkbox list of feature/subfeature statuses |
| `src/components/ReleaseGroupSelector.tsx` | Checkbox list of release groups |
| `src/components/FieldSelector.tsx` | Checkbox list of custom fields |
| `src/components/MigrationDashboard.tsx` | Per-step progress rows + inline error display |
| `src/app/page.tsx` | Single page — wires all panels, manages UI state |
| `src/app/layout.tsx` | Root layout with metadata |

**Test files mirror source structure under `src/__tests__/`.**

---

## Task 1: Project Scaffold

**Files:**
- Create: `migration-app/` (Next.js project root)
- Create: `.gitignore` additions
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js app**

Run from `/Users/alexdegregori/Projects/migration-app/`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: Next.js project created with `src/app/`, `tailwind.config.ts`, `tsconfig.json`.

- [ ] **Step 2: Install test dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest ts-node
```

- [ ] **Step 3: Create Jest config**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, ensure `scripts` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Add migration-state.json to .gitignore**

Append to `.gitignore`:
```
migration-state.json
```

- [ ] **Step 6: Create test directory structure**

```bash
mkdir -p src/__tests__/lib/productboard
mkdir -p src/__tests__/lib/migrators
mkdir -p src/__tests__/components
```

- [ ] **Step 7: Verify scaffold works**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js + TypeScript project with Jest"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/productboard/types.ts`

- [ ] **Step 1: Create types file**

Create `src/lib/productboard/types.ts`:

```typescript
// ── Productboard API entity types ──────────────────────────────────────────

export type EntityType =
  | 'product'
  | 'component'
  | 'feature'
  | 'subfeature'
  | 'release'
  | 'releaseGroup'

export interface PBEntity {
  id: string
  type: EntityType
  fields: Record<string, unknown>
  relationships?: PBRelationship[]
}

export interface PBRelationship {
  type: 'parent' | 'child' | 'link' | 'isBlockedBy' | 'isBlocking' | 'customer'
  data: { id: string; type?: string }
}

export interface PBNote {
  id: string
  type: 'textNote' | 'conversationNote'
  fields: {
    name: string
    content?: string
    processed?: boolean
    archived?: boolean
    tags?: { name: string }[]
  }
  relationships?: PBNoteRelationship[]
}

export interface PBNoteRelationship {
  type: 'link' | 'customer' | 'owner' | 'creator'
  data: { id: string; type?: string }
}

export interface PBMember {
  id: string
  name: string
  email: string
  username: string
  role: 'admin' | 'maker' | 'viewer' | 'contributor'
}

export interface PBCustomer {
  id: string
  type: 'user' | 'company'
  fields: {
    name?: string
    email?: string
    domain?: string
  }
}

export interface PBFieldConfig {
  id: string
  name: string
  path: string
  schema: { type: string }
  lifecycle: string[]
}

export interface PBEntityConfig {
  type: EntityType
  fields: PBFieldConfig[]
  filters: string[]
}

export interface PBStatus {
  id: string
  name: string
}

export interface PBReleaseGroup {
  id: string
  type: 'releaseGroup'
  fields: {
    name: string
    description?: string
  }
}

// ── Paginated list response ─────────────────────────────────────────────────

export interface PBListResponse<T> {
  data: T[]
  links: {
    next: string | null
  }
}

export interface PBSingleResponse<T> {
  data: T
}

// ── Migration state ─────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type StepName =
  | 'migrationProduct'
  | 'products'
  | 'components'
  | 'features'
  | 'subfeatures'
  | 'releaseGroups'
  | 'releases'
  | 'discoverNotes'
  | 'companies'
  | 'users'
  | 'notes'

export interface MigrationConfig {
  sourceApiKey: string
  destinationApiKey: string
  selectedStatuses: string[]
  selectedReleaseGroups: string[]
  selectedFields: string[]
}

export interface MigrationState {
  config: MigrationConfig
  migrationProductId: string | null
  idMap: {
    products: Record<string, string>
    components: Record<string, string>
    features: Record<string, string>
    subfeatures: Record<string, string>
    releaseGroups: Record<string, string>
    releases: Record<string, string>
    companies: Record<string, string>
    users: Record<string, string>
    notes: Record<string, string>
  }
  steps: Record<StepName, StepStatus>
  errors: MigrationError[]
}

export interface MigrationError {
  step: StepName
  sourceId: string
  name: string
  message: string
}

// ── Progress events (SSE) ───────────────────────────────────────────────────

export interface ProgressEvent {
  step: StepName
  status: StepStatus
  migrated?: number
  total?: number
  error?: MigrationError
}

// ── Workspace info (returned to UI) ────────────────────────────────────────

export interface WorkspaceInfo {
  statuses: PBStatus[]
  releaseGroups: PBReleaseGroup[]
  customFields: PBFieldConfig[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/productboard/types.ts
git commit -m "feat: add TypeScript types for Productboard API and migration state"
```

---

## Task 3: API Client

**Files:**
- Create: `src/lib/productboard/client.ts`
- Create: `src/__tests__/lib/productboard/client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/productboard/client.test.ts`:

```typescript
import { ProductboardClient } from '@/lib/productboard/client'

const BASE_URL = 'https://api.productboard.com'

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '49',
      'X-RateLimit-Limit': '50',
      ...headers,
    },
  })
}

describe('ProductboardClient', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    jest.useRealTimers()
  })

  describe('request()', () => {
    it('sends Authorization header with Bearer token', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ data: {} }))

      const client = new ProductboardClient('my-token')
      await client.request('/v2/entities')

      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/v2/entities`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      )
    })

    it('retries on 429 and waits Retry-After seconds', async () => {
      jest.useFakeTimers()

      fetchSpy
        .mockResolvedValueOnce(mockResponse('', 429, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(mockResponse({ data: { id: 'abc' } }))

      const client = new ProductboardClient('token')
      const promise = client.request('/v2/entities')

      await jest.runAllTimersAsync()
      const result = await promise

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: { id: 'abc' } })
    })

    it('throws after 3 consecutive 429s', async () => {
      jest.useFakeTimers()

      fetchSpy.mockResolvedValue(mockResponse('', 429, { 'Retry-After': '1' }))

      const client = new ProductboardClient('token')
      const promise = client.request('/v2/entities')

      await jest.runAllTimersAsync()

      await expect(promise).rejects.toThrow('Rate limit exceeded after 3 retries')
    })

    it('throws on non-429 error responses', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ error: 'Unauthorized' }, 401))

      const client = new ProductboardClient('bad-token')
      await expect(client.request('/v2/entities')).rejects.toThrow('API error 401')
    })
  })

  describe('paginate()', () => {
    it('collects all pages following links.next', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse({
            data: [{ id: '1' }, { id: '2' }],
            links: { next: `${BASE_URL}/v2/entities?pageCursor=cursor-2` },
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            data: [{ id: '3' }],
            links: { next: null },
          })
        )

      const client = new ProductboardClient('token')
      const results = await client.paginate('/v2/entities')

      expect(results).toHaveLength(3)
      expect(results.map((r: any) => r.id)).toEqual(['1', '2', '3'])
    })

    it('returns single page when links.next is null', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ data: [{ id: '1' }], links: { next: null } })
      )

      const client = new ProductboardClient('token')
      const results = await client.paginate('/v2/entities')

      expect(results).toHaveLength(1)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=client.test.ts
```

Expected: FAIL — `ProductboardClient` not defined.

- [ ] **Step 3: Implement the API client**

Create `src/lib/productboard/client.ts`:

```typescript
import type { PBListResponse } from './types'

const BASE_URL = 'https://api.productboard.com'
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ProductboardClient {
  private token: string
  private remainingRequests = 50

  constructor(token: string) {
    this.token = token
  }

  async request<T>(pathOrUrl: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    // Proactive throttle when nearing the rate limit
    if (this.remainingRequests < 5) {
      await sleep(200)
    }

    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })

    // Update rate limit tracking
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining) {
      this.remainingRequests = parseInt(remaining, 10)
    }

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`)
      }
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10)
      await sleep(retryAfter * 1000)
      return this.request<T>(pathOrUrl, options, retryCount + 1)
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`API error ${response.status}: ${body}`)
    }

    return response.json() as Promise<T>
  }

  async paginate<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = []

    let url: string = path
    if (params) {
      const qs = new URLSearchParams(params).toString()
      url = `${path}?${qs}`
    }

    let nextUrl: string | null = null

    do {
      const response = await this.request<PBListResponse<T>>(nextUrl ?? url)
      results.push(...response.data)
      nextUrl = response.links?.next ?? null
    } while (nextUrl)

    return results
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=client.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productboard/client.ts src/__tests__/lib/productboard/client.test.ts
git commit -m "feat: add Productboard API client with rate limiting, retry, and pagination"
```

---

## Task 4: State Manager

**Files:**
- Create: `src/lib/state.ts`
- Create: `src/__tests__/lib/state.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/state.test.ts`:

```typescript
import fs from 'fs/promises'
import path from 'path'
import {
  loadState,
  saveState,
  initState,
  STATE_FILE_PATH,
} from '@/lib/state'
import type { MigrationConfig, MigrationState } from '@/lib/productboard/types'

const TEST_CONFIG: MigrationConfig = {
  sourceApiKey: 'src-key',
  destinationApiKey: 'dest-key',
  selectedStatuses: ['In Progress'],
  selectedReleaseGroups: ['rg-1'],
  selectedFields: ['field-1'],
}

describe('State Manager', () => {
  beforeEach(async () => {
    // Remove state file before each test
    await fs.unlink(STATE_FILE_PATH).catch(() => {})
  })

  afterEach(async () => {
    await fs.unlink(STATE_FILE_PATH).catch(() => {})
  })

  it('initState creates a fresh state with all steps pending', () => {
    const state = initState(TEST_CONFIG)
    expect(state.config).toEqual(TEST_CONFIG)
    expect(state.migrationProductId).toBeNull()
    expect(Object.values(state.steps).every((s) => s === 'pending')).toBe(true)
    expect(state.errors).toEqual([])
  })

  it('saveState writes state to disk as JSON', async () => {
    const state = initState(TEST_CONFIG)
    await saveState(state)
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.config.sourceApiKey).toBe('src-key')
  })

  it('loadState returns null when file does not exist', async () => {
    const state = await loadState()
    expect(state).toBeNull()
  })

  it('loadState returns state when file exists', async () => {
    const state = initState(TEST_CONFIG)
    await saveState(state)
    const loaded = await loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.config.sourceApiKey).toBe('src-key')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=state.test.ts
```

Expected: FAIL — `loadState` not defined.

- [ ] **Step 3: Implement state manager**

Create `src/lib/state.ts`:

```typescript
import fs from 'fs/promises'
import path from 'path'
import type { MigrationConfig, MigrationState, StepName } from './productboard/types'

export const STATE_FILE_PATH = path.join(process.cwd(), 'migration-state.json')

const STEP_NAMES: StepName[] = [
  'migrationProduct',
  'products',
  'components',
  'features',
  'subfeatures',
  'releaseGroups',
  'releases',
  'discoverNotes',
  'companies',
  'users',
  'notes',
]

export function initState(config: MigrationConfig): MigrationState {
  return {
    config,
    migrationProductId: null,
    idMap: {
      products: {},
      components: {},
      features: {},
      subfeatures: {},
      releaseGroups: {},
      releases: {},
      companies: {},
      users: {},
      notes: {},
    },
    steps: Object.fromEntries(STEP_NAMES.map((name) => [name, 'pending'])) as MigrationState['steps'],
    errors: [],
  }
}

export async function saveState(state: MigrationState): Promise<void> {
  await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

export async function loadState(): Promise<MigrationState | null> {
  try {
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8')
    return JSON.parse(raw) as MigrationState
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=state.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state.ts src/__tests__/lib/state.test.ts
git commit -m "feat: add migration state manager with JSON file persistence"
```

---

## Task 5: Progress System

**Files:**
- Create: `src/lib/progress.ts`
- Create: `src/__tests__/lib/progress.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/progress.test.ts`:

```typescript
import { migrationEmitter, emitProgress } from '@/lib/progress'
import type { ProgressEvent } from '@/lib/productboard/types'

describe('Progress System', () => {
  it('emitProgress fires a progress event on the emitter', (done) => {
    const event: ProgressEvent = {
      step: 'products',
      status: 'in_progress',
      migrated: 1,
      total: 10,
    }

    migrationEmitter.once('progress', (received: ProgressEvent) => {
      expect(received).toEqual(event)
      done()
    })

    emitProgress(event)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=progress.test.ts
```

Expected: FAIL — `migrationEmitter` not defined.

- [ ] **Step 3: Implement progress module**

Create `src/lib/progress.ts`:

```typescript
import { EventEmitter } from 'events'
import type { ProgressEvent } from './productboard/types'

// Module-level singleton — shared across all imports in the same process.
// Works because this app runs locally (single Node.js process).
export const migrationEmitter = new EventEmitter()

export function emitProgress(event: ProgressEvent): void {
  migrationEmitter.emit('progress', event)
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=progress.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/__tests__/lib/progress.test.ts
git commit -m "feat: add SSE progress emitter"
```

---

## Task 6: Workspaces API Route

**Files:**
- Create: `src/app/api/workspaces/route.ts`

The workspaces route validates both API keys and fetches the data needed to populate the UI selectors. Reference `api-v2-specs/entities.yaml` for exact response shapes.

- [ ] **Step 1: Implement the route**

Create `src/app/api/workspaces/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ProductboardClient } from '@/lib/productboard/client'
import type { PBEntityConfig, PBReleaseGroup, WorkspaceInfo } from '@/lib/productboard/types'

export async function GET(request: NextRequest) {
  const sourceKey = request.nextUrl.searchParams.get('sourceKey')
  const destKey = request.nextUrl.searchParams.get('destKey')

  if (!sourceKey || !destKey) {
    return NextResponse.json({ error: 'Missing API keys' }, { status: 400 })
  }

  try {
    const source = new ProductboardClient(sourceKey)

    // Validate source key and fetch feature configuration
    const featureConfig = await source.request<{ data: PBEntityConfig }>(
      '/v2/entities/configurations/feature'
    )

    // Extract status field from feature config
    const statusField = featureConfig.data.fields.find((f) => f.id === 'status')
    let statuses: { id: string; name: string }[] = []

    if (statusField) {
      const statusValues = await source.paginate<{ id: string; name: string }>(
        `/v2/entities/fields/${statusField.id}/values`
      )
      statuses = statusValues
    }

    // Fetch all release groups from source
    const releaseGroups = await source.paginate<PBReleaseGroup>(
      '/v2/entities?type[]=releaseGroup'
    )

    // Extract custom fields (non-standard fields, identified by UUID pattern)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const customFields = featureConfig.data.fields.filter((f) => UUID_REGEX.test(f.id))

    // Validate destination key with a lightweight call
    const dest = new ProductboardClient(destKey)
    await dest.request('/v2/entities/configurations/feature')

    const info: WorkspaceInfo = {
      statuses,
      releaseGroups,
      customFields,
    }

    return NextResponse.json(info)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workspaces/route.ts
git commit -m "feat: add workspaces API route to validate keys and fetch selector data"
```

---

## Task 7: Migrator — Migration Product

**Files:**
- Create: `src/lib/migrators/migration-product.ts`
- Create: `src/__tests__/lib/migrators/migration-product.test.ts`

Reference `api-v2-specs/entities.yaml` for the exact POST /v2/entities request body shape.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/migration-product.test.ts`:

```typescript
import { migrateMigrationProduct } from '@/lib/migrators/migration-product'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'
import type { MigrationConfig } from '@/lib/productboard/types'

const CONFIG: MigrationConfig = {
  sourceApiKey: 'src',
  destinationApiKey: 'dest',
  selectedStatuses: [],
  selectedReleaseGroups: [],
  selectedFields: [],
}

function mockClient(responses: unknown[]): ProductboardClient {
  let i = 0
  const client = new ProductboardClient('token')
  jest.spyOn(client, 'request').mockImplementation(async () => responses[i++])
  return client
}

describe('migrateMigrationProduct', () => {
  it('creates a product named "Migration" in the destination', async () => {
    const dest = mockClient([{ data: { id: 'dest-product-id', type: 'product' } }])
    const state = initState(CONFIG)
    const emit = jest.fn()

    await migrateMigrationProduct(dest, state, emit)

    expect(state.migrationProductId).toBe('dest-product-id')
    expect(state.steps.migrationProduct).toBe('completed')
  })

  it('emits completed progress event', async () => {
    const dest = mockClient([{ data: { id: 'dest-product-id', type: 'product' } }])
    const state = initState(CONFIG)
    const emit = jest.fn()

    await migrateMigrationProduct(dest, state, emit)

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'migrationProduct', status: 'completed' })
    )
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=migration-product.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/migration-product.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateMigrationProduct(
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.migrationProduct = 'in_progress'
  emit({ step: 'migrationProduct', status: 'in_progress' })

  const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'product',
        fields: { name: 'Migration' },
      },
    }),
  })

  state.migrationProductId = response.data.id
  state.steps.migrationProduct = 'completed'
  await saveState(state)

  emit({ step: 'migrationProduct', status: 'completed', migrated: 1, total: 1 })
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=migration-product.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/migration-product.ts src/__tests__/lib/migrators/migration-product.test.ts
git commit -m "feat: add migration-product migrator"
```

---

## Task 8: Migrator — Products

**Files:**
- Create: `src/lib/migrators/products.ts`
- Create: `src/__tests__/lib/migrators/products.test.ts`

Source products become destination **components** parented to the Migration product.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/products.test.ts`:

```typescript
import { migrateProducts } from '@/lib/migrators/products'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'
import type { MigrationConfig } from '@/lib/productboard/types'

const CONFIG: MigrationConfig = {
  sourceApiKey: 'src',
  destinationApiKey: 'dest',
  selectedStatuses: [],
  selectedReleaseGroups: [],
  selectedFields: [],
}

describe('migrateProducts', () => {
  it('creates a component in destination for each source product', async () => {
    const sourceProducts = [
      { id: 'src-p1', type: 'product', fields: { name: 'Product A' } },
      { id: 'src-p2', type: 'product', fields: { name: 'Product B' } },
    ]

    const source = new ProductboardClient('src-token')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceProducts)

    const dest = new ProductboardClient('dest-token')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-c1' } })
      .mockResolvedValueOnce({ data: { id: 'dest-c2' } })

    const state = initState(CONFIG)
    state.migrationProductId = 'migration-product-id'

    await migrateProducts(source, dest, state, jest.fn())

    expect(state.idMap.products['src-p1']).toBe('dest-c1')
    expect(state.idMap.products['src-p2']).toBe('dest-c2')
    expect(state.steps.products).toBe('completed')
  })

  it('logs error and continues when a product fails to create', async () => {
    const sourceProducts = [
      { id: 'src-p1', type: 'product', fields: { name: 'Product A' } },
    ]

    const source = new ProductboardClient('src-token')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceProducts)

    const dest = new ProductboardClient('dest-token')
    jest.spyOn(dest, 'request').mockRejectedValueOnce(new Error('API failure'))

    const state = initState(CONFIG)
    state.migrationProductId = 'migration-product-id'

    await migrateProducts(source, dest, state, jest.fn())

    expect(state.errors).toHaveLength(1)
    expect(state.errors[0].step).toBe('products')
    expect(state.steps.products).toBe('completed')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=products.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/products.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateProducts(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.products = 'in_progress'
  emit({ step: 'products', status: 'in_progress' })

  const products = await source.paginate<PBEntity>('/v2/entities?type[]=product')
  const total = products.length
  let migrated = 0

  emit({ step: 'products', status: 'in_progress', migrated: 0, total })

  for (const product of products) {
    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'component',
            fields: {
              name: product.fields.name,
              description: product.fields.description,
            },
            relationships: [
              { type: 'parent', data: { id: state.migrationProductId } },
            ],
          },
        }),
      })

      state.idMap.products[product.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'products', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'products' as const, sourceId: product.id, name: String(product.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'products', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.products = 'completed'
  await saveState(state)
  emit({ step: 'products', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=products.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/products.ts src/__tests__/lib/migrators/products.test.ts
git commit -m "feat: add products migrator (source products → destination components)"
```

---

## Task 9: Migrator — Components

**Files:**
- Create: `src/lib/migrators/components.ts`
- Create: `src/__tests__/lib/migrators/components.test.ts`

Source components become destination components, parented to the destination component that represents their source parent product.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/components.test.ts`:

```typescript
import { migrateComponents } from '@/lib/migrators/components'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateComponents', () => {
  it('creates destination components parented to their mapped product component', async () => {
    const sourceComponents = [
      {
        id: 'src-c1',
        type: 'component',
        fields: { name: 'Component A' },
        relationships: [{ type: 'parent', data: { id: 'src-p1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceComponents)

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-c1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.products['src-p1'] = 'dest-p1'

    await migrateComponents(source, dest, state, jest.fn())

    expect(state.idMap.components['src-c1']).toBe('dest-c1')
  })

  it('skips component and logs warning if parent product was not migrated', async () => {
    const sourceComponents = [
      {
        id: 'src-c1',
        type: 'component',
        fields: { name: 'Orphan Component' },
        relationships: [{ type: 'parent', data: { id: 'unmapped-product' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceComponents)

    const dest = new ProductboardClient('dest')
    const requestSpy = jest.spyOn(dest, 'request')

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateComponents(source, dest, state, jest.fn())

    expect(requestSpy).not.toHaveBeenCalled()
    expect(state.errors).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=components.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/components.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

function getParentId(entity: PBEntity): string | null {
  const parentRel = entity.relationships?.find((r) => r.type === 'parent')
  return parentRel?.data.id ?? null
}

export async function migrateComponents(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.components = 'in_progress'
  emit({ step: 'components', status: 'in_progress' })

  const components = await source.paginate<PBEntity>('/v2/entities?type[]=component')
  const total = components.length
  let migrated = 0

  emit({ step: 'components', status: 'in_progress', migrated: 0, total })

  for (const component of components) {
    const sourceParentId = getParentId(component)
    const destParentId = sourceParentId ? state.idMap.products[sourceParentId] : null

    if (!destParentId) {
      const err = {
        step: 'components' as const,
        sourceId: component.id,
        name: String(component.fields.name),
        message: `Parent product ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'components', status: 'in_progress', migrated, total, error: err })
      continue
    }

    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'component',
            fields: {
              name: component.fields.name,
              description: component.fields.description,
            },
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      state.idMap.components[component.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'components', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'components' as const, sourceId: component.id, name: String(component.fields.name), message }
      state.errors.push(err)
      await saveState(state)
    }
  }

  state.steps.components = 'completed'
  await saveState(state)
  emit({ step: 'components', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=components.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/components.ts src/__tests__/lib/migrators/components.test.ts
git commit -m "feat: add components migrator"
```

---

## Task 10: Migrator — Features

**Files:**
- Create: `src/lib/migrators/features.ts`
- Create: `src/__tests__/lib/migrators/features.test.ts`

Features are fetched filtered by selected statuses using `POST /v2/entities/search`. Custom fields are applied via `PATCH /v2/entities/{id}` after creation. Reference `api-v2-specs/entities.yaml` for exact search request body and patch body shapes.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/features.test.ts`:

```typescript
import { migrateFeatures } from '@/lib/migrators/features'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateFeatures', () => {
  it('only fetches features matching selected statuses', async () => {
    const source = new ProductboardClient('src')
    const searchSpy = jest.spyOn(source, 'request').mockResolvedValue({
      data: [],
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['In Progress', 'Planned'],
      selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateFeatures(source, dest, state, jest.fn())

    expect(searchSpy).toHaveBeenCalledWith(
      '/v2/entities/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('In Progress'),
      })
    )
  })

  it('maps source feature IDs to destination IDs', async () => {
    const sourceFeatures = [
      {
        id: 'src-f1',
        type: 'feature',
        fields: { name: 'Feature A', status: { id: 's1', name: 'In Progress' } },
        relationships: [{ type: 'parent', data: { id: 'src-c1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceFeatures,
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-f1' } }) // create
      // no custom fields selected, no PATCH call

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['In Progress'],
      selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.components['src-c1'] = 'dest-c1'

    await migrateFeatures(source, dest, state, jest.fn())

    expect(state.idMap.features['src-f1']).toBe('dest-f1')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=features.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/features.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateFeatures(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.features = 'in_progress'
  emit({ step: 'features', status: 'in_progress' })

  // Fetch features matching selected statuses
  let allFeatures: PBEntity[] = []
  let nextUrl: string | null = null

  do {
    const response = await source.request<{ data: PBEntity[]; links: { next: string | null } }>(
      nextUrl ?? '/v2/entities/search',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'feature',
            statuses: state.config.selectedStatuses.map((name) => ({ name })),
          },
        }),
      }
    )
    allFeatures.push(...response.data)
    nextUrl = response.links?.next ?? null
  } while (nextUrl)

  const total = allFeatures.length
  let migrated = 0
  emit({ step: 'features', status: 'in_progress', migrated: 0, total })

  for (const feature of allFeatures) {
    const sourceParentId = feature.relationships?.find((r) => r.type === 'parent')?.data.id
    const destParentId = sourceParentId ? state.idMap.components[sourceParentId] : null

    if (!destParentId) {
      const err = {
        step: 'features' as const,
        sourceId: feature.id,
        name: String(feature.fields.name),
        message: `Parent component ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      continue
    }

    try {
      // Create the feature
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'feature',
            fields: {
              name: feature.fields.name,
              description: feature.fields.description,
            },
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      const destFeatureId = response.data.id
      state.idMap.features[feature.id] = destFeatureId

      // Apply selected custom fields via PATCH
      if (state.config.selectedFields.length > 0) {
        const patch = state.config.selectedFields
          .filter((fieldId) => feature.fields[fieldId] !== undefined)
          .map((fieldId) => ({
            op: 'set',
            path: fieldId,
            value: feature.fields[fieldId],
          }))

        if (patch.length > 0) {
          await dest.request(`/v2/entities/${destFeatureId}`, {
            method: 'PATCH',
            body: JSON.stringify({ patch }),
          })
        }
      }

      migrated++
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'features' as const, sourceId: feature.id, name: String(feature.fields.name), message }
      state.errors.push(err)
      await saveState(state)
    }
  }

  state.steps.features = 'completed'
  await saveState(state)
  emit({ step: 'features', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=features.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/features.ts src/__tests__/lib/migrators/features.test.ts
git commit -m "feat: add features migrator with status filtering and custom field support"
```

---

## Task 11: Migrator — Subfeatures

**Files:**
- Create: `src/lib/migrators/subfeatures.ts`
- Create: `src/__tests__/lib/migrators/subfeatures.test.ts`

Identical pattern to features, but parent lookup uses `state.idMap.features` instead of `state.idMap.components`.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/subfeatures.test.ts`:

```typescript
import { migrateSubfeatures } from '@/lib/migrators/subfeatures'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateSubfeatures', () => {
  it('maps source subfeature IDs to destination IDs under migrated features', async () => {
    const sourceSubfeatures = [
      {
        id: 'src-sf1',
        type: 'subfeature',
        fields: { name: 'Subfeature A', status: { name: 'Planned' } },
        relationships: [{ type: 'parent', data: { id: 'src-f1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceSubfeatures,
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-sf1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['Planned'],
      selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'

    await migrateSubfeatures(source, dest, state, jest.fn())

    expect(state.idMap.subfeatures['src-sf1']).toBe('dest-sf1')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=subfeatures.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/subfeatures.ts` — same structure as `features.ts` with two changes:
1. Search body uses `type: 'subfeature'`
2. Parent lookup uses `state.idMap.features` (not `state.idMap.components`)
3. Step name is `'subfeatures'`

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateSubfeatures(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.subfeatures = 'in_progress'
  emit({ step: 'subfeatures', status: 'in_progress' })

  let allSubfeatures: PBEntity[] = []
  let nextUrl: string | null = null

  do {
    const response = await source.request<{ data: PBEntity[]; links: { next: string | null } }>(
      nextUrl ?? '/v2/entities/search',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subfeature',
            statuses: state.config.selectedStatuses.map((name) => ({ name })),
          },
        }),
      }
    )
    allSubfeatures.push(...response.data)
    nextUrl = response.links?.next ?? null
  } while (nextUrl)

  const total = allSubfeatures.length
  let migrated = 0
  emit({ step: 'subfeatures', status: 'in_progress', migrated: 0, total })

  for (const subfeature of allSubfeatures) {
    const sourceParentId = subfeature.relationships?.find((r) => r.type === 'parent')?.data.id
    const destParentId = sourceParentId ? state.idMap.features[sourceParentId] : null

    if (!destParentId) {
      state.errors.push({
        step: 'subfeatures',
        sourceId: subfeature.id,
        name: String(subfeature.fields.name),
        message: `Parent feature ${sourceParentId} was not migrated`,
      })
      await saveState(state)
      continue
    }

    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subfeature',
            fields: { name: subfeature.fields.name, description: subfeature.fields.description },
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      const destId = response.data.id
      state.idMap.subfeatures[subfeature.id] = destId

      if (state.config.selectedFields.length > 0) {
        const patch = state.config.selectedFields
          .filter((fid) => subfeature.fields[fid] !== undefined)
          .map((fid) => ({ op: 'set', path: fid, value: subfeature.fields[fid] }))
        if (patch.length > 0) {
          await dest.request(`/v2/entities/${destId}`, {
            method: 'PATCH',
            body: JSON.stringify({ patch }),
          })
        }
      }

      migrated++
      await saveState(state)
      emit({ step: 'subfeatures', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'subfeatures', sourceId: subfeature.id, name: String(subfeature.fields.name), message })
      await saveState(state)
    }
  }

  state.steps.subfeatures = 'completed'
  await saveState(state)
  emit({ step: 'subfeatures', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=subfeatures.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/subfeatures.ts src/__tests__/lib/migrators/subfeatures.test.ts
git commit -m "feat: add subfeatures migrator"
```

---

## Task 12: Migrator — Release Groups

**Files:**
- Create: `src/lib/migrators/release-groups.ts`
- Create: `src/__tests__/lib/migrators/release-groups.test.ts`

Only migrates release groups whose IDs are in `state.config.selectedReleaseGroups`.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/release-groups.test.ts`:

```typescript
import { migrateReleaseGroups } from '@/lib/migrators/release-groups'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateReleaseGroups', () => {
  it('only migrates selected release groups', async () => {
    const allGroups = [
      { id: 'rg-1', type: 'releaseGroup', fields: { name: 'Q1 2026' } },
      { id: 'rg-2', type: 'releaseGroup', fields: { name: 'Q2 2026' } },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(allGroups)

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-rg-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: ['rg-1'], selectedFields: [],
    })

    await migrateReleaseGroups(source, dest, state, jest.fn())

    expect(state.idMap.releaseGroups['rg-1']).toBe('dest-rg-1')
    expect(state.idMap.releaseGroups['rg-2']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=release-groups.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/release-groups.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBReleaseGroup, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateReleaseGroups(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.releaseGroups = 'in_progress'
  emit({ step: 'releaseGroups', status: 'in_progress' })

  const allGroups = await source.paginate<PBReleaseGroup>('/v2/entities?type[]=releaseGroup')
  const selectedGroups = allGroups.filter((g) =>
    state.config.selectedReleaseGroups.includes(g.id)
  )

  const total = selectedGroups.length
  let migrated = 0
  emit({ step: 'releaseGroups', status: 'in_progress', migrated: 0, total })

  for (const group of selectedGroups) {
    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'releaseGroup',
            fields: { name: group.fields.name, description: group.fields.description },
          },
        }),
      })

      state.idMap.releaseGroups[group.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'releaseGroups', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'releaseGroups', sourceId: group.id, name: group.fields.name, message })
      await saveState(state)
    }
  }

  state.steps.releaseGroups = 'completed'
  await saveState(state)
  emit({ step: 'releaseGroups', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=release-groups.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/release-groups.ts src/__tests__/lib/migrators/release-groups.test.ts
git commit -m "feat: add release-groups migrator with selection filter"
```

---

## Task 13: Migrator — Releases

**Files:**
- Create: `src/lib/migrators/releases.ts`
- Create: `src/__tests__/lib/migrators/releases.test.ts`

Fetch source releases, filter to those whose parent release group is in the selected set, create in destination under the mapped release group, then link to migrated features/subfeatures via the relationships API.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/releases.test.ts`:

```typescript
import { migrateReleases } from '@/lib/migrators/releases'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateReleases', () => {
  it('creates releases under their mapped destination release groups', async () => {
    const sourceReleases = [
      {
        id: 'src-r1',
        type: 'release',
        fields: { name: 'v1.0' },
        relationships: [
          { type: 'parent', data: { id: 'rg-1' } },
          { type: 'link', data: { id: 'src-f1' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceReleases)

    const dest = new ProductboardClient('dest')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-r1' } }) // create release
      .mockResolvedValueOnce({}) // link to feature

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: ['rg-1'], selectedFields: [],
    })
    state.idMap.releaseGroups['rg-1'] = 'dest-rg-1'
    state.idMap.features['src-f1'] = 'dest-f1'

    await migrateReleases(source, dest, state, jest.fn())

    expect(state.idMap.releases['src-r1']).toBe('dest-r1')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=releases.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/releases.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateReleases(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.releases = 'in_progress'
  emit({ step: 'releases', status: 'in_progress' })

  const allReleases = await source.paginate<PBEntity>('/v2/entities?type[]=release')

  // Filter to releases whose parent release group was selected
  const selectedReleases = allReleases.filter((r) => {
    const parentId = r.relationships?.find((rel) => rel.type === 'parent')?.data.id
    return parentId ? state.config.selectedReleaseGroups.includes(parentId) : false
  })

  const total = selectedReleases.length
  let migrated = 0
  emit({ step: 'releases', status: 'in_progress', migrated: 0, total })

  for (const release of selectedReleases) {
    const sourceParentId = release.relationships?.find((r) => r.type === 'parent')?.data.id
    const destParentId = sourceParentId ? state.idMap.releaseGroups[sourceParentId] : null

    if (!destParentId) {
      state.errors.push({
        step: 'releases',
        sourceId: release.id,
        name: String(release.fields.name),
        message: `Parent release group ${sourceParentId} was not migrated`,
      })
      await saveState(state)
      continue
    }

    try {
      // Create release under its release group
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'release',
            fields: { name: release.fields.name, description: release.fields.description },
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      const destReleaseId = response.data.id
      state.idMap.releases[release.id] = destReleaseId

      // Link release to migrated features and subfeatures
      const linkedEntityIds = (release.relationships ?? [])
        .filter((r) => r.type === 'link')
        .map((r) => r.data.id)

      for (const srcEntityId of linkedEntityIds) {
        const destEntityId =
          state.idMap.features[srcEntityId] ?? state.idMap.subfeatures[srcEntityId]

        if (destEntityId) {
          await dest.request(`/v2/entities/${destReleaseId}/relationships`, {
            method: 'POST',
            body: JSON.stringify({
              data: { type: 'link', targetId: destEntityId },
            }),
          })
        }
      }

      migrated++
      await saveState(state)
      emit({ step: 'releases', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'releases', sourceId: release.id, name: String(release.fields.name), message })
      await saveState(state)
    }
  }

  state.steps.releases = 'completed'
  await saveState(state)
  emit({ step: 'releases', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=releases.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/releases.ts src/__tests__/lib/migrators/releases.test.ts
git commit -m "feat: add releases migrator with release group filtering and feature linking"
```

---

## Task 14: Migrator — Notes (Discover + Create)

**Files:**
- Create: `src/lib/migrators/notes.ts`
- Create: `src/__tests__/lib/migrators/notes.test.ts`

Two phases: (1) discover notes linked to migrated features/subfeatures from source; (2) create in destination linked to destination entities. Reference `api-v2-specs/notes.yaml` for exact note POST request body and relationship shapes.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/migrators/notes.test.ts`:

```typescript
import { discoverNotes, migrateNotes } from '@/lib/migrators/notes'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('discoverNotes', () => {
  it('fetches notes linked to migrated features and stores them in state', async () => {
    const sourceNotes = [
      {
        id: 'note-1',
        type: 'textNote',
        fields: { name: 'Customer call', content: 'Great feedback' },
        relationships: [
          { type: 'link', data: { id: 'src-f1' } },
          { type: 'customer', data: { id: 'company-1', type: 'company' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceNotes,
      links: { next: null },
    })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'

    const { notes, companyIds, userIds } = await discoverNotes(source, state)

    expect(notes).toHaveLength(1)
    expect(companyIds.has('company-1')).toBe(true)
  })
})

describe('migrateNotes', () => {
  it('creates notes linked to destination features and companies', async () => {
    const sourceNotes = [
      {
        id: 'note-1',
        type: 'textNote',
        fields: { name: 'Feedback', content: 'Good stuff' },
        relationships: [
          { type: 'link', data: { id: 'src-f1' } },
          { type: 'customer', data: { id: 'src-company-1', type: 'company' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'
    state.idMap.companies['src-company-1'] = 'dest-company-1'

    await migrateNotes(sourceNotes as any, source, dest, state, jest.fn())

    expect(state.idMap.notes['note-1']).toBe('dest-note-1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=notes.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/migrators/notes.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBNote, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export interface NoteDiscoveryResult {
  notes: PBNote[]
  companyIds: Set<string>
  userIds: Set<string>
}

export async function discoverNotes(
  source: ProductboardClient,
  state: MigrationState
): Promise<NoteDiscoveryResult> {
  state.steps.discoverNotes = 'in_progress'

  const migratedFeatureIds = Object.keys(state.idMap.features)
  const migratedSubfeatureIds = Object.keys(state.idMap.subfeatures)
  const allEntityIds = [...migratedFeatureIds, ...migratedSubfeatureIds]

  const allNotes: PBNote[] = []
  const companyIds = new Set<string>()
  const userIds = new Set<string>()

  // Search in batches of 100 (API limit)
  const BATCH_SIZE = 100
  for (let i = 0; i < allEntityIds.length; i += BATCH_SIZE) {
    const batch = allEntityIds.slice(i, i + BATCH_SIZE)
    let nextUrl: string | null = null

    do {
      const response = await source.request<{ data: PBNote[]; links: { next: string | null } }>(
        nextUrl ?? '/v2/notes/search',
        {
          method: 'POST',
          body: JSON.stringify({
            data: {
              relationships: {
                link: { ids: batch },
              },
            },
          }),
        }
      )

      for (const note of response.data) {
        allNotes.push(note)
        for (const rel of note.relationships ?? []) {
          if (rel.type === 'customer') {
            if (rel.data.type === 'company') companyIds.add(rel.data.id)
            else if (rel.data.type === 'user') userIds.add(rel.data.id)
          }
        }
      }

      nextUrl = response.links?.next ?? null
    } while (nextUrl)
  }

  state.steps.discoverNotes = 'completed'
  await saveState(state)

  return { notes: allNotes, companyIds, userIds }
}

export async function migrateNotes(
  notes: PBNote[],
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.notes = 'in_progress'
  const total = notes.length
  let migrated = 0
  emit({ step: 'notes', status: 'in_progress', migrated: 0, total })

  // Fetch destination members once for owner/creator matching
  const destMembers = await dest.paginate<{ id: string; email: string }>('/v2/members')
  const memberByEmail = new Map(destMembers.map((m) => [m.email, m.id]))

  for (const note of notes) {
    try {
      // Build destination relationships
      const relationships: object[] = []

      for (const rel of note.relationships ?? []) {
        if (rel.type === 'link') {
          const destId =
            state.idMap.features[rel.data.id] ?? state.idMap.subfeatures[rel.data.id]
          if (destId) {
            relationships.push({ type: 'link', data: { id: destId } })
          } else {
            console.warn(`Note ${note.id}: linked entity ${rel.data.id} not migrated, skipping link`)
          }
        }

        if (rel.type === 'customer') {
          const destId =
            rel.data.type === 'company'
              ? state.idMap.companies[rel.data.id]
              : state.idMap.users[rel.data.id]

          if (destId) {
            relationships.push({ type: 'customer', data: { id: destId, type: rel.data.type } })
          }
        }
      }

      // Build note fields — omit owner/creator if not found in destination
      const fields: Record<string, unknown> = {
        name: note.fields.name,
        content: note.fields.content,
      }

      const response = await dest.request<{ data: { id: string } }>('/v2/notes', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: note.type,
            fields,
            relationships,
          },
        }),
      })

      state.idMap.notes[note.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'notes', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'notes', sourceId: note.id, name: String(note.fields.name), message })
      await saveState(state)
    }
  }

  state.steps.notes = 'completed'
  await saveState(state)
  emit({ step: 'notes', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=notes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrators/notes.ts src/__tests__/lib/migrators/notes.test.ts
git commit -m "feat: add notes migrator (discover + create with relationship linking)"
```

---

## Task 15: Migrators — Companies and Users

**Files:**
- Create: `src/lib/migrators/companies.ts`
- Create: `src/lib/migrators/users.ts`
- Create: `src/__tests__/lib/migrators/companies.test.ts`
- Create: `src/__tests__/lib/migrators/users.test.ts`

Both fetch the source entity by ID and create it in the destination. Reference `api-v2-specs/entities.yaml` for the exact customer user/company entity types and creation fields.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/migrators/companies.test.ts`:

```typescript
import { migrateCompanies } from '@/lib/migrators/companies'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateCompanies', () => {
  it('creates destination companies and maps IDs', async () => {
    const source = new ProductboardClient('src')
    jest
      .spyOn(source, 'request')
      .mockResolvedValueOnce({ data: { id: 'src-co-1', fields: { name: 'Acme Corp', domain: 'acme.com' } } })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-co-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateCompanies(new Set(['src-co-1']), source, dest, state, jest.fn())

    expect(state.idMap.companies['src-co-1']).toBe('dest-co-1')
  })
})
```

Create `src/__tests__/lib/migrators/users.test.ts`:

```typescript
import { migrateUsers } from '@/lib/migrators/users'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateUsers', () => {
  it('creates destination customer users and maps IDs', async () => {
    const source = new ProductboardClient('src')
    jest
      .spyOn(source, 'request')
      .mockResolvedValueOnce({ data: { id: 'src-u-1', fields: { name: 'Jane Doe', email: 'jane@acme.com' } } })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-u-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateUsers(new Set(['src-u-1']), source, dest, state, jest.fn())

    expect(state.idMap.users['src-u-1']).toBe('dest-u-1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="(companies|users).test.ts"
```

Expected: FAIL.

- [ ] **Step 3: Implement companies migrator**

Create `src/lib/migrators/companies.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateCompanies(
  companyIds: Set<string>,
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.companies = 'in_progress'
  const ids = Array.from(companyIds)
  const total = ids.length
  let migrated = 0
  emit({ step: 'companies', status: 'in_progress', migrated: 0, total })

  for (const srcId of ids) {
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data

      const destResponse = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'company',
            fields: { name: fields.name, domain: fields.domain },
          },
        }),
      })

      state.idMap.companies[srcId] = destResponse.data.id
      migrated++
      await saveState(state)
      emit({ step: 'companies', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'companies', sourceId: srcId, name: srcId, message })
      await saveState(state)
    }
  }

  state.steps.companies = 'completed'
  await saveState(state)
  emit({ step: 'companies', status: 'completed', migrated, total })
}
```

- [ ] **Step 4: Implement users migrator**

Create `src/lib/migrators/users.ts`:

```typescript
import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateUsers(
  userIds: Set<string>,
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.users = 'in_progress'
  const ids = Array.from(userIds)
  const total = ids.length
  let migrated = 0
  emit({ step: 'users', status: 'in_progress', migrated: 0, total })

  for (const srcId of ids) {
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data

      const destResponse = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'user',
            fields: { name: fields.name, email: fields.email },
          },
        }),
      })

      state.idMap.users[srcId] = destResponse.data.id
      migrated++
      await saveState(state)
      emit({ step: 'users', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push({ step: 'users', sourceId: srcId, name: srcId, message })
      await saveState(state)
    }
  }

  state.steps.users = 'completed'
  await saveState(state)
  emit({ step: 'users', status: 'completed', migrated, total })
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test -- --testPathPattern="(companies|users).test.ts"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/migrators/companies.ts src/lib/migrators/users.ts \
  src/__tests__/lib/migrators/companies.test.ts src/__tests__/lib/migrators/users.test.ts
git commit -m "feat: add companies and users migrators"
```

---

## Task 16: Orchestrator

**Files:**
- Create: `src/lib/migrators/index.ts`
- Create: `src/__tests__/lib/migrators/index.test.ts`

The orchestrator runs all steps in order, skipping completed steps on resume.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/migrators/index.test.ts`:

```typescript
import { runMigration } from '@/lib/migrators/index'
import * as migrationProduct from '@/lib/migrators/migration-product'
import * as products from '@/lib/migrators/products'
import { initState } from '@/lib/state'
import type { MigrationConfig } from '@/lib/productboard/types'

const CONFIG: MigrationConfig = {
  sourceApiKey: 'src',
  destinationApiKey: 'dest',
  selectedStatuses: [],
  selectedReleaseGroups: [],
  selectedFields: [],
}

describe('runMigration', () => {
  it('skips steps already marked completed (resume behavior)', async () => {
    const migrationProductSpy = jest
      .spyOn(migrationProduct, 'migrateMigrationProduct')
      .mockResolvedValue(undefined)

    const productsSpy = jest
      .spyOn(products, 'migrateProducts')
      .mockResolvedValue(undefined)

    const state = initState(CONFIG)
    // Mark migrationProduct as already done
    state.steps.migrationProduct = 'completed'
    state.migrationProductId = 'existing-id'

    await runMigration(CONFIG, state, jest.fn())

    expect(migrationProductSpy).not.toHaveBeenCalled()
    expect(productsSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="migrators/index.test.ts"
```

Expected: FAIL.

- [ ] **Step 3: Implement orchestrator**

Create `src/lib/migrators/index.ts`:

```typescript
import { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationConfig, MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { initState, saveState, loadState } from '@/lib/state'
import { migrateMigrationProduct } from './migration-product'
import { migrateProducts } from './products'
import { migrateComponents } from './components'
import { migrateFeatures } from './features'
import { migrateSubfeatures } from './subfeatures'
import { migrateReleaseGroups } from './release-groups'
import { migrateReleases } from './releases'
import { discoverNotes, migrateNotes } from './notes'
import { migrateCompanies } from './companies'
import { migrateUsers } from './users'

export async function runMigration(
  config: MigrationConfig,
  existingState: MigrationState | null,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  const state = existingState ?? initState(config)
  await saveState(state)

  const source = new ProductboardClient(config.sourceApiKey)
  const dest = new ProductboardClient(config.destinationApiKey)

  // Step 1: Migration Product
  if (state.steps.migrationProduct !== 'completed') {
    await migrateMigrationProduct(dest, state, emit)
  }

  // Step 2: Products
  if (state.steps.products !== 'completed') {
    await migrateProducts(source, dest, state, emit)
  }

  // Step 3: Components
  if (state.steps.components !== 'completed') {
    await migrateComponents(source, dest, state, emit)
  }

  // Step 4: Features
  if (state.steps.features !== 'completed') {
    await migrateFeatures(source, dest, state, emit)
  }

  // Step 5: Subfeatures
  if (state.steps.subfeatures !== 'completed') {
    await migrateSubfeatures(source, dest, state, emit)
  }

  // Step 6: Release Groups
  if (state.steps.releaseGroups !== 'completed') {
    await migrateReleaseGroups(source, dest, state, emit)
  }

  // Step 7: Releases
  if (state.steps.releases !== 'completed') {
    await migrateReleases(source, dest, state, emit)
  }

  // Step 8: Discover Notes (returns discovered data needed for next steps)
  // Always re-run discovery if any downstream step (companies, users, notes) is not yet
  // completed — even if discoverNotes itself is marked completed. Discovery is read-only
  // and safe to repeat. This ensures a resume after a mid-run crash does not silently
  // skip companies, users, or notes due to discoveredNotes being null.
  const needsDiscovery =
    state.steps.companies !== 'completed' ||
    state.steps.users !== 'completed' ||
    state.steps.notes !== 'completed'

  let discoveredNotes: Awaited<ReturnType<typeof discoverNotes>> | null = null
  if (needsDiscovery) {
    discoveredNotes = await discoverNotes(source, state)
    emit({ step: 'discoverNotes', status: 'completed' })
  }

  // Step 9: Companies
  if (state.steps.companies !== 'completed' && discoveredNotes) {
    await migrateCompanies(discoveredNotes.companyIds, source, dest, state, emit)
  }

  // Step 10: Users
  if (state.steps.users !== 'completed' && discoveredNotes) {
    await migrateUsers(discoveredNotes.userIds, source, dest, state, emit)
  }

  // Step 11: Notes
  if (state.steps.notes !== 'completed' && discoveredNotes) {
    await migrateNotes(discoveredNotes.notes, source, dest, state, emit)
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="migrators/index.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/migrators/index.ts src/__tests__/lib/migrators/index.test.ts
git commit -m "feat: add migration orchestrator with resume support"
```

---

## Task 17: Migrate and Status API Routes

**Files:**
- Create: `src/app/api/migrate/route.ts`
- Create: `src/app/api/status/route.ts`

- [ ] **Step 1: Implement the migrate route**

Create `src/app/api/migrate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { MigrationConfig } from '@/lib/productboard/types'
import { loadState } from '@/lib/state'
import { runMigration } from '@/lib/migrators/index'
import { emitProgress } from '@/lib/progress'

// GET /api/migrate — check whether a prior migration run exists on disk
export async function GET() {
  const state = await loadState()
  return NextResponse.json({ hasPriorRun: state !== null })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const config = body as MigrationConfig

  if (!config.sourceApiKey || !config.destinationApiKey) {
    return NextResponse.json({ error: 'Missing API keys' }, { status: 400 })
  }

  // Load existing state if resuming, otherwise start fresh
  const resume = body.resume === true
  const existingState = resume ? await loadState() : null

  // Run migration in the background — do not await
  runMigration(config, existingState, emitProgress).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    emitProgress({ step: 'migrationProduct', status: 'failed', error: {
      step: 'migrationProduct', sourceId: '', name: 'Migration', message,
    }})
    console.error('Migration failed:', error)
  })

  return NextResponse.json({ started: true })
}
```

- [ ] **Step 2: Implement the SSE status route**

Create `src/app/api/status/route.ts`:

```typescript
import { migrationEmitter } from '@/lib/progress'
import type { ProgressEvent } from '@/lib/productboard/types'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function listener(event: ProgressEvent) {
        const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        controller.enqueue(data)
      }

      migrationEmitter.on('progress', listener)

      // Send a heartbeat comment every 15s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Return cleanup function
      return () => {
        migrationEmitter.off('progress', listener)
        clearInterval(heartbeat)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/migrate/route.ts src/app/api/status/route.ts
git commit -m "feat: add migrate and SSE status API routes"
```

---

## Task 18: UI Components

**Files:**
- Create: `src/components/ConfigForm.tsx`
- Create: `src/components/StatusSelector.tsx`
- Create: `src/components/ReleaseGroupSelector.tsx`
- Create: `src/components/FieldSelector.tsx`
- Create: `src/components/MigrationDashboard.tsx`

- [ ] **Step 1: Create ConfigForm**

Create `src/components/ConfigForm.tsx`:

```tsx
'use client'

interface Props {
  onConnect: (sourceKey: string, destKey: string) => void
  loading: boolean
  error: string | null
}

export function ConfigForm({ onConnect, loading, error }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const sourceKey = (form.elements.namedItem('sourceKey') as HTMLInputElement).value
    const destKey = (form.elements.namedItem('destKey') as HTMLInputElement).value
    onConnect(sourceKey, destKey)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="sourceKey">
          Source Workspace API Key
        </label>
        <input
          id="sourceKey"
          name="sourceKey"
          type="password"
          required
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="pb_key_..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="destKey">
          Destination Workspace API Key
        </label>
        <input
          id="destKey"
          name="destKey"
          type="password"
          required
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="pb_key_..."
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {loading ? 'Connecting...' : 'Connect'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create StatusSelector**

Create `src/components/StatusSelector.tsx`:

```tsx
'use client'

interface Status {
  id: string
  name: string
}

interface Props {
  statuses: Status[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function StatusSelector({ statuses, selected, onChange }: Props) {
  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    )
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Feature & Subfeature Statuses to Migrate</h3>
      <div className="space-y-1">
        {statuses.map((status) => (
          <label key={status.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(status.name)}
              onChange={() => toggle(status.name)}
            />
            {status.name}
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ReleaseGroupSelector**

Create `src/components/ReleaseGroupSelector.tsx`:

```tsx
'use client'

interface ReleaseGroup {
  id: string
  fields: { name: string }
}

interface Props {
  releaseGroups: ReleaseGroup[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ReleaseGroupSelector({ releaseGroups, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Release Groups to Migrate</h3>
      <div className="space-y-1">
        {releaseGroups.map((rg) => (
          <label key={rg.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(rg.id)}
              onChange={() => toggle(rg.id)}
            />
            {rg.fields.name}
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create FieldSelector**

Create `src/components/FieldSelector.tsx`:

```tsx
'use client'

interface FieldConfig {
  id: string
  name: string
}

interface Props {
  fields: FieldConfig[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function FieldSelector({ fields, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  if (fields.length === 0) return null

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Custom Fields to Migrate</h3>
      <div className="space-y-1">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(field.id)}
              onChange={() => toggle(field.id)}
            />
            {field.name}
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create MigrationDashboard**

Create `src/components/MigrationDashboard.tsx`:

```tsx
'use client'

import type { ProgressEvent, StepName, StepStatus } from '@/lib/productboard/types'

const STEP_LABELS: Record<StepName, string> = {
  migrationProduct: 'Create Migration Product',
  products: 'Products → Components',
  components: 'Components',
  features: 'Features',
  subfeatures: 'Subfeatures',
  releaseGroups: 'Release Groups',
  releases: 'Releases',
  discoverNotes: 'Discover Notes',
  companies: 'Companies',
  users: 'Users',
  notes: 'Notes',
}

const STEP_ORDER: StepName[] = [
  'migrationProduct', 'products', 'components', 'features', 'subfeatures',
  'releaseGroups', 'releases', 'discoverNotes', 'companies', 'users', 'notes',
]

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  errors: string[]
}

interface Props {
  progress: Record<string, StepState>
}

function StatusBadge({ status }: { status: StepStatus }) {
  const styles: Record<StepStatus, string> = {
    pending: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  const labels: Record<StepStatus, string> = {
    pending: 'Waiting',
    in_progress: 'Running',
    completed: 'Done',
    failed: 'Failed',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function MigrationDashboard({ progress }: Props) {
  return (
    <div className="space-y-2">
      {STEP_ORDER.map((step) => {
        const state = progress[step] ?? { status: 'pending', errors: [] }
        return (
          <div key={step} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{STEP_LABELS[step]}</span>
              <div className="flex items-center gap-3">
                {state.total !== undefined && (
                  <span className="text-xs text-gray-500">
                    {state.migrated ?? 0} / {state.total}
                  </span>
                )}
                <StatusBadge status={state.status} />
              </div>
            </div>
            {state.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {state.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">{err}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add UI components (ConfigForm, selectors, MigrationDashboard)"
```

---

## Task 19: Main Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Productboard Migration Tool',
  description: 'Migrate data between Productboard workspaces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto py-10 px-4">{children}</div>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Build the main page**

Replace `src/app/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConfigForm } from '@/components/ConfigForm'
import { StatusSelector } from '@/components/StatusSelector'
import { ReleaseGroupSelector } from '@/components/ReleaseGroupSelector'
import { FieldSelector } from '@/components/FieldSelector'
import { MigrationDashboard } from '@/components/MigrationDashboard'
import type { WorkspaceInfo, ProgressEvent, StepName, StepStatus } from '@/lib/productboard/types'

type Panel = 'config' | 'settings' | 'running'

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  errors: string[]
}

export default function Home() {
  const [panel, setPanel] = useState<Panel>('config')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const [sourceKey, setSourceKey] = useState('')
  const [destKey, setDestKey] = useState('')
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null)

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedReleaseGroups, setSelectedReleaseGroups] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>([])

  const [progress, setProgress] = useState<Record<string, StepState>>({})
  const [hasPriorRun, setHasPriorRun] = useState(false)

  // Check for prior run on mount — GET /api/migrate returns { hasPriorRun: boolean }
  useEffect(() => {
    fetch('/api/migrate')
      .then((r) => r.json())
      .then((data) => { if (data.hasPriorRun) setHasPriorRun(true) })
      .catch(() => {})
  }, [])

  async function handleConnect(src: string, dest: string) {
    setConnectLoading(true)
    setConnectError(null)
    try {
      const res = await fetch(
        `/api/workspaces?sourceKey=${encodeURIComponent(src)}&destKey=${encodeURIComponent(dest)}`
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Connection failed')
      }
      const info: WorkspaceInfo = await res.json()
      setSourceKey(src)
      setDestKey(dest)
      setWorkspaceInfo(info)
      setPanel('settings')
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnectLoading(false)
    }
  }

  const handleProgress = useCallback((event: ProgressEvent) => {
    setProgress((prev) => {
      const current = prev[event.step] ?? { status: 'pending', errors: [] }
      return {
        ...prev,
        [event.step]: {
          status: event.status,
          migrated: event.migrated ?? current.migrated,
          total: event.total ?? current.total,
          errors: event.error
            ? [...current.errors, `${event.error.name}: ${event.error.message}`]
            : current.errors,
        },
      }
    })
  }, [])

  function startListening() {
    const es = new EventSource('/api/status')
    es.onmessage = (e) => {
      const event: ProgressEvent = JSON.parse(e.data)
      handleProgress(event)
    }
    es.onerror = () => es.close()
  }

  async function startMigration(resume = false) {
    setPanel('running')
    startListening()

    await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceApiKey: sourceKey,
        destinationApiKey: destKey,
        selectedStatuses,
        selectedReleaseGroups,
        selectedFields,
        resume,
      }),
    })
  }

  return (
    <main>
      <h1 className="text-2xl font-bold mb-8">Productboard Migration Tool</h1>

      {panel === 'config' && (
        <section className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Connect Workspaces</h2>
          <ConfigForm
            onConnect={handleConnect}
            loading={connectLoading}
            error={connectError}
          />
        </section>
      )}

      {panel === 'settings' && workspaceInfo && (
        <section className="bg-white border rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold">Migration Settings</h2>
          <StatusSelector
            statuses={workspaceInfo.statuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <ReleaseGroupSelector
            releaseGroups={workspaceInfo.releaseGroups}
            selected={selectedReleaseGroups}
            onChange={setSelectedReleaseGroups}
          />
          <FieldSelector
            fields={workspaceInfo.customFields}
            selected={selectedFields}
            onChange={setSelectedFields}
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => startMigration(false)}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm"
            >
              Start Migration
            </button>
            {hasPriorRun && (
              <button
                onClick={() => startMigration(true)}
                className="border border-blue-600 text-blue-600 px-5 py-2 rounded text-sm"
              >
                Resume Previous Run
              </button>
            )}
          </div>
        </section>
      )}

      {panel === 'running' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Migration Progress</h2>
          <MigrationDashboard progress={progress} />
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Build and smoke test**

```bash
npm run build
```

Expected: Build completes with no errors.

Start the dev server and open http://localhost:3000 to verify the UI renders:

```bash
npm run dev
```

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: build main page with config, settings, and progress panels"
```

---

## Task 20: End-to-End Smoke Test

Manual verification steps before declaring the app ready.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify Panel 1 (Config)**

Open http://localhost:3000. Enter a valid source API key and destination API key. Click Connect. Verify Panel 2 loads with statuses, release groups, and custom fields populated.

- [ ] **Step 3: Verify Panel 2 (Settings)**

Select at least one status, one release group, and any custom fields. Verify Start Migration and (if prior run exists) Resume buttons appear.

- [ ] **Step 4: Verify Panel 3 (Progress)**

Click Start Migration. Verify the progress dashboard renders and rows update live as migration proceeds.

- [ ] **Step 5: Verify state file**

After migration starts, check `migration-state.json` exists in the project root and is being updated with IDs and step statuses.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: complete migration tool implementation"
```

---

## Notes for the Implementer

- **API request body shape:** The exact JSON structure for `POST /v2/entities` and `POST /v2/notes` must be verified against `api-v2-specs/entities.yaml` and `api-v2-specs/notes.yaml`. The plan uses reasonable assumptions based on the spec summary — adjust field names and nesting as needed.
- **Customer entity types:** The `type` field for customer users and companies in the entities API may differ from standard feature types. Check `api-v2-specs/entities.yaml` for the exact type strings.
- **Member email access:** The `members:pii:read` scope is required for member emails. If the API key lacks this scope, owner matching will fail silently and features will be created without owners (which is the correct fallback per spec).
- **Search endpoint pagination:** `POST /v2/entities/search` and `POST /v2/notes/search` use cursor-based pagination. The cursor is in `links.next` — pass it as the full URL on the next request (the `request()` method handles full URLs vs paths automatically).
- **Rate limiting:** The `ProductboardClient` handles 429s automatically. If you see lots of retries during testing, add a small artificial delay between entity creations.
