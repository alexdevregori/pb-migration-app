import { migrateSubfeatures } from '@/lib/migrators/subfeatures'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'
import type { PBEntity } from '@/lib/productboard/types'

describe('migrateSubfeatures', () => {
  it('maps source subfeature IDs to destination IDs under migrated features', async () => {
    const sourceSubfeatures: PBEntity[] = [
      {
        id: 'src-sf1',
        type: 'subfeature',
        fields: { name: 'Subfeature A', status: { name: 'Planned' } },
        relationships: {
          data: [{ type: 'parent', target: { id: 'src-f1' } }],
          links: { next: null },
        },
      },
    ]

    const source = new ProductboardClient('src')
    // fetchParentId will call /v2/entities/src-sf1/relationships since inline parent is present
    jest.spyOn(source, 'request').mockResolvedValue({
      data: [{ type: 'parent', target: { id: 'src-f1' } }],
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

    await migrateSubfeatures(sourceSubfeatures, source, dest, state, jest.fn())

    expect(state.idMap.subfeatures['src-sf1']).toBe('dest-sf1')
  })
})
