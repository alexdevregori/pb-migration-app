import { migrateSubfeatures } from '@/lib/migrators/subfeatures'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateSubfeatures', () => {
  it('maps source subfeature IDs to destination IDs under migrated features', async () => {
    const sourceSubfeatures = [
      {
        id: 'src-sf1',
        type: 'subfeature',
        fields: { name: 'Subfeature A', status: { name: 'Planned' } },
        relationships: [{ type: 'parent', data: { id: 'src-f1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceSubfeatures,
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-sf1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['Planned'],
      selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'

    await migrateSubfeatures(source, dest, state, jest.fn())

    expect(state.idMap.subfeatures['src-sf1']).toBe('dest-sf1')
  })
})
