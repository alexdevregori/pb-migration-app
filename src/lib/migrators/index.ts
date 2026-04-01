import { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationConfig, MigrationState, ProgressEvent } from '@/lib/productboard/types'
import { initState, saveState } from '@/lib/state'
import { migrateMigrationProduct } from './migration-product'
import { migrateProducts } from './products'
import { migrateComponents } from './components'
import { migrateFeatures } from './features'
import { migrateSubfeatures } from './subfeatures'
import { migrateReleaseGroups } from './release-groups'
import { migrateReleases } from './releases'
import { discoverNotes, migrateNotes } from './notes'
import { migrateCompanies } from './companies'
import { migrateUsers } from './users'

export async function runMigration(
  config: MigrationConfig,
  existingState: MigrationState | null,
  emit: (event: ProgressEvent) => void
): Promise<void> {
  const state = existingState ?? initState(config)
  await saveState(state)

  const source = new ProductboardClient(config.sourceApiKey)
  const dest = new ProductboardClient(config.destinationApiKey)

  // Step 1: Migration Product
  if (state.steps.migrationProduct !== 'completed') {
    await migrateMigrationProduct(dest, state, emit)
  }

  // Step 2: Products
  if (state.steps.products !== 'completed') {
    await migrateProducts(source, dest, state, emit)
  }

  // Step 3: Components
  if (state.steps.components !== 'completed') {
    await migrateComponents(source, dest, state, emit)
  }

  // Step 4: Features
  if (state.steps.features !== 'completed') {
    await migrateFeatures(source, dest, state, emit)
  }

  // Step 5: Subfeatures
  if (state.steps.subfeatures !== 'completed') {
    await migrateSubfeatures(source, dest, state, emit)
  }

  // Step 6: Release Groups
  if (state.steps.releaseGroups !== 'completed') {
    await migrateReleaseGroups(source, dest, state, emit)
  }

  // Step 7: Releases
  if (state.steps.releases !== 'completed') {
    await migrateReleases(source, dest, state, emit)
  }

  // Step 8: Discover Notes (returns discovered data needed for next steps)
  // Always re-run discovery if any downstream step (companies, users, notes) is not yet
  // completed — even if discoverNotes itself is marked completed. Discovery is read-only
  // and safe to repeat. This ensures a resume after a mid-run crash does not silently
  // skip companies, users, or notes due to discoveredNotes being null.
  const needsDiscovery =
    state.steps.companies !== 'completed' ||
    state.steps.users !== 'completed' ||
    state.steps.notes !== 'completed'

  let discoveredNotes: Awaited<ReturnType<typeof discoverNotes>> | null = null
  if (needsDiscovery) {
    discoveredNotes = await discoverNotes(source, state)
    emit({ step: 'discoverNotes', status: 'completed' })
  }

  // Step 9: Companies
  if (state.steps.companies !== 'completed' && discoveredNotes) {
    await migrateCompanies(discoveredNotes.companyIds, source, dest, state, emit)
  }

  // Step 10: Users
  if (state.steps.users !== 'completed' && discoveredNotes) {
    await migrateUsers(discoveredNotes.userIds, source, dest, state, emit)
  }

  // Step 11: Notes
  if (state.steps.notes !== 'completed' && discoveredNotes) {
    await migrateNotes(discoveredNotes.notes, source, dest, state, emit)
  }
}
