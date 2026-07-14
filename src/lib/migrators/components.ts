import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { fetchParentId } from './utils'

export async function migrateComponents(
  components: PBEntity[],
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void,
  parentIdCache: Map<string, string>,
  destMemberEmails?: Set<string>
): Promise<void> {
  state.steps.components = 'in_progress'
  emit({ step: 'components', status: 'in_progress' })

  const total = components.length
  let migrated = 0
  emit({ step: 'components', status: 'in_progress', migrated: 0, total })

  // Components can be nested arbitrarily deep (product → component → component → …).
  // Multi-pass: each pass migrates any component whose parent is now resolved.
  const pending = new Map<string, PBEntity>(components.map((c) => [c.id, c]))

  let madeProgress = true
  while (pending.size > 0 && madeProgress) {
    madeProgress = false

    for (const [id, component] of pending) {
      // Use pre-computed cache; fall back to API only on a cache miss
      let sourceParentId = parentIdCache.get(id)
      if (!sourceParentId) {
        sourceParentId = await fetchParentId(source, component) ?? undefined
        if (sourceParentId) parentIdCache.set(id, sourceParentId)
      }

      const destParentId = sourceParentId
        ? (state.idMap.products[sourceParentId] ?? state.idMap.components[sourceParentId] ?? null)
        : null

      if (!destParentId) continue // parent not yet migrated — retry next pass

      pending.delete(id)
      madeProgress = true

      try {
        const ownerEmail = (component.fields.owner as { email?: string } | undefined)?.email
        const fields: Record<string, unknown> = {
          name: component.fields.name,
          description: component.fields.description,
        }
        if (ownerEmail && (!destMemberEmails || destMemberEmails.has(ownerEmail.toLowerCase()))) {
          fields.owner = { email: ownerEmail }
        }
        if (state.config.sourceIdFieldId) fields[state.config.sourceIdFieldId] = component.id
        const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'component',
              fields,
              relationships: [{ type: 'parent', target: { id: destParentId } }],
            },
          }),
        })

        state.idMap.components[component.id] = response.data.id
        migrated++
        await saveState(state)
        emit({ step: 'components', status: 'in_progress', migrated, total })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const err = {
          step: 'components' as const,
          sourceId: component.id,
          name: String(component.fields.name),
          message,
          request: {
            method: 'POST',
            url: '/v2/entities',
            body: { data: { type: 'component', fields: { name: component.fields.name }, relationships: [{ type: 'parent', target: { id: destParentId } }] } },
          },
        }
        state.errors.push(err)
        await saveState(state)
        emit({ step: 'components', status: 'in_progress', migrated, total, error: err })
      }
    }
  }

  // Anything still pending has an unresolvable parent
  for (const [, component] of pending) {
    const sourceParentId = parentIdCache.get(component.id)
    const err = {
      step: 'components' as const,
      sourceId: component.id,
      name: String(component.fields.name),
      message: `Parent ${sourceParentId} could not be resolved after all passes`,
    }
    state.errors.push(err)
    emit({ step: 'components', status: 'in_progress', migrated, total, error: err })
  }
  if (pending.size > 0) await saveState(state)

  state.steps.components = 'completed'
  await saveState(state)
  emit({ step: 'components', status: 'completed', migrated, total })
}
