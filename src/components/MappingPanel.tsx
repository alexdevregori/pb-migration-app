'use client'

import { useRef } from 'react'
import type { PBStatus, PBFieldConfig } from '@/lib/productboard/types'

export interface MappingConfig {
  statusMapping: Record<string, string>   // source status name  → dest status ID
  fieldMapping:  Record<string, string>   // source field UUID   → dest field UUID
}

interface Props {
  // Source items (only the ones the user selected in Configure)
  selectedStatuses: string[]          // source status names
  selectedFields:   string[]          // source field UUIDs
  // Full lists from both workspaces
  sourceStatuses:   PBStatus[]
  destStatuses:     PBStatus[]
  sourceFields:     PBFieldConfig[]
  destFields:       PBFieldConfig[]
  // Current mapping state
  mapping:   MappingConfig
  onChange:  (next: MappingConfig) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingPanel({
  selectedStatuses, selectedFields,
  sourceStatuses, destStatuses,
  sourceFields, destFields,
  mapping, onChange,
}: Props) {
  const showStatuses = selectedStatuses.length > 0
  const showFields   = selectedFields.length > 0

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
            sourceItems={selectedStatuses.map((name) => {
              const s = sourceStatuses.find((x) => x.name === name)
              return { id: name, label: name, sublabel: s?.id }
            })}
            destItems={destStatuses.map((s) => ({ id: s.id, label: s.name }))}
            mapping={mapping.statusMapping}
            onMap={(srcId, destId) => setStatusMapping(srcId, destId)}
            onUnmap={(srcId) => setStatusMapping(srcId, null)}
            emptyDestMessage="No statuses found in destination workspace."
            dragType="status"
          />
        </section>
      )}

      {showStatuses && showFields && <Divider />}

      {showFields && (
        <section>
          <SectionHeader
            title="Custom field mapping"
            subtitle="Match each source custom field to the corresponding field in the destination workspace. Values for unmapped fields will be skipped."
            unmapped={unmappedFields.length}
            total={selectedFields.length}
          />
          <MappingTable
            sourceItems={selectedFields.map((id) => {
              const f = sourceFields.find((x) => x.id === id)
              return { id, label: f?.name ?? id, sublabel: f?.schema?.type }
            })}
            destItems={destFields.map((f) => ({ id: f.id, label: f.name, sublabel: f.schema?.type }))}
            mapping={mapping.fieldMapping}
            onMap={(srcId, destId) => setFieldMapping(srcId, destId)}
            onUnmap={(srcId) => setFieldMapping(srcId, null)}
            emptyDestMessage="No custom fields found in destination workspace."
            dragType="field"
          />
        </section>
      )}

      {!showStatuses && !showFields && (
        <p style={{ color: '#a89bb8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
          No statuses or custom fields were selected — nothing to map.
        </p>
      )}
    </div>
  )
}

// ─── MappingTable ─────────────────────────────────────────────────────────────

interface SourceItem { id: string; label: string; sublabel?: string }
interface DestItem   { id: string; label: string; sublabel?: string }

