import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export async function migrateProducts(
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.products = 'in_progress'
  emit({ step: 'products', status: 'in_progress' })

  // Guard: migrationProductId must be set before products can be migrated
  if (!state.migrationProductId) {
    throw new Error('migrationProductId is not set — run migrateMigrationProduct first')
  }

  const products = await source.paginate<PBEntity>('/v2/entities?type[]=product')
  const total = products.length
  let migrated = 0

  emit({ step: 'products', status: 'in_progress', migrated: 0, total })

  for (const product of products) {
    try {
      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'component',
            fields: {
              name: product.fields.name,
              description: product.fields.description,
            },
            relationships: [
              { type: 'parent', data: { id: state.migrationProductId } },
            ],
          },
        }),
      })

      state.idMap.products[product.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'products', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'products' as const, sourceId: product.id, name: String(product.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'products', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.products = 'completed'
  await saveState(state)
  emit({ step: 'products', status: 'completed', migrated, total })
}
