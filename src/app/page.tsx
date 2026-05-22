'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ConfigForm } from '@/components/ConfigForm'
import { StatusSelector } from '@/components/StatusSelector'
import { ReleaseGroupSelector } from '@/components/ReleaseGroupSelector'
import { FieldSelector } from '@/components/FieldSelector'
import { MigrationDashboard } from '@/components/MigrationDashboard'
import { MappingPanel, autoMap } from '@/components/MappingPanel'
import type { MappingConfig } from '@/components/MappingPanel'
import { NoteFilterSelector } from '@/components/NoteFilterSelector'
import { JiraIntegrationSelector } from '@/components/JiraIntegrationSelector'
import { SourceIdSelector } from '@/components/SourceIdSelector'
import type { NoteFilterConfig } from '@/components/NoteFilterSelector'
import { ProductSelector } from '@/components/ProductSelector'
import { FeatureFieldSelector, ALL_FEATURE_FIELDS } from '@/components/FeatureFieldSelector'
import type { ProgressEvent, StepStatus, StepName, MigrationError } from '@/lib/productboard/types'
import { LogDrawer } from '@/components/LogDrawer'
import { useWorkspace } from '@/components/WorkspaceContext'

type Panel = 'config' | 'settings' | 'mapping' | 'running'

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  message?: string
  errors: MigrationError[]
}

const PANELS: { id: Panel; label: string }[] = [
  { id: 'config',   label: 'Connect'   },
  { id: 'settings', label: 'Configure' },
  { id: 'mapping',  label: 'Map'       },
  { id: 'running',  label: 'Migrate'   },
]

