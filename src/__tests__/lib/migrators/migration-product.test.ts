import { migrateMigrationProduct } from '@/lib/migrators/migration-product'
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

function mockClient(responses: unknown[]): ProductboardClient {
  let i = 0
  const client = new ProductboardClient('token')
  jest.spyOn(client, 'request').mockImplementation(async () => responses[i++])
  return client
}

describe('migrateMigrationProduct', () => {
  it('creates a product named "Migration" in the destination', async () => {
    const dest = mockClient([{ data: { id: 'dest-product-id', type: 'product' } }])
    const state = initState(CONFIG)
    const emit = jest.fn()

    await migrateMigrationProduct(dest, state, emit)

    expect(state.migrationProductId).toBe('dest-product-id')
    expect(state.steps.migrationProduct).toBe('completed')
  })

  it('emits completed progress event', async () => {
    const dest = mockClient([{ data: { id: 'dest-product-id', type: 'product' } }])
    const state = initState(CONFIG)
    const emit = jest.fn()

    await migrateMigrationProduct(dest, state, emit)

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'migrationProduct', status: 'completed' })
    )
  })

  it('sets step to failed and re-throws when API call fails', async () => {
    const destClient = new ProductboardClient('token')
    jest.spyOn(destClient, 'request').mockRejectedValueOnce(new Error('Network error'))
    const state = initState(CONFIG)
    const emit = jest.fn()

    await expect(migrateMigrationProduct(destClient, state, emit)).rejects.toThrow('Network error')
    expect(state.steps.migrationProduct).toBe('failed')
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })
})
