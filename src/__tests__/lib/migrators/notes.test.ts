import { discoverNotes, migrateNotes } from '@/lib/migrators/notes'
import { ProductboardClient } from '@/lib/productboard/client'
import { PBNote } from '@/lib/productboard/types'
import { initState } from '@/lib/state'

describe('discoverNotes', () => {
  it('fetches notes linked to migrated features and stores them in state', async () => {
    const sourceNotes = [
      {
        id: 'note-1',
        type: 'textNote',
        fields: { name: 'Customer call', content: 'Great feedback' },
        relationships: [
          { type: 'link', data: { id: 'src-f1' } },
          { type: 'customer', data: { id: 'company-1', type: 'company' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    jest.spyOn(source, 'request').mockResolvedValue({
      data: sourceNotes,
      links: { next: null },
    })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'

    const { notes, companyIds, userIds } = await discoverNotes(source, state)

    expect(notes).toHaveLength(1)
    expect(companyIds.has('company-1')).toBe(true)
    expect(userIds.size).toBe(0)
  })
})

describe('migrateNotes', () => {
  it('creates notes linked to destination features and companies', async () => {
    const sourceNotes = [
      {
        id: 'note-1',
        type: 'textNote',
        fields: { name: 'Feedback', content: 'Good stuff' },
        relationships: [
          { type: 'link', data: { id: 'src-f1' } },
          { type: 'customer', data: { id: 'src-company-1', type: 'company' } },
        ],
      },
    ]

    const source = new ProductboardClient('src')
    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-1' } })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'
    state.idMap.companies['src-company-1'] = 'dest-company-1'

    await migrateNotes(sourceNotes as PBNote[], source, dest, state, jest.fn())

    expect(state.idMap.notes['note-1']).toBe('dest-note-1')
  })
})