export default function Home() {
  const [panel, setPanel] = useState<Panel>('config')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const [sourceKey, setSourceKey] = useState('')
  const [destKey, setDestKey] = useState('')
  const { workspaceInfo, setWorkspaceInfo } = useWorkspace()

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedReleaseGroups, setSelectedReleaseGroups] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [selectedFeatureFields, setSelectedFeatureFields] = useState<string[]>(ALL_FEATURE_FIELDS.filter((f) => f !== 'tags'))
  const [tagKeywords, setTagKeywords] = useState<string[]>([])
  const [tagMatchMode, setTagMatchMode] = useState<'contains' | 'exact'>('contains')

  const [mapping, setMapping] = useState<MappingConfig>({ statusMapping: {}, fieldMapping: {} })
  const [includeSourceId, setIncludeSourceId] = useState(false)
  const [sourceIdFieldId, setSourceIdFieldId] = useState<string | null>(null)
  const [selectedJiraIds, setSelectedJiraIds] = useState<string[]>([])
  const [jiraIntegrationMappings, setJiraIntegrationMappings] = useState<Array<{ integrationId: string; destFieldId: string }>>([])
  const [noteFilter, setNoteFilter] = useState<NoteFilterConfig>({
    includeLinkedNotes: false,
    linkedNotesMaxAgeDays: null,
    includeNotesLinkedToNonMigratedFeatures: false,
    nonMigratedLinkedNotesMaxAgeDays: null,
    includeUnprocessedOrphanNotes: false,
    unprocessedOrphanNotesMaxAgeDays: null,
    includeProcessedOrphanNotes: false,
    processedOrphanNotesMaxAgeDays: null,
    appendSourceOwnerOnUnassigned: false,
  })

  const [progress, setProgress] = useState<Record<string, StepState>>({})
  const [isMigrating, setIsMigrating] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  const migratingFeatures = selectedProducts.length > 0 && selectedStatuses.length > 0
  const activeSteps: StepName[] = [
    ...(migratingFeatures ? [
      'discovery', 'migrationProduct', 'products', 'components',
      ...(selectedReleaseGroups.length > 0 ? ['releaseGroups', 'releases'] as StepName[] : []),
      'features', 'subfeatures',
      ...(selectedFeatureFields.includes('dependencies') ? ['dependencies'] as StepName[] : []),
    ] as StepName[] : []),
    ...((noteFilter.includeLinkedNotes || noteFilter.includeNotesLinkedToNonMigratedFeatures || noteFilter.includeUnprocessedOrphanNotes || noteFilter.includeProcessedOrphanNotes)
      ? ['discoverNotes', 'companies', 'users', 'notes'] as StepName[]
      : []),
  ]

  const isComplete =
    activeSteps.length > 0 &&
    activeSteps.every((step) => {
      const s = progress[step]?.status
      return s === 'completed' || s === 'failed'
    })

  const esRef = useRef<EventSource | null>(null)

  // Auto-detect when the last step finishes so the "Start new" button appears
  useEffect(() => {
    if (!isMigrating || !isComplete) return
    setIsMigrating(false)
    esRef.current?.close()
  }, [isMigrating, isComplete])

  useEffect(() => {
    return () => { esRef.current?.close() }
  }, [])

  async function handleConnect(src: string, dest: string) {
    setConnectLoading(true)
    setConnectError(null)
    try {
      const res = await fetch(
        `/api/workspaces?sourceKey=${encodeURIComponent(src)}&destKey=${encodeURIComponent(dest)}`
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Connection failed')
      }
      const info = await res.json()
      setSourceKey(src)
      setDestKey(dest)
      setWorkspaceInfo(info)
      navigateTo('settings')
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnectLoading(false)
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigateTo(p: Panel) {
    setPanel(p)
    scrollToTop()
  }

  function handleAdvanceToMapping() {
    if (!workspaceInfo) return
    if (selectedProducts.length > 0 && selectedStatuses.length === 0) {
      setConnectError('Select at least one status when products are selected.')
      return
    }
    setConnectError(null)
    const autoMapped = autoMap(
      selectedStatuses, selectedFields,
      workspaceInfo.statuses, workspaceInfo.destStatuses,
      workspaceInfo.customFields, workspaceInfo.destCustomFields,
    )
    setMapping((prev) => ({
      statusMapping: { ...autoMapped.statusMapping, ...prev.statusMapping },
      fieldMapping:  { ...autoMapped.fieldMapping,  ...prev.fieldMapping  },
    }))
    navigateTo('mapping')
  }

  const handleProgress = useCallback((event: ProgressEvent) => {
    setProgress((prev) => {
      const current = prev[event.step] ?? { status: 'pending', errors: [] }
      return {
        ...prev,
        [event.step]: {
          status: event.status,
          migrated: event.migrated ?? current.migrated,
          total:    event.total    ?? current.total,
          message:  event.message  ?? current.message,
          errors: event.error
            ? [...current.errors, event.error]
            : current.errors,
        },
      }
    })
  }, [])

  function startListening() {
    esRef.current?.close()
    const es = new EventSource('/api/status')
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const event: ProgressEvent = JSON.parse(e.data)
        handleProgress(event)
      } catch {
        // ignore malformed SSE frames
      }
    }
    es.onerror = () => es.close()
  }

  function handleNewMigration() {
    esRef.current?.close()
    setIsMigrating(false)
    setProgress({})
    setSourceKey('')
    setDestKey('')
    setWorkspaceInfo(null)
    setSelectedStatuses([])
    setSelectedProducts([])
    setSelectedReleaseGroups([])
    setSelectedFields([])
    setSelectedFeatureFields(ALL_FEATURE_FIELDS.filter((f) => f !== 'tags'))
    setTagKeywords([])
    setTagMatchMode('contains')
    setMapping({ statusMapping: {}, fieldMapping: {} })
    setSelectedJiraIds([])
    setJiraIntegrationMappings([])
    setNoteFilter({ includeLinkedNotes: false, linkedNotesMaxAgeDays: null, includeNotesLinkedToNonMigratedFeatures: false, nonMigratedLinkedNotesMaxAgeDays: null, includeUnprocessedOrphanNotes: false, unprocessedOrphanNotesMaxAgeDays: null, includeProcessedOrphanNotes: false, processedOrphanNotesMaxAgeDays: null, appendSourceOwnerOnUnassigned: false })
    setConnectError(null)
    navigateTo('config')
  }

  const [refreshing, setRefreshing] = useState(false)

  async function handleRefreshWorkspace() {
    if (!sourceKey || !destKey || !workspaceInfo || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(
        `/api/workspaces?sourceKey=${encodeURIComponent(sourceKey)}&destKey=${encodeURIComponent(destKey)}`
      )
      if (!res.ok) return
      const info = await res.json()
      setWorkspaceInfo(info)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRefreshDestFields() {
    if (!sourceKey || !destKey || !workspaceInfo) return
    const res = await fetch(
      `/api/workspaces?sourceKey=${encodeURIComponent(sourceKey)}&destKey=${encodeURIComponent(destKey)}`
    )
    if (!res.ok) return
    const info = await res.json()
    setWorkspaceInfo({ ...workspaceInfo, destCustomFields: info.destCustomFields })
  }

  async function handleRunAgain() {
    setProgress({})
    await startMigration()
  }

  async function startMigration() {
    if (isMigrating) return
    setIsMigrating(true)
    navigateTo('running')
    startListening()

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceApiKey:                  sourceKey,
          destinationApiKey:             destKey,
          selectedStatuses,
          selectedProducts,
          selectedReleaseGroups,
          selectedFields,
          selectedFeatureFields,
          tagKeywords,
          tagMatchMode,
          statusMapping:                 mapping.statusMapping,
          fieldMapping:                  mapping.fieldMapping,
          sourceIdFieldId:               sourceIdFieldId ?? undefined,
          jiraIntegrationMappings,
          includeLinkedNotes:                      noteFilter.includeLinkedNotes,
          linkedNotesMaxAgeDays:                   noteFilter.linkedNotesMaxAgeDays,
          includeNotesLinkedToNonMigratedFeatures: noteFilter.includeNotesLinkedToNonMigratedFeatures,
          nonMigratedLinkedNotesMaxAgeDays:        noteFilter.nonMigratedLinkedNotesMaxAgeDays,
          includeUnprocessedOrphanNotes:           noteFilter.includeUnprocessedOrphanNotes,
          unprocessedOrphanNotesMaxAgeDays:        noteFilter.unprocessedOrphanNotesMaxAgeDays,
          includeProcessedOrphanNotes:             noteFilter.includeProcessedOrphanNotes,
          processedOrphanNotesMaxAgeDays:          noteFilter.processedOrphanNotesMaxAgeDays,
          appendSourceOwnerOnUnassigned:           noteFilter.appendSourceOwnerOnUnassigned,
          destCustomFields:                        workspaceInfo?.destCustomFields ?? [],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start migration' }))
        throw new Error(err.error || 'Failed to start migration')
      }
    } catch (e: unknown) {
      navigateTo('mapping')
      setConnectError(e instanceof Error ? e.message : 'Failed to start migration')
      setIsMigrating(false)
    }
  }

  return (
    <main>
      <div className="mb-6">
        <h1 style={{ color: '#000C2C', fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Workspace Migration
        </h1>
        <p style={{ color: '#5F677B', fontSize: '14px', marginTop: '4px' }}>
          Copy products, features, releases, and notes between Productboard workspaces.
        </p>
      </div>

      <StepBreadcrumb current={panel} />

      {/* ── Panel 1: Connect ── */}
      {panel === 'config' && (
        <Card>
          <CardHeader title="Connect workspaces" subtitle="Enter API keys for both workspaces to get started." />
          <ConfigForm onConnect={handleConnect} loading={connectLoading} error={connectError} />
        </Card>
      )}

      {/* ── Panel 2: Configure ── */}
      {panel === 'settings' && workspaceInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardHeader
              title="What to migrate"
              subtitle="Choose which features and releases to include."
              action={<RefreshButton onClick={handleRefreshWorkspace} loading={refreshing} />}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ProductSelector
                products={workspaceInfo.products}
                selected={selectedProducts}
                onChange={setSelectedProducts}
              />
              <Divider />
              <StatusSelector
                statuses={workspaceInfo.statuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
              <Divider />
              <FeatureFieldSelector
                selected={selectedFeatureFields}
                onChange={setSelectedFeatureFields}
                tagKeywords={tagKeywords}
                onTagKeywordsChange={setTagKeywords}
                tagMatchMode={tagMatchMode}
                onTagMatchModeChange={setTagMatchMode}
              />
              <Divider />
              <ReleaseGroupSelector
                releaseGroups={workspaceInfo.releaseGroups}
                selected={selectedReleaseGroups}
                onChange={setSelectedReleaseGroups}
              />
              {workspaceInfo.customFields.length > 0 && (
                <>
                  <Divider />
                  <FieldSelector
                    fields={workspaceInfo.customFields}
                    selected={selectedFields}
                    onChange={setSelectedFields}
                  />
                </>
              )}
              <Divider />
              <NoteFilterSelector config={noteFilter} onChange={setNoteFilter} />
              <Divider />
              <JiraIntegrationSelector
                integrations={workspaceInfo.jiraIntegrations ?? []}
                selectedIds={selectedJiraIds}
                onChange={setSelectedJiraIds}
              />
              <Divider />
              <SourceIdSelector
                enabled={includeSourceId}
                onChange={(val) => {
                  setIncludeSourceId(val)
                  if (!val) setSourceIdFieldId(null)
                }}
              />
            </div>
          </Card>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <PrimaryButton onClick={handleAdvanceToMapping}>
              Next: Map statuses &amp; fields →
            </PrimaryButton>
            <span style={{ fontSize: '12px', color: '#8F96A7' }}>
              {selectedProducts.length === 0 ? 'No products' : `${selectedProducts.length} product${selectedProducts.length !== 1 ? 's' : ''}`}
              {' · '}
              {selectedStatuses.length === 0 ? 'No statuses' : `${selectedStatuses.length} status${selectedStatuses.length !== 1 ? 'es' : ''}`}
              {' · '}
              {selectedReleaseGroups.length} release group{selectedReleaseGroups.length !== 1 ? 's' : ''}
              {' · '}
              {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}

      {/* ── Panel 3: Map ── */}
      {panel === 'mapping' && workspaceInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardHeader
              title="Map to destination"
              subtitle="Drag destination statuses and fields onto their source counterparts. Exact name matches were auto-filled."
              action={<RefreshButton onClick={handleRefreshWorkspace} loading={refreshing} />}
            />
            <MappingPanel
              selectedStatuses={selectedStatuses}
              selectedFields={selectedFields}
              sourceStatuses={workspaceInfo.statuses}
              destStatuses={workspaceInfo.destStatuses}
              sourceFields={workspaceInfo.customFields}
              destFields={workspaceInfo.destCustomFields}
              mapping={mapping}
              onChange={setMapping}
              includeSourceId={includeSourceId}
              sourceIdFieldId={sourceIdFieldId}
              onSourceIdFieldChange={setSourceIdFieldId}
              selectedJiraIntegrations={(workspaceInfo.jiraIntegrations ?? []).filter((j) => selectedJiraIds.includes(j.id))}
              jiraIntegrationMappings={jiraIntegrationMappings}
              onJiraIntegrationMappingsChange={setJiraIntegrationMappings}
              onRefreshDestFields={handleRefreshDestFields}
            />
          </Card>

          {connectError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ color: '#DC2626', fontSize: '13px', margin: 0 }}>{connectError}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SecondaryButton onClick={() => navigateTo('settings')} disabled={isMigrating}>
              ← Back
            </SecondaryButton>
            <PrimaryButton onClick={startMigration} disabled={isMigrating}>
              Start migration
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Panel 4: Running ── */}
      {panel === 'running' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isComplete && !isMigrating && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#22c55e', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                  <path d="M1 6L5 10L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#15803d', margin: 0 }}>Migration complete</p>
                <p style={{ fontSize: '13px', color: '#16a34a', margin: '2px 0 0' }}>
                  All steps finished. Check the logs below for any errors.
                </p>
              </div>
              <button
                onClick={handleRunAgain}
                style={{
                  background: '#ffffff', color: '#15803d',
                  border: '1px solid #86EFAC',
                  borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                ↺ Import again
              </button>
            </div>
          )}

          <Card>
            <CardHeader
              title={isMigrating ? 'Migration in progress' : 'Migration summary'}
              subtitle={isMigrating ? "Each step runs in order. Errors on individual items are logged but won't stop the migration." : ''}
            />
            <MigrationDashboard progress={progress} activeSteps={activeSteps} />

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {!isMigrating && (
                <SecondaryButton onClick={handleNewMigration}>
                  Start new migration
                </SecondaryButton>
              )}
              <LogsButton progress={progress} onClick={() => setShowLogs(true)} />
            </div>
          </Card>

          {showLogs && (
            <LogDrawer
              progress={progress}
              activeSteps={activeSteps}
              onClose={() => setShowLogs(false)}
            />
          )}
        </div>
      )}
    </main>
  )
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #E0E2E5', borderRadius: '12px', padding: '24px' }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <h2 style={{ color: '#000C2C', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{title}</h2>
        <p style={{ color: '#5F677B', fontSize: '13px', margin: 0 }}>{subtitle}</p>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#F0F2F5', margin: '0 -24px' }} />
}

function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="Refresh workspace fields"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: 'none',
        border: '1px solid #E0E2E5',
        borderRadius: '6px',
        padding: '5px 10px',
        fontSize: '12px',
        fontWeight: 500,
        color: loading ? '#8F96A7' : '#5F677B',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      <svg
        width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined}
      >
        <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5a4.5 4.5 0 0 1 3.182 1.318L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.5 1.5V4H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? '#93C5FD' : '#0079F2', color: '#ffffff', border: 'none',
      borderRadius: '8px', padding: '9px 20px', fontSize: '14px', fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: '#ffffff', color: disabled ? '#93C5FD' : '#0079F2',
      border: `1px solid ${disabled ? '#E0E2E5' : '#0079F2'}`,
      borderRadius: '8px', padding: '9px 20px', fontSize: '14px', fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  )
}

