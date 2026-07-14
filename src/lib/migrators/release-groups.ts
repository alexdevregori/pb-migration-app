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

  const allGroups = await source.paginate<PBReleaseGroup>('/v2/entities?type[]=releaseGroup&archived=false')
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
      const err = { step: 'releaseGroups' as const, sourceId: group.id, name: group.fields.name, message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'releaseGroups', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.releaseGroups = 'completed'
  await saveState(state)
  emit({ step: 'releaseGroups', status: 'completed', migrated, total })
}
