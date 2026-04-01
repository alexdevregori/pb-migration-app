import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

function getParentId(entity: PBEntity): string | null {
  const parentRel = entity.relationships?.find((r) => r.type === 'parent')
  return parentRel?.data.id ?? null
}

export async function migrateComponents(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.components = 'in_progress'
  emit({ step: 'components', status: 'in_progress' })

  const components = await source.paginate<PBEntity>('/v2/entities?type[]=component')
  const total = components.length
  let migrated = 0

  emit({ step: 'components', status: 'in_progress', migrated: 0, total })

  for (const component of components) {
    const sourceParentId = getParentId(component)
    const destParentId = sourceParentId ? state.idMap.products[sourceParentId] : null

    if (!destParentId) {
      const err = {
        step: 'components' as const,
        sourceId: component.id,
        name: String(component.fields.name),
        message: `Parent product ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'components', status: 'in_progress', migrated, total, error: err })
      continue
    }

    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'component',
            fields: {
              name: component.fields.name,
              description: component.fields.description,
            },
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      state.idMap.components[component.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'components', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'components' as const, sourceId: component.id, name: String(component.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'components', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.components = 'completed'
  await saveState(state)
  emit({ step: 'components', status: 'completed', migrated, total })
}