function LogsButton({ progress, onClick }: {
  progress: Record<string, { errors: MigrationError[] }>
  onClick: () => void
}) {
  const totalIssues = Object.values(progress).reduce((sum, s) => sum + (s.errors?.length ?? 0), 0)
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '1px solid #E0E2E5',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 500,
        color: '#5F677B',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '6px',
        marginLeft: 'auto',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M3 4h6M3 6h6M3 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      View log
      {totalIssues > 0 && (
        <span style={{
          background: '#FEF2F2', color: '#DC2626',
          fontSize: '10px', fontWeight: 700,
          padding: '1px 5px', borderRadius: '10px',
        }}>
          {totalIssues}
        </span>
      )}
    </button>
  )
}

function StepBreadcrumb({ current }: { current: Panel }) {
  const currentIndex = PANELS.findIndex((p) => p.id === current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '20px' }}>
      {PANELS.map((step, i) => {
        const done   = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px',
              background: active ? '#EFF6FF' : 'transparent' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700,
                background: done ? '#0079F2' : active ? '#0079F2' : '#E0E2E5',
                color: done || active ? '#ffffff' : '#8F96A7',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '13px', fontWeight: active ? 600 : 400,
                color: active ? '#0079F2' : done ? '#5F677B' : '#8F96A7',
              }}>
                {step.label}
              </span>
            </div>
            {i < PANELS.length - 1 && (
              <div style={{ width: '16px', height: '1px', background: '#E0E2E5', margin: '0 2px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
