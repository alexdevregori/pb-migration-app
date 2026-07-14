import type { ProductboardClient } from '@/lib/productboard/client'
import type { MigrationState, PBEntity, ProgressEvent } from '@/lib/productboard/types'
import { saveState } from '@/lib/state'
import { fetchParentId, extractEntityExtras, normaliseFieldValue, isMemberValue, resolveSelectValue, withConcurrency } from './utils'

export async function migrateSubfeatures(
  subfeatures: PBEntity[],
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
  state.steps.subfeatures = 'in_progress'
  const total = subfeatures.length
  let migrated = 0
  emit({ step: 'subfeatures', status: 'in_progress', migrated: 0, total })

  await withConcurrency(subfeatures, 10, async (subfeature) => {
    // Use pre-computed cache; fall back to API only on a cache miss
    let sourceParentId = parentIdCache.get(subfeature.id)
    if (!sourceParentId) {
      sourceParentId = await fetchParentId(source, subfeature) ?? undefined
      if (sourceParentId) parentIdCache.set(subfeature.id, sourceParentId)
    }

    const destParentId = sourceParentId ? state.idMap.features[sourceParentId] : null

    if (!destParentId) {
      const err = {
        step: 'subfeatures' as const,
        sourceId: subfeature.id,
        name: String(subfeature.fields.name),
        message: `Parent feature ${sourceParentId} was not migrated`,
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'subfeatures', status: 'in_progress', migrated, total, error: err })
      return
    }

    const enabledFields = state.config.selectedFeatureFields
    const on = (id: string) => !enabledFields || enabledFields.includes(id)
    let fields: Record<string, unknown> = { name: subfeature.fields.name }
    const relationships: { type: string; target: { id: string } }[] = [
      { type: 'parent', target: { id: destParentId } },
    ]

    try {
      const statusField = subfeature.fields.status as { name?: string } | string | undefined
      const sourceStatusName = typeof statusField === 'object' ? statusField?.name : statusField
      const destStatusId = sourceStatusName
        ? (state.config.statusMapping ?? {})[sourceStatusName]
        : undefined

      fields = { name: subfeature.fields.name }
      if (on('description')) {
        // Description is often omitted from list/search responses (large rich-text field).
        // Fall back to a single-entity GET when it's missing.
        let rawDesc = subfeature.fields.description
        if (rawDesc === undefined) {
          try {
            const full = await source.request<{ data: { fields: Record<string, unknown> } }>(`/v2/entities/${subfeature.id}`)
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
      Object.assign(fields, extractEntityExtras(subfeature.fields, enabledFields))
      if (destStatusId) fields.status = { id: destStatusId }
      for (const srcFieldId of state.config.selectedFields) {
        if (subfeature.fields[srcFieldId] !== undefined) {
          const destFieldId = (state.config.fieldMapping ?? {})[srcFieldId] ?? srcFieldId
          const normalised = normaliseFieldValue(subfeature.fields[srcFieldId])
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
        const entityJiraKeys = jiraConnectionMap.get(subfeature.id)
        if (entityJiraKeys) {
          for (const { integrationId, destFieldId } of state.config.jiraIntegrationMappings) {
            const issueKey = entityJiraKeys.get(integrationId)
            if (issueKey) fields[destFieldId] = issueKey
          }
        }
      }

      if (state.config.sourceIdFieldId) fields[state.config.sourceIdFieldId] = subfeature.id

      const ownerEmail = on('owner')
        ? (subfeature.fields.owner as { email?: string } | undefined)?.email
        : undefined
      if (ownerEmail) {
        if (!destMemberEmails || destMemberEmails.has(ownerEmail.toLowerCase())) {
          fields.owner = { email: ownerEmail }
        } else {
          const warn = { step: 'subfeatures' as const, sourceId: subfeature.id, name: String(subfeature.fields.name), message: `Owner ${ownerEmail} not found in destination — created without owner`, severity: 'warning' as const }
          state.errors.push(warn)
          emit({ step: 'subfeatures', status: 'in_progress', migrated, total, error: warn })
        }
      }

      if (on('tags') && Array.isArray(subfeature.fields.tags) && subfeature.fields.tags.length > 0) {
        const keywords = state.config.tagKeywords ?? []
        const mode = state.config.tagMatchMode ?? 'contains'
        const tags = subfeature.fields.tags as { name: string }[]
        const matched = keywords.length > 0
          ? tags.filter((t) => keywords.some((kw) =>
              mode === 'exact'
                ? t.name.toLowerCase() === kw.toLowerCase()
                : t.name.toLowerCase().includes(kw.toLowerCase())
            ))
          : tags
        fields.tags = matched.map((t) => ({ name: t.name }))
      }

      const destReleaseId = entityReleaseMap?.get(subfeature.id)
      if (destReleaseId) {
        relationships.push({ type: 'link', target: { id: destReleaseId } })
      }

      const response = await dest.request<{ data: { id: string } }>('/v2/entities', {
        method: 'POST',
        body: JSON.stringify({ data: { type: 'subfeature', fields, relationships } }),
      })

      state.idMap.subfeatures[subfeature.id] = response.data.id
      migrated++
      await saveState(state)
      emit({ step: 'subfeatures', status: 'in_progress', migrated, total })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const err = {
        step: 'subfeatures' as const,
        sourceId: subfeature.id,
        name: String(subfeature.fields.name),
        message,
        request: {
          method: 'POST',
          url: '/v2/entities',
          body: { data: { type: 'subfeature', fields, relationships: [{ type: 'parent', target: { id: destParentId } }] } },
        },
      }
      state.errors.push(err)
      await saveState(state)
      emit({ step: 'subfeatures', status: 'in_progress', migrated, total, error: err })
    }
  })

  state.steps.subfeatures = 'completed'
  await saveState(state)
  emit({ step: 'subfeatures', status: 'completed', migrated, total })
}
