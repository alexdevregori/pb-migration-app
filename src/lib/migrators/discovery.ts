import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { fetchParentId, withConcurrency } from './utils'

export interface DiscoveryResult {
  features: PBEntity[]
  subfeatures: PBEntity[]
  /** Source feature IDs that are parents of selected subfeatures */
  parentFeatureIds: Set<string>
  /** Product entities that have relevant features underneath */
  neededProducts: PBEntity[]
  /** Component entities that have relevant features underneath */
  neededComponents: PBEntity[]
  /**
   * Pre-computed parent ID cache keyed by source entity ID.
   */
  entityParentIdCache: Map<string, string>
}

// Paginated POST search — reuses the same filter body on every page
async function fetchBySearch(
  source: ProductboardClient,
  body: Record<string, unknown>
): Promise<PBEntity[]> {
  const results: PBEntity[] = []
  let pageCursor: string | null = null
  do {
    const url = pageCursor
      ? `/v2/entities/search?pageCursor=${encodeURIComponent(pageCursor)}`
      : '/v2/entities/search'
    const page = await source.request<{ data: PBEntity[]; links: { next: string | null } }>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    results.push(...page.data)
    const nextLink = page.links?.next ?? null
    pageCursor = nextLink
      ? new URL(nextLink, 'https://api.productboard.com').searchParams.get('pageCursor')
      : null
  } while (pageCursor)
  return results
}

export async function discoverAll(
  source: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void
): Promise<DiscoveryResult> {
  state.steps.discovery = 'in_progress'
  await saveState(state)

  const entityParentIdCache = new Map<string, string>()
  const selectedProducts = state.config.selectedProducts ?? []
  const selectedStatuses = state.config.selectedStatuses ?? []

  // No products or no statuses selected → skip entity fetch entirely
  if (selectedProducts.length === 0 || selectedStatuses.length === 0) {
    state.steps.discovery = 'completed'
    await saveState(state)
    emit({ step: 'discovery', status: 'completed', message: 'No products or statuses selected — skipping.' })
    return {
      features: [],
      subfeatures: [],
      parentFeatureIds: new Set(),
      neededProducts: [],
      neededComponents: [],
      entityParentIdCache,
    }
  }

  emit({ step: 'discovery', status: 'in_progress', message: 'Fetching entities…' })

  const statusFilter = { statuses: selectedStatuses.map((name) => ({ name })) }

  // Fetch everything in parallel — no BFS, no sequential waterfall
  const [rawFeatures, rawSubfeatures, allProducts, allComponents] = await Promise.all([
    fetchBySearch(source, { data: { types: ['feature'],    archived: false, ...statusFilter } }),
    fetchBySearch(source, { data: { types: ['subfeature'], archived: false, ...statusFilter } }),
    source.paginate<PBEntity>('/v2/entities?type[]=product&archived=false'),
    source.paginate<PBEntity>('/v2/entities?type[]=component&archived=false'),
  ])

  // Build parent cache from inline relationships (fast path — usually no extra calls)
  for (const entity of [...rawFeatures, ...rawSubfeatures, ...allComponents]) {
    const parentRel = entity.relationships?.data?.find((r) => r.type === 'parent')
    if (parentRel) entityParentIdCache.set(entity.id, parentRel.target.id)
  }

  // Fallback: fetch parent for any entity missing it from inline data
  const missingParent = [...rawFeatures, ...rawSubfeatures, ...allComponents]
    .filter((e) => !entityParentIdCache.has(e.id))
  if (missingParent.length > 0) {
    emit({ step: 'discovery', status: 'in_progress', message: 'Resolving parent hierarchy…' })
    await withConcurrency(missingParent, 10, async (entity) => {
      const parentId = await fetchParentId(source, entity)
      if (parentId) entityParentIdCache.set(entity.id, parentId)
    })
  }

  // Apply product filter client-side
  let features    = rawFeatures
  let subfeatures = rawSubfeatures

  if (selectedProducts.length > 0) {
    const selectedSet = new Set(selectedProducts)
    const productIdSet = new Set(allProducts.map((p) => p.id))

    function getRootProduct(entityId: string): string | null {
      let current = entityParentIdCache.get(entityId)
      const seen = new Set<string>()
      while (current && !seen.has(current)) {
        seen.add(current)
        if (productIdSet.has(current)) return current
        current = entityParentIdCache.get(current)
      }
      return null
    }

    features = rawFeatures.filter((f) => {
      const root = getRootProduct(f.id)
      return root !== null && selectedSet.has(root)
    })

    const survivingFeatureIds = new Set(features.map((f) => f.id))
    subfeatures = rawSubfeatures.filter((s) => {
      const pid = entityParentIdCache.get(s.id)
      return pid ? survivingFeatureIds.has(pid) : false
    })
  }

  const parentFeatureIds = new Set<string>(
    subfeatures.map((s) => entityParentIdCache.get(s.id)!).filter(Boolean)
  )

  // Derive which products and components are actual ancestors of surviving features
  const neededProductIds   = new Set<string>()
  const neededComponentIds = new Set<string>()
  const productIdSet       = new Set(allProducts.map((p) => p.id))
  const componentIdSet     = new Set(allComponents.map((c) => c.id))

  for (const entity of [...features, ...subfeatures]) {
    let current = entityParentIdCache.get(entity.id)
    const seen = new Set<string>()
    while (current && !seen.has(current)) {
      seen.add(current)
      if (productIdSet.has(current)) {
        neededProductIds.add(current)
        break
      } else if (componentIdSet.has(current)) {
        neededComponentIds.add(current)
        current = entityParentIdCache.get(current)
      } else {
        break
      }
    }
  }

  const neededProducts   = allProducts.filter((p) => neededProductIds.has(p.id))
  const neededComponents = allComponents.filter((c) => neededComponentIds.has(c.id))

  state.steps.discovery = 'completed'
  await saveState(state)
  emit({
    step: 'discovery',
    status: 'completed',
    message: `Ready to migrate: ${features.length} features, ${subfeatures.length} subfeatures across ${neededProducts.length} product${neededProducts.length !== 1 ? 's' : ''} and ${neededComponents.length} component${neededComponents.length !== 1 ? 's' : ''}`,
  })

  return { features, subfeatures, parentFeatureIds, neededProducts, neededComponents, entityParentIdCache }
}
