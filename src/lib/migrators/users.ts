import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateUsers(
  userIds: Set<string>,
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.users = 'in_progress'
  const ids = Array.from(userIds)
  const total = ids.length
  let migrated = 0
  emit({ step: 'users', status: 'in_progress', migrated: 0, total })

  for (const srcId of ids) {
    try {
      const sourceResponse = await source.request<{ data: { id: string; fields: Record<string, unknown> } }>(
        `/v2/entities/${srcId}`
      )
      const { fields } = sourceResponse.data

      const destResponse = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'user',
            fields: { name: fields.name, email: fields.email },
          },
        }),
      })

      state.idMap.users[srcId] = destResponse.data.id
      migrated++
      await saveState(state)
      emit({ step: 'users', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'users' as const, sourceId: srcId, name: srcId, message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'users', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.users = 'completed'
  await saveState(state)
  emit({ step: 'users', status: 'completed', migrated, total })
}
