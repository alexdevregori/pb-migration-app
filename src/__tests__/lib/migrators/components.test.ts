import { migrateComponents } from '@/lib/migrators/components'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateComponents', () => {
  it('creates destination components parented to their mapped product component', async () => {
    const sourceComponents = [
      {
        id: 'src-c1',
        type: 'component',
        fields: { name: 'Component A' },
        relationships: [{ type: 'parent', data: { id: 'src-p1' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceComponents)

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-c1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.products['src-p1'] = 'dest-p1'

    await migrateComponents(source, dest, state, jest.fn())

    expect(state.idMap.components['src-c1']).toBe('dest-c1')
  })

  it('skips component and logs warning if parent product was not migrated', async () => {
    const sourceComponents = [
      {
        id: 'src-c1',
        type: 'component',
        fields: { name: 'Orphan Component' },
        relationships: [{ type: 'parent', data: { id: 'unmapped-product' } }],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'paginate').mockResolvedValueOnce(sourceComponents)

    const dest = new ProductboardClient('dest')
    const requestSpy = jest.spyOn(dest, 'request')

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateComponents(source, dest, state, jest.fn())

    expect(requestSpy).not.toHaveBeenCalled()
    expect(state.errors).toHaveLength(1)
  })
})
