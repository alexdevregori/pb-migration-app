import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { withConcurrency } from './utils'

async function buildDestCompanyIndex(dest: ProductboardClient): Promise<Map<string, string>> {
  type Page = { data: { id: string; fields: Record<string, unknown> }[]; links: { next: string | null } }
  const index = new Map<string, string>() // name (lowercase) → dest ID
  let nextUrl: string | null = '/v2/entities?type[]=company'
  while (nextUrl) {
    const page: Page = await dest.request<Page>(nextUrl)
    for (const entity of page.data) {
      const name = entity.fields.name
      if (typeof name === 'string') index.set(name.toLowerCase(), entity.id)
    }
    nextUrl = page.links?.next ?? null
  }
  return index
}

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

  // Pre-fetch all existing companies in destination once — O(1) lookups from here on
  const destCompanyIndex = await buildDestCompanyIndex(dest)
  // Tracks in-flight creation promises keyed by lowercase name so concurrent
  // workers creating the same company name share one POST and reuse the result.
  const inFlight = new Map<string, Promise<string>>()

  await withConcurrency(ids, 10, async (srcId) => {
    let entityName: string = srcId
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data
      entityName = String(fields.name ?? srcId)
      const key = typeof fields.name === 'string' ? fields.name.toLowerCase() : null

      // Check if a company with this name already exists in the destination
      const existingId = key ? destCompanyIndex.get(key) : undefined
      if (existingId) {
        state.idMap.companies[srcId] = existingId
        migrated++
        await saveState(state)
        emit({ step: 'companies', status: 'in_progress', migrated, total })
        return
      }

      // Deduplicate concurrent creates for the same company name
      let promise = key ? inFlight.get(key) : undefined
      if (!promise) {
        promise = dest.request<{ data: { id: string } }>('/v2/entities', {
          method: 'POST',
          body: JSON.stringify({
            data: { type: 'company', fields: { name: fields.name, domain: fields.domain } },
          }),
        }).then((r) => {
          const id = r.data.id
          if (key) destCompanyIndex.set(key, id)
          return id
        })
        if (key) inFlight.set(key, promise)
      }

      const destId = await promise
      state.idMap.companies[srcId] = destId
      migrated++
      await saveState(state)
      emit({ step: 'companies', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'companies' as const, sourceId: srcId, name: entityName, message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'companies', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.companies = 'completed'
  await saveState(state)
  emit({ step: 'companies', status: 'completed', migrated, total })
}
