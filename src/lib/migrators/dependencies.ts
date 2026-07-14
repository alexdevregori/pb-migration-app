import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, PBRelationships, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { withConcurrency } from './utils'

/**
 * Migrates isBlockedBy dependency relationships between features/subfeatures.
 * We only process isBlockedBy — isBlocking is the mirror side; the API creates both.
 */
export async function migrateDependencies(
  entities: PBEntity[],
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void,
): Promise<void> {
  state.steps.dependencies = 'in_progress'
  emit({ step: 'dependencies', status: 'in_progress' })

  const allIdMap = { ...state.idMap.features, ...state.idMap.subfeatures }

  // Collect isBlockedBy relationships for every successfully migrated entity
  const deps: { sourceEntityId: string; targetId: string }[] = []

  await withConcurrency(entities, 10, async (entity) => {
    if (!allIdMap[entity.id]) return

    let nextUrl: string | null = `/v2/entities/${entity.id}/relationships`
    while (nextUrl) {
      const page: PBRelationships = await source.request<PBRelationships>(nextUrl)
      for (const rel of page.data) {
        if (rel.type === 'isBlockedBy') {
          deps.push({ sourceEntityId: entity.id, targetId: rel.target.id })
        }
      }
      nextUrl = page.links?.next ?? null
    }
  })

  const total = deps.length
  let migrated = 0
  emit({ step: 'dependencies', status: 'in_progress', migrated: 0, total })

  await withConcurrency(deps, 10, async (dep) => {
    const destSourceId = allIdMap[dep.sourceEntityId]
    const destTargetId = allIdMap[dep.targetId]
    const sourceEntity = entities.find((e) => e.id === dep.sourceEntityId)
    const name = String(sourceEntity?.fields.name ?? dep.sourceEntityId)

    if (!destTargetId) {
      const warn = {
        step: 'dependencies' as const,
        sourceId: dep.sourceEntityId,
        name,
        message: `Dependency target ${dep.targetId} was not migrated — link skipped`,
        severity: 'warning' as const,
      }
      state.errors.push(warn)
      await saveState(state)
      emit({ step: 'dependencies', status: 'in_progress', migrated, total, error: warn })
      migrated++
      return
    }

    try {
      await dest.request(`/v2/entities/${destSourceId}/relationships`, {
        method: 'POST',
        body: JSON.stringify({
          data: { type: 'isBlockedBy', target: { id: destTargetId } },
        }),
      })
      migrated++
      emit({ step: 'dependencies', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = {
        step: 'dependencies' as const,
        sourceId: dep.sourceEntityId,
        name,
        message,
        severity: 'error' as const,
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'dependencies', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.dependencies = 'completed'
  await saveState(state)
  emit({ step: 'dependencies', status: 'completed', migrated, total })
}
