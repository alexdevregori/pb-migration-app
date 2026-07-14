import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { withConcurrency } from './utils'

async function buildDestUserIndex(dest: ProductboardClient): Promise<Map<string, string>> {
  type Page = { data: { id: string; fields: Record<string, unknown> }[]; links: { next: string | null } }
  const index = new Map<string, string>() // email (lowercase) → dest ID
  let nextUrl: string | null = '/v2/entities?type[]=user'
  while (nextUrl) {
    const page: Page = await dest.request<Page>(nextUrl)
    for (const entity of page.data) {
      const email = entity.fields.email
      if (typeof email === 'string') index.set(email.toLowerCase(), entity.id)
    }
    nextUrl = page.links?.next ?? null
  }
  return index
}

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

  // Pre-fetch all existing users in destination once — O(1) lookups from here on
  const destUserIndex = await buildDestUserIndex(dest)
  // Tracks in-flight creation promises keyed by lowercase email so concurrent
  // workers creating the same user share one POST and reuse the result.
  const inFlight = new Map<string, Promise<string>>()

  await withConcurrency(ids, 10, async (srcId) => {
    let entityName: string = srcId
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data
      entityName = String(fields.name ?? srcId)
      const key = typeof fields.email === 'string' ? fields.email.toLowerCase() : null

      // Check if a user with this email already exists in the destination
      const existingId = key ? destUserIndex.get(key) : undefined
      if (existingId) {
        state.idMap.users[srcId] = existingId
        migrated++
        await saveState(state)
        emit({ step: 'users', status: 'in_progress', migrated, total })
        return
      }

      // Deduplicate concurrent creates for the same email
      let promise = key ? inFlight.get(key) : undefined
      if (!promise) {
        promise = dest.request<{ data: { id: string } }>('/v2/entities', {
          method: 'POST',
          body: JSON.stringify({
            data: { type: 'user', fields: { name: fields.name, email: fields.email } },
          }),
        }).then((r) => {
          const id = r.data.id
          if (key) destUserIndex.set(key, id)
          return id
        })
        if (key) inFlight.set(key, promise)
      }

      const destId = await promise
      state.idMap.users[srcId] = destId
      migrated++
      await saveState(state)
      emit({ step: 'users', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'users' as const, sourceId: srcId, name: entityName, message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'users', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.users = 'completed'
  await saveState(state)
  emit({ step: 'users', status: 'completed', migrated, total })
}
