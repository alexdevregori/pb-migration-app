import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

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

  for (const srcId of ids) {
    let entityName: string = srcId
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data
      entityName = String(fields.name ?? srcId)

      const destResponse = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'company',
            fields: { name: fields.name, domain: fields.domain },
          },
        }),
      })

      state.idMap.companies[srcId] = destResponse.data.id
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
  }

  state.steps.companies = 'completed'
  await saveState(state)
  emit({ step: 'companies', status: 'completed', migrated, total })
}
