import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBNote, PBRelationshipEntry, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { withConcurrency } from './utils'

export interface NoteDiscoveryResult {
  notes: PBNote[]
  // For each source note ID, all source entity IDs it was linked through
  noteEntityLinks: Map<string, string[]>
  companyIds: Set<string>
  userIds: Set<string>
}

const SEARCH_BATCH_SIZE = 100

export async function discoverNotes(
  source: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<NoteDiscoveryResult> {
  state.steps.discoverNotes = 'in_progress'
  await saveState(state)

  const includeLinkedNotes                      = state.config.includeLinkedNotes                      ?? false
  const includeNotesLinkedToNonMigratedFeatures = state.config.includeNotesLinkedToNonMigratedFeatures ?? false
  const includeUnprocessedOrphanNotes           = state.config.includeUnprocessedOrphanNotes           ?? false
  const includeProcessedOrphanNotes             = state.config.includeProcessedOrphanNotes             ?? false

  // Per-bucket age cutoffs — null means no limit
  const linkedNotesCutoff       = ageCutoff(state.config.linkedNotesMaxAgeDays             ?? null)
  const nonMigratedLinksCutoff  = ageCutoff(state.config.nonMigratedLinkedNotesMaxAgeDays  ?? null)
  const unprocessedOrphanCutoff = ageCutoff(state.config.unprocessedOrphanNotesMaxAgeDays  ?? null)
  const processedOrphanCutoff   = ageCutoff(state.config.processedOrphanNotesMaxAgeDays    ?? null)

  // All source entity IDs that were successfully migrated (all hierarchy levels)
  const migratedEntityIds = new Set<string>([
    ...Object.keys(state.idMap.products),
    ...Object.keys(state.idMap.components),
    ...Object.keys(state.idMap.features),
    ...Object.keys(state.idMap.subfeatures),
  ])

  // noteId → Set of source entity IDs the note is linked to (migrated only)
  const noteEntityLinks = new Map<string, Set<string>>()
  // noteId → PBNote (deduplicated)
  const noteMap = new Map<string, PBNote>()
  const companyIds = new Set<string>()
  const userIds = new Set<string>()

  // ── Bucket 1 & 2: notes linked to migrated entities ────────────────────────
  // Use POST /v2/notes/search with link.ids batched in groups of SEARCH_BATCH_SIZE.
  // This is far more efficient than fetching all notes — we only get back notes
  // that are actually linked to something we migrated (or need to check).
  if (includeLinkedNotes || includeNotesLinkedToNonMigratedFeatures) {
    const allMigratedIds = [...migratedEntityIds]
    const batches: string[][] = []
    for (let i = 0; i < allMigratedIds.length; i += SEARCH_BATCH_SIZE) {
      batches.push(allMigratedIds.slice(i, i + SEARCH_BATCH_SIZE))
    }

    console.log(`[discoverNotes] ${batches.length} search batches (${allMigratedIds.length} entity IDs, batch size ${SEARCH_BATCH_SIZE})`)
    emit({ step: 'discoverNotes', status: 'in_progress', message: 'Searching notes linked to migrated entities…' })

    let batchesDone = 0
    await withConcurrency(batches, 10, async (batch) => {
      let pageNum = 0
      let pageCursor: string | null = null
      const body: Record<string, unknown> = {
        data: { filter: { relationships: { link: batch.map((id) => ({ id })) } } },
      }
      do {
        pageNum++
        const searchUrl = pageCursor ? `/v2/notes/search?pageCursor=${encodeURIComponent(pageCursor)}` : '/v2/notes/search'
        console.log(`[discoverNotes] search batch page ${pageNum}: POST ${searchUrl} (${batch.length} ids)`)
        const page: { data: PBNote[]; links: { next: string | null } } =
          await source.request<{ data: PBNote[]; links: { next: string | null } }>(
            searchUrl,
            { method: 'POST', body: JSON.stringify(body) }
          )

        console.log(`[discoverNotes] search batch page ${pageNum} → ${page.data.length} notes returned`)

        for (const note of page.data) {
          if (note.fields.archived) continue
          const createdAt = note.fields.createdAt ? new Date(note.fields.createdAt as string) : null

          // Resolve which of this note's link targets are migrated
          const inlineRels = note.relationships
          let allRels: PBRelationshipEntry[] = inlineRels?.data ?? []
          let relsNextUrl = inlineRels?.links?.next ?? null
          let relsPageNum = 0
          while (relsNextUrl) {
            relsPageNum++
            console.log(`[discoverNotes] paginating relationships for note ${note.id} (page ${relsPageNum + 1}): GET ${relsNextUrl}`)
            const relsPage: { data: PBRelationshipEntry[]; links: { next: string | null } } =
              await source.request<{ data: PBRelationshipEntry[]; links: { next: string | null } }>(relsNextUrl)
            allRels = allRels.concat(relsPage.data)
            relsNextUrl = relsPage.links?.next ?? null
          }

          const allLinkedIds = allRels.filter((r) => r.type === 'link').map((r) => r.target.id)
          const migratedLinks = allLinkedIds.filter((id) => migratedEntityIds.has(id))
          const hasMigratedLink = migratedLinks.length > 0
          const hasAnyLink = allLinkedIds.length > 0

          if (hasMigratedLink && includeLinkedNotes && withinAge(createdAt, linkedNotesCutoff)) {
            if (!noteMap.has(note.id)) {
              noteMap.set(note.id, note)
              noteEntityLinks.set(note.id, new Set(migratedLinks))
              collectCustomers(note, companyIds, userIds)
            } else {
              // Merge any additional migrated links found in a later batch
              migratedLinks.forEach((id) => noteEntityLinks.get(note.id)!.add(id))
            }
          }

          if (hasAnyLink && !hasMigratedLink && includeNotesLinkedToNonMigratedFeatures && withinAge(createdAt, nonMigratedLinksCutoff)) {
            if (!noteMap.has(note.id)) {
              noteMap.set(note.id, note)
              noteEntityLinks.set(note.id, new Set())
              collectCustomers(note, companyIds, userIds)
            }
          }
        }

        const nextLink = page.links?.next ?? null
        pageCursor = nextLink ? (new URL(nextLink, 'https://api.productboard.com').searchParams.get('pageCursor')) : null
      } while (pageCursor)

      batchesDone++
      console.log(`[discoverNotes] batch complete (${batchesDone}/${batches.length} done, ${noteMap.size} notes so far)`)
    })
  }

  // ── Buckets 3 & 4: orphan notes ─────────────────────────────────────────────
  // Use GET /v2/notes with processed filter — orphan detection (no links) is
  // still client-side since the API has no "unlinked" filter.
  if (includeUnprocessedOrphanNotes || includeProcessedOrphanNotes) {
    const orphanFetches: { processed: boolean; cutoff: Date | null }[] = []
    if (includeUnprocessedOrphanNotes) orphanFetches.push({ processed: false, cutoff: unprocessedOrphanCutoff })
    if (includeProcessedOrphanNotes)   orphanFetches.push({ processed: true,  cutoff: processedOrphanCutoff  })

    for (const { processed, cutoff } of orphanFetches) {
      const label = processed ? 'processed' : 'unprocessed'
      console.log(`[discoverNotes] starting ${label} orphan scan (cutoff: ${cutoff?.toISOString() ?? 'none'})`)
      emit({ step: 'discoverNotes', status: 'in_progress', message: `Scanning ${label} orphan notes…` })

      const params: Record<string, string> = { archived: 'false', processed: String(processed) }
      if (cutoff) params.createdFrom = cutoff.toISOString()
      const qs = new URLSearchParams(params).toString()

      let nextUrl: string | null = `/v2/notes?${qs}`
      let orphanPageNum = 0
      let orphanScanned = 0
      while (nextUrl) {
        orphanPageNum++
        console.log(`[discoverNotes] orphan scan page ${orphanPageNum}: GET ${nextUrl}`)
        const page: { data: PBNote[]; links: { next: string | null } } =
          await source.request<{ data: PBNote[]; links: { next: string | null } }>(nextUrl)

        console.log(`[discoverNotes] orphan page ${orphanPageNum} → ${page.data.length} notes, scanning for unlinked…`)
        orphanScanned += page.data.length

        for (const note of page.data) {
          if (note.fields.archived) continue
          if (noteMap.has(note.id)) continue // already captured in linked buckets
          noteMap.set(note.id, note)
          noteEntityLinks.set(note.id, new Set())
          collectCustomers(note, companyIds, userIds)
        }

        nextUrl = page.links?.next ?? null
      }
      console.log(`[discoverNotes] ${label} orphan scan complete — scanned ${orphanScanned} notes, found ${noteMap.size} total so far`)
    }
  }

  emit({ step: 'discoverNotes', status: 'in_progress', message: `Found ${noteMap.size} note${noteMap.size !== 1 ? 's' : ''} to migrate` })

  state.steps.discoverNotes = 'completed'
  await saveState(state)

  const noteEntityLinksArrays = new Map(
    [...noteEntityLinks.entries()].map(([noteId, entityIds]) => [noteId, [...entityIds]])
  )

  return {
    notes: [...noteMap.values()],
    noteEntityLinks: noteEntityLinksArrays,
    companyIds,
    userIds,
  }
}

function ageCutoff(maxAgeDays: number | null): Date | null {
  if (maxAgeDays === null) return null
  const d = new Date()
  d.setDate(d.getDate() - maxAgeDays)
  return d
}

function withinAge(createdAt: Date | null, cutoff: Date | null): boolean {
  if (!cutoff) return true
  return !createdAt || createdAt >= cutoff
}

function collectCustomers(note: PBNote, companyIds: Set<string>, userIds: Set<string>) {
  for (const rel of note.relationships?.data ?? []) {
    if (rel.type === 'customer') {
      if (rel.target.type === 'company') companyIds.add(rel.target.id)
      else if (rel.target.type === 'user') userIds.add(rel.target.id)
    }
  }
}

export async function migrateNotes(
  notes: PBNote[],
  noteEntityLinks: Map<string, string[]>,
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void,
  destMemberEmails?: Set<string>
): Promise<void> {
  state.steps.notes = 'in_progress'
  const total = notes.length
  let migrated = 0
  emit({ step: 'notes', status: 'in_progress', migrated: 0, total })

  // Prefix applied to every imported note name — makes bulk-deletion easy if needed
  const migrationPrefix = `[Migration ${new Date().toISOString().slice(0, 10)}]`

  await withConcurrency(notes, 10, async (note) => {
    // Declared outside try so the catch block can include it in the error payload
    let noteBody: Record<string, unknown> = {}
    try {
      // Build all relationships for the v2 POST — customers + entity links
      const relationships: object[] = []

      for (const rel of note.relationships?.data ?? []) {
        if (rel.type === 'customer') {
          const destId =
            rel.target.type === 'company'
              ? state.idMap.companies[rel.target.id]
              : state.idMap.users[rel.target.id]
          if (destId) {
            relationships.push({ type: 'customer', target: { id: destId, type: rel.target.type } })
          }
        }
      }

      // Resolve entity links → destination IDs and add as link relationships
      const sourceEntityIds = noteEntityLinks.get(note.id) ?? []
      for (const sourceEntityId of sourceEntityIds) {
        const destEntityId =
          state.idMap.products[sourceEntityId]   ??
          state.idMap.components[sourceEntityId] ??
          state.idMap.features[sourceEntityId]   ??
          state.idMap.subfeatures[sourceEntityId]
        if (destEntityId) {
          relationships.push({ type: 'link', target: { id: destEntityId, type: 'link' } })
        }
      }

      const fields: Record<string, unknown> = {
        name: `${migrationPrefix} ${note.fields.name}`,
      }
      if (note.fields.content   !== undefined) fields.content   = note.fields.content
      if (note.fields.processed !== undefined) fields.processed = note.fields.processed
      if (note.fields.source?.url)             fields.source    = note.fields.source

      const ownerEmail = note.fields.owner?.email
      if (ownerEmail) {
        if (!destMemberEmails || destMemberEmails.has(ownerEmail.toLowerCase())) {
          fields.owner = { email: ownerEmail }
        } else {
          const warn = {
            step: 'notes' as const,
            sourceId: note.id,
            name: String(note.fields.name),
            message: `Owner ${ownerEmail} not found in destination — created without owner`,
            severity: 'warning' as const,
          }
          state.errors.push(warn)
          emit({ step: 'notes', status: 'in_progress', migrated, total, error: warn })

          if (state.config.appendSourceOwnerOnUnassigned) {
            const existing = typeof fields.content === 'string' ? fields.content : ''
            fields.content = existing ? `${existing}\n\nSource Owner: ${ownerEmail}` : `Source Owner: ${ownerEmail}`
          }
        }
      }

      noteBody = { type: note.type, fields }
      if (relationships.length > 0) noteBody.relationships = relationships

      const response = await dest.request<{ data: { id: string } }>('/v2/notes', {
        method: 'POST',
        body: JSON.stringify({ data: noteBody }),
      })

      state.idMap.notes[note.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'notes', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = {
        step: 'notes' as const,
        sourceId: note.id,
        name: String(note.fields.name),
        message,
        request: {
          method: 'POST',
          url: '/v2/notes',
          body: { data: noteBody },
        },
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'notes', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.notes = 'completed'
  await saveState(state)
  emit({ step: 'notes', status: 'completed', migrated, total })
}
