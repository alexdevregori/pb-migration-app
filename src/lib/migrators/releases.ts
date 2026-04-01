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
      const err = { step: 'releases' as const, sourceId: release.id, name: String(release.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'releases', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.releases = 'completed'
  await saveState(state)
  emit({ step: 'releases', status: 'completed', migrated, total })
}
