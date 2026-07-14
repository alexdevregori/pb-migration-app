import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { fetchParentId, extractEntityExtras, normaliseFieldValue, isMemberValue, resolveSelectValue, withConcurrency } from './utils'

export async function migrateFeatures(
  features: PBEntity[],
  source: ProductboardClient,
  dest: ProductboardClient,
  state: MigrationState,
  emit: (event: ProgressEvent) => void,
  parentIdCache: Map<string, string>,
  entityReleaseMap?: Map<string, string>,
  jiraConnectionMap?: Map<string, Map<string, string>>,
  destMemberEmails?: Set<string>,
  selectValueLookup?: Map<string, Map<string, string>>
): Promise<void> {
  state.steps.features = 'in_progress'
  emit({ step: 'features', status: 'in_progress' })

  const total = features.length
  let migrated = 0
  emit({ step: 'features', status: 'in_progress', migrated: 0, total })

  await withConcurrency(features, 10, async (feature) => {
    // Use pre-computed cache; fall back to API only on a cache miss
    let sourceParentId = parentIdCache.get(feature.id)
    if (!sourceParentId) {
      sourceParentId = await fetchParentId(source, feature) ?? undefined
      if (sourceParentId) parentIdCache.set(feature.id, sourceParentId)
    }

    const destParentId = sourceParentId
      ? (state.idMap.components[sourceParentId] ?? state.idMap.products[sourceParentId] ?? null)
      : null

    if (!destParentId) {
      const err = {
        step: 'features' as const,
        sourceId: feature.id,
        name: String(feature.fields.name),
        message: `Parent ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total, error: err })
      return
    }

    const enabledFields = state.config.selectedFeatureFields
    const on = (id: string) => !enabledFields || enabledFields.includes(id)
    let fields: Record<string, unknown> = { name: feature.fields.name }
    const relationships: { type: string; target: { id: string } }[] = [
      { type: 'parent', target: { id: destParentId } },
    ]

    try {
      const statusField = feature.fields.status as { name?: string } | string | undefined
      const sourceStatusName = typeof statusField === 'object' ? statusField?.name : statusField
      const destStatusId = sourceStatusName
        ? (state.config.statusMapping ?? {})[sourceStatusName]
        : undefined

      fields = { name: feature.fields.name }
      if (on('description')) {
        // Description is often omitted from list/search responses (large rich-text field).
        // Fall back to a single-entity GET when it's missing.
        let rawDesc = feature.fields.description
        if (rawDesc === undefined) {
          try {
            const full = await source.request<{ data: { fields: Record<string, unknown> } }>(`/v2/entities/${feature.id}`)
            rawDesc = full.data.fields.description
          } catch { /* leave undefined — description won't be set */ }
        }
        // Unwrap RichTextFieldValueWithMetadata → plain HTML string
        if (rawDesc !== null && rawDesc !== undefined) {
          const unwrapped =
            typeof rawDesc === 'object' && 'value' in (rawDesc as Record<string, unknown>)
              ? (rawDesc as { value: unknown }).value
              : rawDesc
          if (unwrapped !== null && unwrapped !== undefined) {
            fields.description = unwrapped
          }
        }
      }
      Object.assign(fields, extractEntityExtras(feature.fields, enabledFields))
      if (destStatusId) fields.status = { id: destStatusId }
      for (const srcFieldId of state.config.selectedFields) {
        if (feature.fields[srcFieldId] !== undefined) {
          const destFieldId = (state.config.fieldMapping ?? {})[srcFieldId] ?? srcFieldId
          const normalised = normaliseFieldValue(feature.fields[srcFieldId])
          const val = selectValueLookup
            ? resolveSelectValue(normalised, destFieldId, selectValueLookup)
            : normalised
          if (isMemberValue(val)) {
            if (!destMemberEmails || destMemberEmails.has(val.email.toLowerCase())) {
              fields[destFieldId] = val
            }
          } else {
            fields[destFieldId] = val
          }
        }
      }

      if (jiraConnectionMap && state.config.jiraIntegrationMappings?.length) {
        const entityJiraKeys = jiraConnectionMap.get(feature.id)
        if (entityJiraKeys) {
          for (const { integrationId, destFieldId } of state.config.jiraIntegrationMappings) {
            const issueKey = entityJiraKeys.get(integrationId)
            if (issueKey) fields[destFieldId] = issueKey
          }
        }
      }

      if (state.config.sourceIdFieldId) fields[state.config.sourceIdFieldId] = feature.id

      const ownerEmail = on('owner')
        ? (feature.fields.owner as { email?: string } | undefined)?.email
        : undefined
      if (ownerEmail) {
        if (!destMemberEmails || destMemberEmails.has(ownerEmail.toLowerCase())) {
          fields.owner = { email: ownerEmail }
        } else {
          const warn = { step: 'features' as const, sourceId: feature.id, name: String(feature.fields.name), message: `Owner ${ownerEmail} not found in destination — created without owner`, severity: 'warning' as const }
          state.errors.push(warn)
          emit({ step: 'features', status: 'in_progress', migrated, total, error: warn })
        }
      }

      if (on('tags') && Array.isArray(feature.fields.tags) && feature.fields.tags.length > 0) {
        const keywords = state.config.tagKeywords ?? []
        const mode = state.config.tagMatchMode ?? 'contains'
        const tags = feature.fields.tags as { name: string }[]
        const matched = keywords.length > 0
          ? tags.filter((t) => keywords.some((kw) =>
              mode === 'exact'
                ? t.name.toLowerCase() === kw.toLowerCase()
                : t.name.toLowerCase().includes(kw.toLowerCase())
            ))
          : tags
        fields.tags = matched.map((t) => ({ name: t.name }))
      }

      const destReleaseId = entityReleaseMap?.get(feature.id)
      if (destReleaseId) {
        relationships.push({ type: 'link', target: { id: destReleaseId } })
      }

      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({ data: { type: 'feature', fields, relationships } }),
      })

      state.idMap.features[feature.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = {
        step: 'features' as const,
        sourceId: feature.id,
        name: String(feature.fields.name),
        message,
        request: {
          method: 'POST',
          url: '/v2/entities',
          body: { data: { type: 'feature', fields, relationships: [{ type: 'parent', target: { id: destParentId } }] } },
        },
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'features', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.features = 'completed'
  await saveState(state)
  emit({ step: 'features', status: 'completed', migrated, total })
}
