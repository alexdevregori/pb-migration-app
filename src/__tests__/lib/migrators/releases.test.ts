import { migrateReleases } from '@/lib/migrators/releases'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateReleases', () => {
  it('creates releases under their mapped destination release groups', async () => {
    const sourceReleases = [
      {
        id: 'src-r1',
        type: 'release',
        fields: { name: 'v1.0' },
        relationships: [
          { type: 'parent', data: { id: 'rg-1' } },
          { type: 'link', data: { id: 'src-f1' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceReleases)

    const dest = new ProductboardClient('dest')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-r1' } }) // create release
      .mockResolvedValueOnce({}) // link to feature

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: ['rg-1'], selectedFields: [],
    })
    state.idMap.releaseGroups['rg-1'] = 'dest-rg-1'
    state.idMap.features['src-f1'] = 'dest-f1'

    await migrateReleases(source, dest, state, jest.fn())

    expect(state.idMap.releases['src-r1']).toBe('dest-r1')
  })
})
