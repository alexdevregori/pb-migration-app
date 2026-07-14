import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateMigrationProduct(
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.migrationProduct = 'in_progress'
  emit({ step: 'migrationProduct', status: 'in_progress' })

  try {
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ') // "YYYY-MM-DD HH:MM"
    const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'product',
          fields: { name: `Migration ${timestamp}` },
        },
      }),
    })

    state.migrationProductId = response.data.id
    state.steps.migrationProduct = 'completed'
    await saveState(state)
    emit({ step: 'migrationProduct', status: 'completed', migrated: 1, total: 1 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    state.steps.migrationProduct = 'failed'
    await saveState(state)
    emit({
      step: 'migrationProduct',
      status: 'failed',
      error: { step: 'migrationProduct', sourceId: '', name: 'Migration Product', message },
    })
    throw error
  }
}
