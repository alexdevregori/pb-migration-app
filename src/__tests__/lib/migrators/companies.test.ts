import { migrateCompanies } from '@/lib/migrators/companies'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateCompanies', () => {
  it('creates destination companies and maps IDs', async () => {
    const source = new ProductboardClient('src')
    jest
      .spyOn(source, 'request')
      .mockResolvedValueOnce({ data: { id: 'src-co-1', fields: { name: 'Acme Corp', domain: 'acme.com' } } })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-co-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateCompanies(new Set(['src-co-1']), source, dest, state, jest.fn())

    expect(state.idMap.companies['src-co-1']).toBe('dest-co-1')
  })
})
