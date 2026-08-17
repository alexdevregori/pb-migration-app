// ── Productboard API entity types ──────────────────────────────────────────

export type EntityType =
  | 'product'
  | 'component'
  | 'feature'
  | 'subfeature'
  | 'release'
  | 'releaseGroup'

// One entry in the relationships data array (both in GET responses and POST bodies)
export interface PBRelationshipEntry {
  type: string                        // e.g. 'parent' | 'child' | 'link' | 'customer'
  target: { id: string; type?: string }
}

// Paginated relationships object returned by the API
export interface PBRelationships {
  data: PBRelationshipEntry[]
  links?: { next: string | null }
}

export interface PBEntity {
  id: string
  type: EntityType
  fields: Record<string, unknown>
  relationships?: PBRelationships
}

export interface PBNote {
  id: string
  type: 'textNote' | 'conversationNote'
  fields: {
    name: string
    content?: string
    processed?: boolean
    archived?: boolean
    createdAt?: string
    tags?: { name: string }[]
    source?: { id?: string | null; origin?: string | null; url?: string | null }
    owner?: { id?: string; email?: string }
    creator?: { id?: string; email?: string }
  }
  relationships?: PBRelationships
}

export interface PBJiraIntegration {
  id: string
  type: 'jiraIntegration'
  fields: {
    name: string
    integrationStatus: 'enabled' | 'disabled'
  }
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
  | 'discovery'
  | 'migrationProduct'
  | 'products'
  | 'components'
  | 'features'
  | 'subfeatures'
  | 'dependencies'
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
  selectedProducts: string[]
  selectedReleaseGroups: string[]
  selectedFields: string[]
  // source status name → destination status ID (optional — omitting skips status migration)
  statusMapping?: Record<string, string>
  // source field UUID → destination field UUID (optional — falls back to same UUID)
  fieldMapping?: Record<string, string>
  // Built-in feature fields to migrate (default: all)
  selectedFeatureFields?: string[]
  // Tag keyword filter — only tags containing these strings are copied (default: all)
  tagKeywords?: string[]
  // Tag match mode — 'contains' (default) or 'exact'
  tagMatchMode?: 'contains' | 'exact'
  // Destination text field that will receive the source entity's original API ID
  sourceIdFieldId?: string
  // Jira key migration — one entry per integration: which dest text field receives its issue keys
  jiraIntegrationMappings?: Array<{ integrationId: string; destFieldId: string }>
  // Destination custom field values — used to resolve select option names across workspaces
  destCustomFields?: PBFieldConfig[]
  // Note migration options (all off by default; null maxAgeDays = no age limit)
  includeLinkedNotes?: boolean
  linkedNotesMaxAgeDays?: number | null
  includeNotesLinkedToNonMigratedFeatures?: boolean
  nonMigratedLinkedNotesMaxAgeDays?: number | null
  includeUnprocessedOrphanNotes?: boolean
  unprocessedOrphanNotesMaxAgeDays?: number | null
  includeProcessedOrphanNotes?: boolean
  processedOrphanNotesMaxAgeDays?: number | null
  appendSourceOwnerOnUnassigned?: boolean
  // Owner email filter — only features/subfeatures owned by these users are migrated (default: all)
  selectedOwnerEmails?: string[]
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
  severity?: 'warning' | 'error'
  request?: {
    method: string
    url: string
    body?: unknown
  }
}

// ── Progress events (SSE) ───────────────────────────────────────────────────

export interface ProgressEvent {
  step: StepName
  status: StepStatus
  migrated?: number
  total?: number
  message?: string
  error?: MigrationError
}

// ── Workspace info (returned to UI) ────────────────────────────────────────

export interface WorkspaceIdentity {
  name: string
  email: string
}

export interface WorkspaceInfo {
  // Source workspace
  statuses: PBStatus[]
  products: { id: string; name: string }[]
  releaseGroups: PBReleaseGroup[]
  customFields: PBFieldConfig[]
  // Destination workspace (used for mapping)
  destStatuses: PBStatus[]
  destCustomFields: PBFieldConfig[]
  // Jira integrations found in the source workspace
  jiraIntegrations?: Array<{ id: string; name: string; status: string }>
  // Members in the source workspace (for owner filtering)
  sourceMembers?: { email: string; name: string }[]
  // Identity (fetched from /v1/me — may be absent if the endpoint isn't available)
  sourceUser?: WorkspaceIdentity
  destUser?: WorkspaceIdentity
}
