import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { fetchParentId, withConcurrency } from './utils'

/**
 * Migrates releases and returns a reverse-lookup map of
 * sourceEntityId → destReleaseId so that features and subfeatures
 * can attach their release relationship immediately on creation.
 */
export async function migrateReleases(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<Map<string, string>> {
  state.steps.releases = 'in_progress'
  emit({ step: 'releases', status: 'in_progress' })

  const allReleases = await source.paginate<PBEntity>('/v2/entities?type[]=release&archived=false')

  // Filter to releases whose parent release group was selected
  const selectedReleases = allReleases.filter((r) => {
    const parentId = r.relationships?.data.find((rel) => rel.type === 'parent')?.target.id
    return parentId ? state.config.selectedReleaseGroups.includes(parentId) : false
  })

  const total = selectedReleases.length
  let migrated = 0
  emit({ step: 'releases', status: 'in_progress', migrated: 0, total })

  // Reverse map: sourceFeatureOrSubfeatureId → destReleaseId
  // Returned to the caller so features/subfeatures can attach the link on creation.
  const entityReleaseMap = new Map<string, string>()

  await withConcurrency(selectedReleases, 10, async (release) => {
    const sourceParentId = await fetchParentId(source, release)
    const destParentId = sourceParentId ? state.idMap.releaseGroups[sourceParentId] : null

    if (!destParentId) {
      state.errors.push({
        step: 'releases',
        sourceId: release.id,
        name: String(release.fields.name),
        message: `Parent release group ${sourceParentId} was not migrated`,
      })
      await saveState(state)
      return
    }

    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'release',
            fields: { name: release.fields.name, description: release.fields.description },
            relationships: [{ type: 'parent', target: { id: destParentId } }],
          },
        }),
      })

      const destReleaseId = response.data.id
      state.idMap.releases[release.id] = destReleaseId

      // Record which source entities belong to this release so features/subfeatures
      // can attach the link immediately after they are created.
      for (const rel of (release.relationships?.data ?? []).filter((r) => r.type === 'link')) {
        entityReleaseMap.set(rel.target.id, destReleaseId)
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
  })

  state.steps.releases = 'completed'
  await saveState(state)
  emit({ step: 'releases', status: 'completed', migrated, total })
  return entityReleaseMap
}
