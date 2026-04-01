import { migrateFeatures } from '@/lib/migrators/features'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateFeatures', () => {
  it('only fetches features matching selected statuses', async () => {
    const source = new ProductboardClient('src')
    const searchSpy = jest.spyOn(source, 'request').mockResolvedValue({
      data: [],
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['In Progress', 'Planned'],
      selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateFeatures(source, dest, state, jest.fn())

    expect(searchSpy).toHaveBeenCalledWith(
      '/v2/entities/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('In Progress'),
      })
    )
  })

  it('maps source feature IDs to destination IDs', async () => {
    const sourceFeatures = [
      {
        id: 'src-f1',
        type: 'feature',
        fields: { name: 'Feature A', status: { id: 's1', name: 'In Progress' } },
        relationships: [{ type: 'parent', data: { id: 'src-c1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceFeatures,
      links: { next: null },
    })

    const dest = new ProductboardClient('dest')
    jest
      .spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-f1' } }) // create

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: ['In Progress'],
      selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.components['src-c1'] = 'dest-c1'

    await migrateFeatures(source, dest, state, jest.fn())

    expect(state.idMap.features['src-f1']).toBe('dest-f1')
  })
})
