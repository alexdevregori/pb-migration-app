'use client'

import { useState } from 'react'
import type { PBStatus, PBFieldConfig } from '@/lib/productboard/types'
import { deriveFieldType, isSelectType } from '@/lib/field-type'

export interface MappingConfig {
  statusMapping: Record<string, string>   // source status name  → dest status ID
  fieldMapping:  Record<string, string>   // source field UUID   → dest field UUID
}

interface Props {
  selectedStatuses: string[]
  selectedFields:   string[]
  sourceStatuses:   PBStatus[]
  destStatuses:     PBStatus[]
  sourceFields:     PBFieldConfig[]
  destFields:       PBFieldConfig[]
  mapping:   MappingConfig
  onChange:  (next: MappingConfig) => void
  // Source ID field
  includeSourceId?:       boolean
  sourceIdFieldId?:       string | null
  onSourceIdFieldChange?: (fieldId: string | null) => void
  // Jira integration mappings
  selectedJiraIntegrations?:       Array<{ id: string; name: string }>
  jiraIntegrationMappings?:        Array<{ integrationId: string; destFieldId: string }>
  onJiraIntegrationMappingsChange?: (mappings: Array<{ integrationId: string; destFieldId: string }>) => void
  onRefreshDestFields?: () => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingPanel({
  selectedStatuses, selectedFields,
  sourceStatuses, destStatuses,
  sourceFields, destFields,
  mapping, onChange,
  includeSourceId, sourceIdFieldId, onSourceIdFieldChange,
  selectedJiraIntegrations, jiraIntegrationMappings, onJiraIntegrationMappingsChange,
  onRefreshDestFields,
}: Props) {
  const showStatuses  = selectedStatuses.length > 0
  const showFields    = selectedFields.length > 0
  const showSourceId  = !!includeSourceId
  const showJira      = (selectedJiraIntegrations?.length ?? 0) > 0

  function setJiraDestField(integrationId: string, destFieldId: string | null) {
    const current = jiraIntegrationMappings ?? []
    const without = current.filter((m) => m.integrationId !== integrationId)
    const next = destFieldId ? [...without, { integrationId, destFieldId }] : without
    onJiraIntegrationMappingsChange?.(next)
  }

  const mappedJiraCount = (selectedJiraIntegrations ?? []).filter((i) =>
    (jiraIntegrationMappings ?? []).some((m) => m.integrationId === i.id)
  ).length

  function setStatusMapping(srcName: string, destId: string | null) {
    const next = { ...mapping.statusMapping }
    if (destId === null) delete next[srcName]
    else next[srcName] = destId
    onChange({ ...mapping, statusMapping: next })
  }

  function setFieldMapping(srcId: string, destId: string | null) {
    const next = { ...mapping.fieldMapping }
    if (destId === null) delete next[srcId]
    else next[srcId] = destId
    onChange({ ...mapping, fieldMapping: next })
  }

  const unmappedStatuses = selectedStatuses.filter((n) => !mapping.statusMapping[n])
  const unmappedFields   = selectedFields.filter((id) => !mapping.fieldMapping[id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {showStatuses && (
        <section>
          <SectionHeader
            title="Status mapping"
            subtitle="Match each source status to a status in the destination workspace. Features with unmapped statuses will be created without a status."
            unmapped={unmappedStatuses.length}
            total={selectedStatuses.length}
          />
          <MappingTable
            sourceItems={selectedStatuses.map((name) => ({ id: name, label: name }))}
            destItems={destStatuses.map((s) => ({ id: s.id, label: s.name }))}
            mapping={mapping.statusMapping}
            onMap={(srcId, destId) => setStatusMapping(srcId, destId)}
            onUnmap={(srcId) => setStatusMapping(srcId, null)}
            emptyDestMessage="No statuses found in destination workspace."
          />
        </section>
      )}

      {showStatuses && showFields && <Divider />}

      {showFields && (
        <section>
          <SectionHeader
            title="Custom field mapping"
            subtitle="Match each source custom field to the corresponding field in the destination workspace. Only fields of the same type are shown as options."
            unmapped={unmappedFields.length}
            total={selectedFields.length}
          />
          <FieldMappingTable
            selectedFields={selectedFields}
            sourceFields={sourceFields}
            destFields={destFields}
            mapping={mapping.fieldMapping}
            onMap={(srcId, destId) => setFieldMapping(srcId, destId)}
            onUnmap={(srcId) => setFieldMapping(srcId, null)}
            onRefreshDestFields={onRefreshDestFields}
          />
        </section>
      )}

      {showSourceId && (showStatuses || showFields) && <Divider />}

      {showSourceId && (
        <section>
          <SectionHeader
            title="Source ID field"
            subtitle="Write each entity's original source API ID to a text field in the destination. Useful for linking notes after import."
            unmapped={sourceIdFieldId ? 0 : 1}
            total={1}
          />
          <JiraFieldPicker
            integrationName="Source entity ID"
            destFields={destFields}
            value={sourceIdFieldId ?? null}
            onChange={(id) => onSourceIdFieldChange?.(id)}
          />
        </section>
      )}

      {showJira && (showStatuses || showFields || showSourceId) && <Divider />}


      {showJira && (
        <section>
          <SectionHeader
            title="Jira issue keys"
            subtitle="Choose a destination text field for each integration's issue key. Only text fields are shown."
            unmapped={(selectedJiraIntegrations?.length ?? 0) - mappedJiraCount}
            total={selectedJiraIntegrations?.length ?? 0}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(selectedJiraIntegrations ?? []).map((integration) => {
              const mapped = (jiraIntegrationMappings ?? []).find((m) => m.integrationId === integration.id)
              return (
                <JiraFieldPicker
                  key={integration.id}
                  integrationName={integration.name}
                  destFields={destFields}
                  value={mapped?.destFieldId ?? null}
                  onChange={(fieldId) => setJiraDestField(integration.id, fieldId)}
                />
              )
            })}
          </div>
        </section>
      )}

      {!showStatuses && !showFields && !showJira && !showSourceId && (
        <p style={{ color: '#8F96A7', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
          No statuses, custom fields, or integrations were selected — nothing to map.
        </p>
      )}
    </div>
  )
}

// ─── MappingTable ─────────────────────────────────────────────────────────────

interface SourceItem { id: string; label: string; sublabel?: string }
interface DestItem   { id: string; label: string; sublabel?: string }

function MappingTable({
  sourceItems, destItems, mapping, onMap, onUnmap, emptyDestMessage,
}: {
  sourceItems:      SourceItem[]
  destItems:        DestItem[]
  mapping:          Record<string, string>
  onMap:            (srcId: string, destId: string) => void
  onUnmap:          (srcId: string) => void
  emptyDestMessage: string
}) {
  if (destItems.length === 0) {
    return <p style={{ color: '#8F96A7', fontSize: '13px' }}>{emptyDestMessage}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr', gap: '0 12px', paddingBottom: '4px' }}>
        <ColHeader>Source</ColHeader>
        <div />
        <ColHeader>Destination</ColHeader>
      </div>

      {sourceItems.map((src) => {
        const mappedDestId = mapping[src.id]
        const isMapped     = !!mappedDestId

        return (
          <div
            key={src.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 20px 1fr',
              gap: '0 12px',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px solid ${isMapped ? '#BFDBFE' : '#E0E2E5'}`,
              background: isMapped ? '#F0F7FF' : '#FAFAFB',
            }}
          >
            {/* Source label */}
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#000C2C' }}>{src.label}</span>
              {src.sublabel && (
                <span style={{ fontSize: '11px', color: '#8F96A7', marginLeft: '6px' }}>{src.sublabel}</span>
              )}
            </div>

            {/* Arrow */}
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M0 5h12M8 1l4 4-4 4" stroke={isMapped ? '#0079F2' : '#CDCFD5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            {/* Destination dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={mappedDestId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') onUnmap(src.id)
                  else onMap(src.id, val)
                }}
                style={{
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  border: `1px solid ${isMapped ? '#BFDBFE' : '#CDCFD5'}`,
                  borderRadius: '6px',
                  padding: '6px 28px 6px 10px',
                  fontSize: '13px',
                  fontWeight: isMapped ? 500 : 400,
                  color: isMapped ? '#0079F2' : '#8F96A7',
                  background: isMapped ? '#EFF6FF' : '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">— not mapped —</option>
                {destItems.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}{d.sublabel ? ` (${d.sublabel})` : ''}
                  </option>
                ))}
              </select>
              {/* Custom chevron */}
              <svg
                width="10" height="6" viewBox="0 0 10 6" fill="none"
                style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <path d="M1 1l4 4 4-4" stroke={isMapped ? '#0079F2' : '#8F96A7'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── FieldMappingTable ────────────────────────────────────────────────────────

function FieldMappingTable({
  selectedFields, sourceFields, destFields, mapping, onMap, onUnmap, onRefreshDestFields,
}: {
  selectedFields:       string[]
  sourceFields:         PBFieldConfig[]
  destFields:           PBFieldConfig[]
  mapping:              Record<string, string>
  onMap:                (srcId: string, destId: string) => void
  onUnmap:              (srcId: string) => void
  onRefreshDestFields?: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    if (!onRefreshDestFields || refreshing) return
    setRefreshing(true)
    try { await onRefreshDestFields() } finally { setRefreshing(false) }
  }

  if (destFields.length === 0) {
    return <p style={{ color: '#8F96A7', fontSize: '13px' }}>No custom fields found in destination workspace.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr', gap: '0 12px', paddingBottom: '4px' }}>
        <ColHeader>Source</ColHeader>
        <div />
        <ColHeader>Destination</ColHeader>
      </div>

      {selectedFields.map((srcId) => {
        const srcField    = sourceFields.find((x) => x.id === srcId)
        const srcType     = srcField?.schema ? deriveFieldType(srcField.schema) : undefined
        const mappedDestId = mapping[srcId]
        const isMapped     = !!mappedDestId

        // Only show dest fields of the same derived type
        const compatibleDest = destFields.filter((d) =>
          d.name?.trim() &&
          (srcType === undefined || deriveFieldType(d.schema) === srcType)
        )

        // Missing values warning for select fields
        let missingValues: string[] = []
        if (isMapped && srcField?.schema && isSelectType(srcField.schema)) {
          const destField = destFields.find((d) => d.id === mappedDestId)
          if (srcField.values?.data && destField?.values?.data) {
            const destNames = new Set(destField.values.data.map((v) => v.name.trim().toLowerCase()))
            missingValues = srcField.values.data
              .map((v) => v.name)
              .filter((name) => !destNames.has(name.trim().toLowerCase()))
          }
        }

        return (
          <div key={srcId}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 20px 1fr',
                gap: '0 12px',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: missingValues.length > 0 ? '8px 8px 0 0' : '8px',
                border: `1px solid ${isMapped ? '#BFDBFE' : '#E0E2E5'}`,
                borderBottom: missingValues.length > 0 ? 'none' : undefined,
                background: isMapped ? '#F0F7FF' : '#FAFAFB',
              }}
            >
              {/* Source label */}
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#000C2C' }}>
                  {srcField?.name ?? srcId}
                </span>
                {srcType && (
                  <span style={{ fontSize: '11px', color: '#8F96A7', marginLeft: '6px' }}>{srcType}</span>
                )}
              </div>

              {/* Arrow */}
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M0 5h12M8 1l4 4-4 4" stroke={isMapped ? '#0079F2' : '#CDCFD5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              {/* Destination dropdown — same-type only */}
              <div style={{ position: 'relative' }}>
                <select
                  value={mappedDestId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      onUnmap(srcId)
                    } else {
                      onMap(srcId, val)
                      // Auto-refresh dest field values in the background so the
                      // missing values warning reflects the newly selected field
                      onRefreshDestFields?.()
                    }
                  }}
                  style={{
                    width: '100%',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    border: `1px solid ${isMapped ? '#BFDBFE' : '#CDCFD5'}`,
                    borderRadius: '6px',
                    padding: '6px 28px 6px 10px',
                    fontSize: '13px',
                    fontWeight: isMapped ? 500 : 400,
                    color: isMapped ? '#0079F2' : '#8F96A7',
                    background: isMapped ? '#EFF6FF' : '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="">— not mapped —</option>
                  {compatibleDest.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <svg
                  width="10" height="6" viewBox="0 0 10 6" fill="none"
                  style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <path d="M1 1l4 4 4-4" stroke={isMapped ? '#0079F2' : '#8F96A7'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Missing values warning */}
            {missingValues.length > 0 && (
              <div style={{
                padding: '8px 12px',
                border: '1px solid #FED7AA',
                borderTop: '1px solid #FFEDD5',
                borderRadius: '0 0 8px 8px',
                background: '#FFF7ED',
                fontSize: '12px',
                color: '#C2410C',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <span>
                  <span style={{ fontWeight: 600 }}>⚠ {missingValues.length} value{missingValues.length !== 1 ? 's' : ''} missing from destination field — add before migrating: </span>
                  {missingValues.join(', ')}
                </span>
                {onRefreshDestFields && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: '1px solid #FED7AA',
                      borderRadius: '6px',
                      padding: '2px 10px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#C2410C',
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      minWidth: '100px',
                      justifyContent: 'center',
                    }}
                  >
                    {refreshing ? (
                      <>
                        <svg
                          width="11" height="11" viewBox="0 0 11 11" fill="none"
                          style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}
                        >
                          <circle cx="5.5" cy="5.5" r="4.5" stroke="#C2410C" strokeWidth="1.5" strokeOpacity="0.3"/>
                          <path d="M5.5 1C3.015 1 1 3.015 1 5.5" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        Checking…
                      </>
                    ) : (
                      <>↺ Check again</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 600,
      color: '#8F96A7',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle, unmapped, total }: {
  title:    string
  subtitle: string
  unmapped: number
  total:    number
}) {
  const allMapped = unmapped === 0
  return (
    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#000C2C', margin: '0 0 3px' }}>{title}</h3>
        <p style={{ fontSize: '12px', color: '#8F96A7', margin: 0 }}>{subtitle}</p>
      </div>
      <div style={{
        flexShrink: 0,
        fontSize: '12px',
        fontWeight: 500,
        padding: '3px 10px',
        borderRadius: '20px',
        background: allMapped ? '#ECFDF5' : '#FFF7ED',
        color: allMapped ? '#059669' : '#C2410C',
      }}>
        {allMapped ? `All ${total} mapped ✓` : `${total - unmapped} / ${total} mapped`}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#F0F2F5', margin: '0 -24px' }} />
}

// ─── JiraFieldPicker ──────────────────────────────────────────────────────────

function JiraFieldPicker({ integrationName, destFields, value, onChange }: {
  integrationName: string
  destFields:      PBFieldConfig[]
  value:           string | null
  onChange:        (id: string | null) => void
}) {
  // Only offer text-type fields as valid targets
  const textFields = destFields.filter((f) =>
    f.schema?.type === 'text' || f.schema?.type === 'string' || f.schema?.type === 'textarea'
  )

  if (textFields.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#8F96A7' }}>
        No text fields found in the destination workspace. Create one first, then re-connect.
      </p>
    )
  }

  const isMapped = !!value

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 20px 1fr',
      gap: '0 12px',
      alignItems: 'center',
      padding: '8px 10px',
      borderRadius: '8px',
      border: `1px solid ${isMapped ? '#BFDBFE' : '#E0E2E5'}`,
      background: isMapped ? '#F0F7FF' : '#FAFAFB',
    }}>
      {/* Source label — integration name */}
      <div>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#000C2C' }}>{integrationName}</span>
        <span style={{ fontSize: '11px', color: '#8F96A7', marginLeft: '6px' }}>issue key</span>
      </div>

      {/* Arrow */}
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M0 5h12M8 1l4 4-4 4" stroke={isMapped ? '#0079F2' : '#CDCFD5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      {/* Destination dropdown — text fields only */}
      <div style={{ position: 'relative' }}>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            border: `1px solid ${isMapped ? '#BFDBFE' : '#CDCFD5'}`,
            borderRadius: '6px',
            padding: '6px 28px 6px 10px',
            fontSize: '13px',
            fontWeight: isMapped ? 500 : 400,
            color: isMapped ? '#0079F2' : '#8F96A7',
            background: isMapped ? '#EFF6FF' : '#ffffff',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">— not mapped —</option>
          {textFields.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <path d="M1 1l4 4 4-4" stroke={isMapped ? '#0079F2' : '#8F96A7'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Auto-map helper (exported for use in page.tsx) ───────────────────────────

export function autoMap(
  selectedStatuses: string[],
  selectedFields:   string[],
  sourceStatuses:   PBStatus[],
  destStatuses:     PBStatus[],
  sourceFields:     PBFieldConfig[],
  destFields:       PBFieldConfig[],
): MappingConfig {
  const statusMapping: Record<string, string> = {}
  for (const name of selectedStatuses) {
    const dest = destStatuses.find((d) => d.name.toLowerCase() === name.toLowerCase())
    if (dest) statusMapping[name] = dest.id
  }

  const fieldMapping: Record<string, string> = {}
  for (const srcId of selectedFields) {
    const src  = sourceFields.find((f) => f.id === srcId)
    if (!src) continue
    const srcType = deriveFieldType(src.schema)
    const dest = destFields.find((d) =>
      d.name.toLowerCase() === src.name.toLowerCase() &&
      deriveFieldType(d.schema) === srcType
    )
    if (dest) fieldMapping[srcId] = dest.id
  }

  return { statusMapping, fieldMapping }
}
