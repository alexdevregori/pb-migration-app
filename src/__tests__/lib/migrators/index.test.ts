import { runMigration } from '@/lib/migrators/index'
import * as migrationProduct from '@/lib/migrators/migration-product'
import * as products from '@/lib/migrators/products'
import { initState } from '@/lib/state'
import type { MigrationConfig } from '@/lib/productboard/types'

jest.mock('@/lib/migrators/migration-product')
jest.mock('@/lib/migrators/products')
jest.mock('@/lib/migrators/components')
jest.mock('@/lib/migrators/features')
jest.mock('@/lib/migrators/subfeatures')
jest.mock('@/lib/migrators/release-groups')
jest.mock('@/lib/migrators/releases')
jest.mock('@/lib/migrators/notes')
jest.mock('@/lib/migrators/companies')
jest.mock('@/lib/migrators/users')
jest.mock('@/lib/state', () => ({
  ...jest.requireActual('@/lib/state'),
  saveState: jest.fn().mockResolvedValue(undefined),
}))

const CONFIG: MigrationConfig = {
  sourceApiKey: 'src',
  destinationApiKey: 'dest',
  selectedStatuses: [],
  selectedReleaseGroups: [],
  selectedFields: [],
}

describe('runMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('skips steps already marked completed (resume behavior)', async () => {
    const migrationProductSpy = jest
      .mocked(migrationProduct.migrateMigrationProduct)
      .mockResolvedValue(undefined)

    const productsSpy = jest
      .mocked(products.migrateProducts)
      .mockResolvedValue(undefined)

    // Mock all remaining steps to resolve immediately
    const { migrateComponents } = jest.requireMock('@/lib/migrators/components')
    const { migrateFeatures } = jest.requireMock('@/lib/migrators/features')
    const { migrateSubfeatures } = jest.requireMock('@/lib/migrators/subfeatures')
    const { migrateReleaseGroups } = jest.requireMock('@/lib/migrators/release-groups')
    const { migrateReleases } = jest.requireMock('@/lib/migrators/releases')
    const { discoverNotes, migrateNotes } = jest.requireMock('@/lib/migrators/notes')
    const { migrateCompanies } = jest.requireMock('@/lib/migrators/companies')
    const { migrateUsers } = jest.requireMock('@/lib/migrators/users')

    migrateComponents.mockResolvedValue(undefined)
    migrateFeatures.mockResolvedValue(undefined)
    migrateSubfeatures.mockResolvedValue(undefined)
    migrateReleaseGroups.mockResolvedValue(undefined)
    migrateReleases.mockResolvedValue(undefined)
    discoverNotes.mockResolvedValue({ notes: [], companyIds: new Set(), userIds: new Set() })
    migrateNotes.mockResolvedValue(undefined)
    migrateCompanies.mockResolvedValue(undefined)
    migrateUsers.mockResolvedValue(undefined)

    const state = initState(CONFIG)
    // Mark migrationProduct as already done
    state.steps.migrationProduct = 'completed'
    state.migrationProductId = 'existing-id'

    await runMigration(CONFIG, state, jest.fn())

    expect(migrationProductSpy).not.toHaveBeenCalled()
    expect(productsSpy).toHaveBeenCalled()
  })
})
