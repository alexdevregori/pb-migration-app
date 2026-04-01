import { migrateReleaseGroups } from '@/lib/migrators/release-groups'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateReleaseGroups', () => {
  it('only migrates selected release groups', async () => {
    const allGroups = [
      { id: 'rg-1', type: 'releaseGroup', fields: { name: 'Q1 2026' } },
      { id: 'rg-2', type: 'releaseGroup', fields: { name: 'Q2 2026' } },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(allGroups)

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-rg-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: ['rg-1'], selectedFields: [],
    })

    await migrateReleaseGroups(source, dest, state, jest.fn())

    expect(state.idMap.releaseGroups['rg-1']).toBe('dest-rg-1')
    expect(state.idMap.releaseGroups['rg-2']).toBeUndefined()
  })
})
