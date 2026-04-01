import { migrateUsers } from '@/lib/migrators/users'
import { ProductboardClient } from '@/lib/productboard/client'
import { initState } from '@/lib/state'

describe('migrateUsers', () => {
  it('creates destination customer users and maps IDs', async () => {
    const source = new ProductboardClient('src')
    jest
      .spyOn(source, 'request')
      .mockResolvedValueOnce({ data: { id: 'src-u-1', fields: { name: 'Jane Doe', email: 'jane@acme.com' } } })

    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-u-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })

    await migrateUsers(new Set(['src-u-1']), source, dest, state, jest.fn())

    expect(state.idMap.users['src-u-1']).toBe('dest-u-1')
  })
})
