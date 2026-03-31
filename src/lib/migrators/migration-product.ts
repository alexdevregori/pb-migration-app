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

  const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'product',
        fields: { name: 'Migration' },
      },
    }),
  })

  state.migrationProductId = response.data.id
  state.steps.migrationProduct = 'completed'
  await saveState(state)

  emit({ step: 'migrationProduct', status: 'completed', migrated: 1, total: 1 })
}
