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
    const page: { data: PBEntity[]; links: { next: string | null } } = await source.request<{ data: PBEntity[]; links: { next: string | null } }>(
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
    allSubfeatures.push(...page.data)
    nextUrl = page.links?.next ?? null
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
      const err = { step: 'subfeatures' as const, sourceId: subfeature.id, name: String(subfeature.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'subfeatures', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.subfeatures = 'completed'
  await saveState(state)
  emit({ step: 'subfeatures', status: 'completed', migrated, total })
}
