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

  it('re-runs discoverNotes when notes step is not yet completed', async () => {
    const state = initState(CONFIG)
    // Simulate crash: discovery done but notes not yet migrated
    state.steps.migrationProduct = 'completed'
    state.steps.products = 'completed'
    state.steps.components = 'completed'
    state.steps.features = 'completed'
    state.steps.subfeatures = 'completed'
    state.steps.releaseGroups = 'completed'
    state.steps.releases = 'completed'
    state.steps.discoverNotes = 'completed'
    state.steps.companies = 'completed'
    state.steps.users = 'completed'
    // state.steps.notes is still 'pending'

    const discoverNotesMock = jest.requireMock('@/lib/migrators/notes').discoverNotes as jest.Mock
    // discoverNotes must return the expected shape
    discoverNotesMock.mockResolvedValue({ notes: [], companyIds: new Set(), userIds: new Set() })

    await runMigration(CONFIG, state, jest.fn())

    // discoverNotes should be re-run even though its step is marked completed
    expect(discoverNotesMock).toHaveBeenCalled()
  })
})
