import { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationConfig, MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { initState, saveState } from '@/lib/state'
import { buildSelectValueLookup } from './utils'
import { migrateMigrationProduct } from './migration-product'
import { migrateProducts } from './products'
import { migrateComponents } from './components'
import { migrateFeatures } from './features'
import { migrateSubfeatures } from './subfeatures'
import { migrateDependencies } from './dependencies'
import { migrateReleaseGroups } from './release-groups'
import { migrateReleases } from './releases'
import { discoverNotes, migrateNotes } from './notes'
import { migrateCompanies } from './companies'
import { migrateUsers } from './users'
import { discoverAll } from './discovery'

export async function runMigration(
  config: MigrationConfig,
  existingState: MigrationState | null,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  const state = existingState ?? initState(config)
  await saveState(state)

  const source = new ProductboardClient(config.sourceApiKey)
  const dest   = new ProductboardClient(config.destinationApiKey)

  // ── Step 1: Discovery ───────────────────────────────────────────────────────
  // Always re-run discovery so we have live entity arrays + the parent ID cache.
  const {
    features,
    subfeatures,
    neededProducts,
    neededComponents,
    entityParentIdCache,
  } = await discoverAll(source, state, emit)

  // ── Step 2: Destination member email set ────────────────────────────────────
  // Fetch once upfront so member field values can be validated before any POST —
  // avoids 422 retry round-trips across all entity types.
  const destMemberEmails = new Set<string>()
  try {
    const members = await dest.paginate<{ fields: { email?: string } }>('/v2/members')
    for (const m of members) {
      if (m.fields?.email) destMemberEmails.add(m.fields.email.toLowerCase())
    }
    console.log(`[members] Loaded ${destMemberEmails.size} destination member email(s)`)
  } catch {
    console.warn('[members] Could not fetch destination members — member field validation skipped')
  }

  // ── Step 3: Migration Product ───────────────────────────────────────────────
  if (state.steps.migrationProduct !== 'completed') {
    await migrateMigrationProduct(dest, state, emit)
  }

  // ── Step 3: Products (only those with relevant features underneath) ─────────
  if (state.steps.products !== 'completed') {
    await migrateProducts(neededProducts, dest, state, emit, destMemberEmails)
  }

  // ── Step 3: Components (only those with relevant features underneath) ───────
  if (state.steps.components !== 'completed') {
    await migrateComponents(neededComponents, source, dest, state, emit, entityParentIdCache, destMemberEmails)
  }

  // ── Step 4: Release Groups (skip if none selected) ──────────────────────────
  if (state.steps.releaseGroups !== 'completed' && config.selectedReleaseGroups.length > 0) {
    await migrateReleaseGroups(source, dest, state, emit)
  }

  // ── Step 5: Releases — before features so links can be set on creation ──────
  let entityReleaseMap = new Map<string, string>()
  if (config.selectedReleaseGroups.length > 0) {
    if (state.steps.releases !== 'completed') {
      entityReleaseMap = await migrateReleases(source, dest, state, emit)
    } else {
      // Releases already done — rebuild the map from source data
      const allReleases = await source.paginate<{
        id: string
        relationships?: { data: { type: string; target: { id: string } }[] }
      }>('/v2/entities?type[]=release&archived=false')
      for (const release of allReleases) {
        const destReleaseId = state.idMap.releases[release.id]
        if (!destReleaseId) continue
        for (const rel of (release.relationships?.data ?? []).filter((r) => r.type === 'link')) {
          entityReleaseMap.set(rel.target.id, destReleaseId)
        }
      }
    }
  }

  // ── Step 7: Jira connection pre-fetch ───────────────────────────────────────
  // Build sourceEntityId → Map<integrationId, issueKey> before creating features
  // so issue keys can be included in the initial POST body.
  const jiraConnectionMap = new Map<string, Map<string, string>>()
  if (config.jiraIntegrationMappings?.length) {
    for (const { integrationId } of config.jiraIntegrationMappings) {
      let nextUrl: string | null = `/v2/jira-integrations/${integrationId}/connections`
      while (nextUrl) {
        const page: { data: Array<{ id: string; fields: { issueKey: string } }>; links: { next: string | null } } =
          await source.request<{ data: Array<{ id: string; fields: { issueKey: string } }>; links: { next: string | null } }>(nextUrl)
        for (const conn of page.data) {
          const entityMap = jiraConnectionMap.get(conn.id) ?? new Map<string, string>()
          entityMap.set(integrationId, conn.fields.issueKey)
          jiraConnectionMap.set(conn.id, entityMap)
        }
        nextUrl = page.links?.next ?? null
      }
    }
    console.log(`[jira] Loaded ${jiraConnectionMap.size} entity connection(s) across ${config.jiraIntegrationMappings.length} integration(s)`)
  }

  // ── Step 8: Features ────────────────────────────────────────────────────────
  // Build select value lookup from dest field config so option names resolve
  // correctly even when one side has leading/trailing whitespace.
  const selectValueLookup = buildSelectValueLookup(config.destCustomFields ?? [])

  if (state.steps.features !== 'completed') {
    await migrateFeatures(features, source, dest, state, emit, entityParentIdCache, entityReleaseMap, jiraConnectionMap, destMemberEmails, selectValueLookup)
  }

  // ── Step 9: Subfeatures ─────────────────────────────────────────────────────
  if (state.steps.subfeatures !== 'completed') {
    await migrateSubfeatures(subfeatures, source, dest, state, emit, entityParentIdCache, entityReleaseMap, jiraConnectionMap, destMemberEmails, selectValueLookup)
  }

  // ── Step 9: Dependencies ────────────────────────────────────────────────────
  if (state.steps.dependencies !== 'completed') {
    await migrateDependencies(
      [...features, ...subfeatures],
      source, dest, state, emit
    )
  }

  // ── Step 9: Discover Notes ──────────────────────────────────────────────────
  const notesEnabled =
    config.includeLinkedNotes !== false ||
    config.includeNotesLinkedToNonMigratedFeatures === true ||
    config.includeUnprocessedOrphanNotes === true ||
    config.includeProcessedOrphanNotes === true

  const needsDiscovery =
    notesEnabled && (
      state.steps.companies !== 'completed' ||
      state.steps.users     !== 'completed' ||
      state.steps.notes     !== 'completed'
    )

  let discoveredNotes: Awaited<ReturnType<typeof discoverNotes>> | null = null
  if (needsDiscovery) {
    emit({ step: 'discoverNotes', status: 'in_progress' })
    try {
      discoveredNotes = await discoverNotes(source, state, emit)
      emit({ step: 'discoverNotes', status: 'completed' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[discoverNotes] failed:', error)
      emit({ step: 'discoverNotes', status: 'failed', error: {
        step: 'discoverNotes', sourceId: '', name: 'Discover Notes', message,
      }})
      return
    }
  }

  // ── Step 10: Companies ──────────────────────────────────────────────────────
  if (state.steps.companies !== 'completed' && discoveredNotes) {
    await migrateCompanies(discoveredNotes.companyIds, source, dest, state, emit)
  }

  // ── Step 11: Users ──────────────────────────────────────────────────────────
  if (state.steps.users !== 'completed' && discoveredNotes) {
    await migrateUsers(discoveredNotes.userIds, source, dest, state, emit)
  }

  // ── Step 12: Notes ──────────────────────────────────────────────────────────
  if (state.steps.notes !== 'completed' && discoveredNotes) {
    await migrateNotes(discoveredNotes.notes, discoveredNotes.noteEntityLinks, source, dest, state, emit, destMemberEmails)
  }
}
