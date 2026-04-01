import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBNote, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'

export interface NoteDiscoveryResult {
  notes: PBNote[]
  companyIds: Set<string>
  userIds: Set<string>
}

export async function discoverNotes(
  source: ProductboardClient,
  state: MigrationState
): Promise<NoteDiscoveryResult> {
  state.steps.discoverNotes = 'in_progress'
  await saveState(state)

  const migratedFeatureIds = Object.keys(state.idMap.features)
  const migratedSubfeatureIds = Object.keys(state.idMap.subfeatures)
  const allEntityIds = [...migratedFeatureIds, ...migratedSubfeatureIds]

  const allNotes: PBNote[] = []
  const companyIds = new Set<string>()
  const userIds = new Set<string>()

  // Search in batches of 100 (API limit)
  const BATCH_SIZE = 100
  for (let i = 0; i < allEntityIds.length; i += BATCH_SIZE) {
    const batch = allEntityIds.slice(i, i + BATCH_SIZE)
    let nextUrl: string | null = null

    do {
      const response = await source.request<{ data: PBNote[]; links: { next: string | null } }>(
        nextUrl ?? '/v2/notes/search',
        {
          method: 'POST',
          body: JSON.stringify({
            data: {
              relationships: {
                link: { ids: batch },
              },
            },
          }),
        }
      )

      for (const note of response.data) {
        allNotes.push(note)
        for (const rel of note.relationships ?? []) {
          if (rel.type === 'customer') {
            if (rel.data.type === 'company') companyIds.add(rel.data.id)
            else if (rel.data.type === 'user') userIds.add(rel.data.id)
          }
        }
      }

      nextUrl = response.links?.next ?? null
    } while (nextUrl)
  }

  state.steps.discoverNotes = 'completed'
  await saveState(state)

  return { notes: allNotes, companyIds, userIds }
}

export async function migrateNotes(
  notes: PBNote[],
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  state.steps.notes = 'in_progress'
  const total = notes.length
  let migrated = 0
  emit({ step: 'notes', status: 'in_progress', migrated: 0, total })

  for (const note of notes) {
    try {
      // Build destination relationships
      const relationships: object[] = []

      for (const rel of note.relationships ?? []) {
        if (rel.type === 'link') {
          const destId =
            state.idMap.features[rel.data.id] ?? state.idMap.subfeatures[rel.data.id]
          if (destId) {
            relationships.push({ type: 'link', data: { id: destId } })
          } else {
            console.warn(`Note ${note.id}: linked entity ${rel.data.id} not migrated, skipping link`)
          }
        }

        if (rel.type === 'customer') {
          const destId =
            rel.data.type === 'company'
              ? state.idMap.companies[rel.data.id]
              : state.idMap.users[rel.data.id]

          if (destId) {
            relationships.push({ type: 'customer', data: { id: destId, type: rel.data.type } })
          }
        }
      }

      // Build note fields
      const fields: Record<string, unknown> = {
        name: note.fields.name,
        content: note.fields.content,
      }

      const response = await dest.request<{ data: { id: string } }>('/v2/notes', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: note.type,
            fields,
            relationships,
          },
        }),
      })

      state.idMap.notes[note.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'notes', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = { step: 'notes' as const, sourceId: note.id, name: String(note.fields.name), message }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'notes', status: 'in_progress', migrated, total, error: err })
    }
  }

  state.steps.notes = 'completed'
  await saveState(state)
  emit({ step: 'notes', status: 'completed', migrated, total })
}
