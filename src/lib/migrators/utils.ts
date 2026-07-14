import type { ProductboardClient } from '@/lib/productboard/client'
import type { PBEntity, PBRelationships } from '@/lib/productboard/types'

/**
 * Extracts health, workProgress, effort, and timeframe from a source entity's
 * fields and returns only what should be written to the destination.
 */
export function extractEntityExtras(
  fields: Record<string, unknown>,
  enabled?: string[], // if undefined, all fields are included
): Record<string, unknown> {
  const on = (id: string) => !enabled || enabled.includes(id)
  const extras: Record<string, unknown> = {}

  // Health: send status + comment only
  if (on('health')) {
    const health = fields.health as { status?: string; comment?: string } | undefined
    if (health?.status) {
      extras.health = {
        status: health.status,
        ...(health.comment ? { comment: health.comment } : {}),
      }
    }
  }

  // Work progress: only migrate manual mode
  if (on('workProgress')) {
    const wp = fields.workProgress as { value?: number; mode?: string } | undefined
    if (wp?.mode === 'manual' && wp.value !== undefined) {
      extras.workProgress = { value: wp.value, mode: 'manual' }
    }
  }

  // Effort: plain number
  if (on('effort') && typeof fields.effort === 'number') {
    extras.effort = fields.effort
  }

  // Timeframe: send all three fields if present
  if (on('timeframe')) {
    const tf = fields.timeframe as { startDate?: string; endDate?: string; granularity?: string } | undefined
    if (tf?.startDate || tf?.endDate) {
      extras.timeframe = {
        ...(tf.startDate   ? { startDate:   tf.startDate   } : {}),
        ...(tf.endDate     ? { endDate:     tf.endDate     } : {}),
        ...(tf.granularity ? { granularity: tf.granularity } : {}),
      }
    }
  }

  return extras
}

/**
 * Returns true if a value looks like a member field value: { id: string, email: string }.
 */
export function isMemberValue(value: unknown): value is { id: string; email: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.email === 'string'
}

/**
 * Normalises a custom field value for writing to the destination workspace.
 *
 * Single-select fields are returned by the source API as `{ id, name, color? }`.
 * The destination API only accepts `{ name }` (or `{ id }`) for assignment —
 * sending `id` from the source would reference an option that doesn't exist in
 * the destination workspace.  We detect single-select values at runtime and
 * strip them down to `{ name }` only.
 */
export function normaliseFieldValue(value: unknown): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const v = value as Record<string, unknown>
    // Single-select: { id: string, name: string, color?: string } — no other keys
    const keys = Object.keys(v)
    if (
      typeof v.id === 'string' &&
      typeof v.name === 'string' &&
      keys.every((k) => k === 'id' || k === 'name' || k === 'color')
    ) {
      return { name: (v.name as string).trim() }
    }
  }
  // Multi-select: array of single-select objects
  if (Array.isArray(value)) {
    return value.map((item) => normaliseFieldValue(item))
  }
  return value
}

/**
 * Builds a lookup map for resolving select option names across workspaces.
 * destFieldId → Map<trimmedLowerName, exactDestName>
 *
 * When source and destination have the same option but one has trailing/leading
 * whitespace, this ensures we always send the exact name the dest field expects.
 */
export function buildSelectValueLookup(
  destCustomFields: Array<{ id: string; values?: { data: Array<{ name: string }> } }>
): Map<string, Map<string, string>> {
  const lookup = new Map<string, Map<string, string>>()
  for (const field of destCustomFields) {
    if (!field.values?.data?.length) continue
    const nameMap = new Map<string, string>()
    for (const v of field.values.data) {
      nameMap.set(v.name.trim().toLowerCase(), v.name)
    }
    lookup.set(field.id, nameMap)
  }
  return lookup
}

/**
 * Resolves a normalised select value (or array of values) against the dest field
 * lookup, returning the exact dest option name(s).  Falls back to the source name
 * if no match is found so behaviour is unchanged when the lookup has no entry.
 */
export function resolveSelectValue(
  value: unknown,
  destFieldId: string,
  lookup: Map<string, Map<string, string>>
): unknown {
  const nameMap = lookup.get(destFieldId)
  if (!nameMap) return value

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    if (typeof v.name === 'string') {
      const resolved = nameMap.get(v.name.trim().toLowerCase())
      return { name: resolved ?? v.name.trim() }
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveSelectValue(item, destFieldId, lookup))
  }

  return value
}

/**
 * Runs `fn` over all `items` with at most `concurrency` in-flight at once.
 * As each item completes the next is picked up immediately (sliding window),
 * so throughput stays constant rather than stalling at batch boundaries.
 */
export async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()!
      await fn(item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  )
}

/**
 * Returns the parent entity ID for a given entity.
 *
 * The inline `relationships.data` on entity list responses is only the FIRST PAGE.
 * If the parent entry wasn't included there (because other relationship types pushed
 * it onto a later page), this helper paginates through the entity's dedicated
 * relationships endpoint until it finds a `type: 'parent'` entry.
 */
export async function fetchParentId(
  client: ProductboardClient,
  entity: PBEntity
): Promise<string | null> {
  // Fast path: check the inline first page
  const inline = entity.relationships
  const inlineParent = inline?.data.find((r) => r.type === 'parent')
  if (inlineParent) return inlineParent.target.id

  // If the search endpoint didn't include inline relationships, or they're paginated,
  // fall back to the entity's dedicated relationships endpoint.
  let nextUrl: string | null = inline?.links?.next ?? `/v2/entities/${entity.id}/relationships`
  while (nextUrl) {
    const page: PBRelationships = await client.request<PBRelationships>(nextUrl)
    const parent = page.data.find((r: { type: string }) => r.type === 'parent')
    if (parent) return parent.target.id
    nextUrl = page.links?.next ?? null
  }

  return null
}
