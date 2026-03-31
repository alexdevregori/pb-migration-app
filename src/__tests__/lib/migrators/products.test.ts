import { migrateProducts } from '@/lib/migrators/products'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'
import type { MigrationConfig } from '@/lib/productboard/types'

const CONFIG: MigrationConfig = {
  sourceApiKey: 'src',
  destinationApiKey: 'dest',
  selectedStatuses: [],
  selectedReleaseGroups: [],
  selectedFields: [],
}

describe('migrateProducts', () => {
  it('creates a component in destination for each source product', async () => {
    const sourceProducts = [
      { id: 'src-p1', type: 'product', fields: { name: 'Product A' } },
      { id: 'src-p2', type: 'product', fields: { name: 'Product B' } },
    ]

    const source = new ProductboardClient('src-token')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceProducts)

    const dest = new ProductboardClient('dest-token')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-c1' } })
      .mockResolvedValueOnce({ data: { id: 'dest-c2' } })

    const state = initState(CONFIG)
    state.migrationProductId = 'migration-product-id'

    await migrateProducts(source, dest, state, jest.fn())

    expect(state.idMap.products['src-p1']).toBe('dest-c1')
    expect(state.idMap.products['src-p2']).toBe('dest-c2')
    expect(state.steps.products).toBe('completed')
  })

  it('logs error and continues when a product fails to create', async () => {
    const sourceProducts = [
      { id: 'src-p1', type: 'product', fields: { name: 'Product A' } },
    ]

    const source = new ProductboardClient('src-token')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceProducts)

    const dest = new ProductboardClient('dest-token')
    jest.spyOn(dest, 'request').mockRejectedValueOnce(new Error('API failure'))

    const state = initState(CONFIG)
    state.migrationProductId = 'migration-product-id'

    await migrateProducts(source, dest, state, jest.fn())

    expect(state.errors).toHaveLength(1)
    expect(state.errors[0].step).toBe('products')
    expect(state.steps.products).toBe('completed')
  })
})
