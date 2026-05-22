import { discoverNotes, migrateNotes } from '@/lib/migrators/notes'
import { ProductboardClient } from '@/lib/productboard/client'
import { PBNote } from '@/lib/productboard/types'
import { initState } from '@/lib/state'

describe('discoverNotes', () => {
  it('fetches notes linked to migrated features and stores them in state', async () => {
    const sourceNote: PBNote = {
      id: 'note-1',
      type: 'textNote',
      fields: { name: 'Customer call', content: 'Great feedback' },
      relationships: {
        data: [
          { type: 'link', target: { id: 'src-f1', type: 'feature' } },
          { type: 'customer', target: { id: 'company-1', type: 'company' } },
        ],
        links: { next: null },
      },
    }

    const source = new ProductboardClient('src')
    // POST /v2/notes/search — returns one note with inline relationships
    jest.spyOn(source, 'request').mockResolvedValueOnce({
      data: [sourceNote],
      links: { next: null },
    })

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedProducts: [], selectedReleaseGroups: [], selectedFields: [],
      includeLinkedNotes: true,
    })
    state.idMap.features['src-f1'] = 'dest-f1'

    const { notes, noteEntityLinks, companyIds, userIds } = await discoverNotes(source, state, jest.fn())

    expect(notes).toHaveLength(1)
    expect(noteEntityLinks.get('note-1')).toContain('src-f1')
    expect(companyIds.has('company-1')).toBe(true)
    expect(userIds.size).toBe(0)
  })
})

describe('migrateNotes', () => {
  it('creates notes and adds feature link relationships', async () => {
    const sourceNotes: PBNote[] = [
      {
        id: 'note-1',
        type: 'textNote',
        fields: { name: 'Feedback', content: 'Good stuff' },
        relationships: {
          data: [
            { type: 'customer', target: { id: 'src-company-1', type: 'company' } },
          ],
          links: { next: null },
        },
      },
    ]

    const noteEntityLinks = new Map([['note-1', ['src-f1']]])

    const source = new ProductboardClient('src')
    const dest = new ProductboardClient('dest')
    jest.spyOn(dest, 'request')
      .mockResolvedValueOnce({ data: { id: 'dest-note-1' } }) // POST /v2/notes

    const state = initState({
      sourceApiKey: 'src', destinationApiKey: 'dest',
      selectedStatuses: [], selectedProducts: [], selectedReleaseGroups: [], selectedFields: [],
    })
    state.idMap.features['src-f1'] = 'dest-f1'
    state.idMap.companies['src-company-1'] = 'dest-company-1'

    await migrateNotes(sourceNotes, noteEntityLinks, source, dest, state, jest.fn())

    expect(state.idMap.notes['note-1']).toBe('dest-note-1')
    expect(dest.request).toHaveBeenCalledTimes(1)
  })

  it('appends source owner to content when flag is on and owner is unassigned', async () => {
    const sourceNotes: PBNote[] = [
      {
        id: 'note-2',
        type: 'textNote',
        fields: {
          name: 'Orphan note',
          content: 'Some feedback',
          owner: { email: 'old@example.com' },
        },
      },
    ]

    const dest = new ProductboardClient('dest')
    const mockRequest = jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-2' } })

    const state = initState({
      sourceApiKey: 'src',
      destinationApiKey: 'dest',
      selectedStatuses: [],
      selectedProducts: [],
      selectedReleaseGroups: [],
      selectedFields: [],
      appendSourceOwnerOnUnassigned: true,
    })

    await migrateNotes(
      sourceNotes,
      new Map(),
      new ProductboardClient('src'),
      dest,
      state,
      jest.fn(),
      new Set(['other@example.com']), // 'old@example.com' is NOT in this set
    )

    const postedBody = JSON.parse((mockRequest.mock.calls[0][1] as RequestInit).body as string)
    expect(postedBody.data.fields.content).toBe('Some feedback\n\nSource Owner: old@example.com')
  })

  it('does not append source owner when owner is successfully assigned', async () => {
    const sourceNotes: PBNote[] = [
      {
        id: 'note-3',
        type: 'textNote',
        fields: {
          name: 'Assigned note',
          content: 'Clean content',
          owner: { email: 'member@example.com' },
        },
      },
    ]

    const dest = new ProductboardClient('dest')
    const mockRequest = jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-3' } })

    const state = initState({
      sourceApiKey: 'src',
      destinationApiKey: 'dest',
      selectedStatuses: [],
      selectedProducts: [],
      selectedReleaseGroups: [],
      selectedFields: [],
      appendSourceOwnerOnUnassigned: true,
    })

    await migrateNotes(
      sourceNotes,
      new Map(),
      new ProductboardClient('src'),
      dest,
      state,
      jest.fn(),
      new Set(['member@example.com']), // owner IS in this set
    )

    const postedBody = JSON.parse((mockRequest.mock.calls[0][1] as RequestInit).body as string)
    expect(postedBody.data.fields.content).toBe('Clean content')
  })
})
