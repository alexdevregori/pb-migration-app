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
  lifecycle: Record<string, unknown>
  // Inline values for select/status fields (≤1000 values returned directly)
  values?: {
    data: Array<{ id: string; name: string }>
    links?: { next: string | null }
  }
}

export interface PBEntityConfig {
  type: string
  // API returns fields as a keyed object (Record), not an array
  fields: Record<string, PBFieldConfig>
  filters?: string[]
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
  // source status name → destination status ID (optional — omitting skips status migration)
  statusMapping?: Record<string, string>
  // source field UUID → destination field UUID (optional — falls back to same UUID)
  fieldMapping?: Record<string, string>
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
  // Source workspace
  statuses: PBStatus[]
  releaseGroups: PBReleaseGroup[]
  customFields: PBFieldConfig[]
  // Destination workspace (used for mapping)
  destStatuses: PBStatus[]
  destCustomFields: PBFieldConfig[]
}
