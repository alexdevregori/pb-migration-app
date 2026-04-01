import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateFeatures(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.features = 'in_progress'
  emit({ step: 'features', status: 'in_progress' })

  // Fetch features matching selected statuses
  let allFeatures: PBEntity[] = []
  let nextUrl: string | null = null

  do {
    const page: { data: PBEntity[]; links: { next: string | null } } = await source.request<{ data: PBEntity[]; links: { next: string | null } }>(
      nextUrl ?? '/v2/entities/search',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'feature',
            statuses: state.config.selectedStatuses.map((name) => ({ name })),
          },
        }),
      }
    )
    allFeatures.push(...page.data)
    nextUrl = page.links?.next ?? null
  } while (nextUrl)

  const total = allFeatures.length
  let migrated = 0
  emit({ step: 'features', status: 'in_progress', migrated: 0, total })

  for (const feature of allFeatures) {
    const sourceParentId = feature.relationships?.find((r) => r.type === 'parent')?.data.id
    const destParentId = sourceParentId ? state.idMap.components[sourceParentId] : null

    if (!destParentId) {
      const err = {
        step: 'features' as const,
        sourceId: feature.id,
        name: String(feature.fields.name),
        message: `Parent component ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      continue
    }

    try {
      // The status field is an object { id, name } — extract the name for mapping lookup
      const statusField = feature.fields.status as { name?: string } | string | undefined
      const sourceStatusName = typeof statusField === 'object' ? statusField?.name : statusField
      const destStatusId = sourceStatusName
        ? (state.config.statusMapping ?? {})[sourceStatusName]
        : undefined

      // Build fields — only include status if mapped
      const fields: Record<string, unknown> = {
        name: feature.fields.name,
        description: feature.fields.description,
      }
      if (destStatusId) {
        fields.status = { id: destStatusId }
      }

      // Create the feature
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'feature',
            fields,
            relationships: [{ type: 'parent', data: { id: destParentId } }],
          },
        }),
      })

      const destFeatureId = response.data.id
      state.idMap.features[feature.id] = destFeatureId

      // Apply selected custom fields via PATCH, using fieldMapping to translate UUIDs
      if (state.config.selectedFields.length > 0) {
        const patch = state.config.selectedFields
          .map((srcFieldId) => ({
            srcFieldId,
            destFieldId: (state.config.fieldMapping ?? {})[srcFieldId] ?? srcFieldId,
          }))
          .filter(({ srcFieldId }) => feature.fields[srcFieldId] !== undefined)
          .map(({ srcFieldId, destFieldId }) => ({
            op: 'set',
            path: destFieldId,
            value: feature.fields[srcFieldId],
          }))

        if (patch.length > 0) {
          await dest.request(`/v2/entities/${destFeatureId}`, {
            method: 'PATCH',
            body: JSON.stringify({ patch }),
          })
        }
      }

      migrated++
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'features' as const, sourceId: feature.id, name: String(feature.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.features = 'completed'
  await saveState(state)
  emit({ step: 'features', status: 'completed', migrated, total })
}