function MappingTable({
  sourceItems, destItems, mapping, onMap, onUnmap, emptyDestMessage, dragType,
}: {
  sourceItems:        SourceItem[]
  destItems:          DestItem[]
  mapping:            Record<string, string>
  onMap:              (srcId: string, destId: string) => void
  onUnmap:            (srcId: string) => void
  emptyDestMessage:   string
  dragType:           string
}) {
  const draggingSrc = useRef<string | null>(null)

  if (destItems.length === 0) {
    return <p style={{ color: '#a89bb8', fontSize: '13px' }}>{emptyDestMessage}</p>
  }

  // Dest items that have already been mapped by some source item
  const usedDestIds = new Set(Object.values(mapping))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0 16px', alignItems: 'start' }}>
      {/* Column headers */}
      <ColHeader>Source workspace</ColHeader>
      <div />
      <ColHeader>Destination workspace</ColHeader>

      {/* Rows — one per source item */}
      {sourceItems.map((src) => {
        const mappedDestId  = mapping[src.id]
        const mappedDest    = destItems.find((d) => d.id === mappedDestId)
        const isMapped      = !!mappedDestId

        return (
          <div key={src.id} style={{ display: 'contents' }}>
            {/* Source chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <Chip
                label={src.label}
                sublabel={src.sublabel}
                variant={isMapped ? 'mapped' : 'unmapped'}
                draggable
                onDragStart={() => { draggingSrc.current = src.id }}
                onDragEnd={() => { draggingSrc.current = null }}
              />
            </div>

            {/* Arrow */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <path d="M0 6h20M15 1l5 5-5 5" stroke={isMapped ? '#6B2FA0' : '#d4cede'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Drop zone */}
            <div
              style={{ padding: '6px 0' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingSrc.current) {
                  // If this dest was already claimed by another source, unmap it first
                  const prevSrc = Object.entries(mapping).find(([, dId]) => dId === src.id)?.[0]
                  if (prevSrc) onUnmap(prevSrc)
                  onMap(draggingSrc.current, src.id)
                  draggingSrc.current = null
                }
              }}
            >
              {isMapped ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Chip label={mappedDest?.label ?? mappedDestId} sublabel={mappedDest?.sublabel} variant="mapped" />
                  <button
                    onClick={() => onUnmap(src.id)}
                    title="Remove mapping"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#a89bb8', fontSize: '14px', padding: '0 2px', lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <DropZone
                  onDrop={(destId) => onMap(src.id, destId)}
                  draggingSrc={draggingSrc}
                  srcId={src.id}
                  dragType={dragType}
                />
              )}
            </div>
          </div>
        )
      })}

      {/* Divider */}
      <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f0edf5', margin: '8px 0' }} />

      {/* Destination pool — unmapped dest items available to drag from */}
      <div style={{ gridColumn: '1 / -1' }}>
        <p style={{ fontSize: '12px', color: '#a89bb8', margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Destination options — drag onto a source row above
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {destItems.map((dest) => {
            const alreadyUsed = usedDestIds.has(dest.id)
            return (
              <div
                key={dest.id}
                draggable={!alreadyUsed}
                onDragStart={(e) => {
                  if (alreadyUsed) { e.preventDefault(); return }
                  e.dataTransfer.setData(`dest-${dragType}`, dest.id)
                  // Store for cross-zone drop handling
                  ;(window as typeof window & { _dragDestId?: string })._dragDestId = dest.id
                }}
                style={{ opacity: alreadyUsed ? 0.35 : 1, cursor: alreadyUsed ? 'default' : 'grab' }}
              >
                <Chip
                  label={dest.label}
                  sublabel={dest.sublabel}
                  variant={alreadyUsed ? 'used' : 'dest'}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({
  onDrop, draggingSrc, srcId, dragType,
}: {
  onDrop:       (destId: string) => void
  draggingSrc:  React.MutableRefObject<string | null>
  srcId:        string
  dragType:     string
}) {
  const isOver = useRef(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        isOver.current = true
      }}
      onDragLeave={() => { isOver.current = false }}
      onDrop={(e) => {
        e.preventDefault()
        isOver.current = false
        // Accept drags from the destination pool
        const destId = e.dataTransfer.getData(`dest-${dragType}`)
          || (window as typeof window & { _dragDestId?: string })._dragDestId
        if (destId) {
          onDrop(destId)
          ;(window as typeof window & { _dragDestId?: string })._dragDestId = undefined
        }
      }}
      style={{
        minWidth: '120px',
        minHeight: '32px',
        border: '1.5px dashed #d4c2e8',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 10px',
        background: '#faf6ff',
        color: '#c4afd8',
        fontSize: '12px',
        cursor: 'default',
        transition: 'border-color 0.15s',
      }}
    >
      Drop destination here
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

type ChipVariant = 'mapped' | 'unmapped' | 'dest' | 'used'

function Chip({
  label, sublabel, variant, draggable, onDragStart, onDragEnd,
}: {
  label:       string
  sublabel?:   string
  variant:     ChipVariant
  draggable?:  boolean
  onDragStart?: () => void
  onDragEnd?:   () => void
}) {
  const styles: Record<ChipVariant, React.CSSProperties> = {
    mapped:   { background: '#EDE4F5', border: '1px solid #d4c2e8', color: '#6B2FA0' },
    unmapped: { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#C2410C' },
    dest:     { background: '#ffffff', border: '1px solid #d4cede', color: '#1a1523' },
    used:     { background: '#f5f5f5', border: '1px solid #e0e0e0', color: '#a0a0a0' },
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
        ...styles[variant],
      }}
    >
      <span>{label}</span>
      {sublabel && (
        <span style={{ fontSize: '10px', opacity: 0.6, fontWeight: 400 }}>{sublabel}</span>
      )}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 600,
      color: '#a89bb8',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      paddingBottom: '10px',
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
    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1523', margin: '0 0 3px' }}>{title}</h3>
        <p style={{ fontSize: '12px', color: '#a89bb8', margin: 0 }}>{subtitle}</p>
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
  return <div style={{ height: '1px', background: '#f0edf5', margin: '0 -24px' }} />
}

// ─── Auto-map helper (exported for use in page.tsx) ───────────────────────────

/** Pre-populate mappings where source and destination names match exactly (case-insensitive). */
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
    const dest = destFields.find((d) => d.name.toLowerCase() === src.name.toLowerCase())
    if (dest) fieldMapping[srcId] = dest.id
  }

  return { statusMapping, fieldMapping }
}
