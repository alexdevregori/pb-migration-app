'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ConfigForm } from '@/components/ConfigForm'
import { StatusSelector } from '@/components/StatusSelector'
import { ReleaseGroupSelector } from '@/components/ReleaseGroupSelector'
import { FieldSelector } from '@/components/FieldSelector'
import { MigrationDashboard } from '@/components/MigrationDashboard'
import type { WorkspaceInfo, ProgressEvent, StepStatus } from '@/lib/productboard/types'

type Panel = 'config' | 'settings' | 'running'

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  errors: string[]
}

export default function Home() {
  const [panel, setPanel] = useState<Panel>('config')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const [sourceKey, setSourceKey] = useState('')
  const [destKey, setDestKey] = useState('')
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null)

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedReleaseGroups, setSelectedReleaseGroups] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>([])

  const [progress, setProgress] = useState<Record<string, StepState>>({})
  const [hasPriorRun, setHasPriorRun] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetch('/api/migrate')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.hasPriorRun) setHasPriorRun(true) })
      .catch(() => {})
  }, [])

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
      const info: WorkspaceInfo = await res.json()
      setSourceKey(src)
      setDestKey(dest)
      setWorkspaceInfo(info)
      setPanel('settings')
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnectLoading(false)
    }
  }

  const handleProgress = useCallback((event: ProgressEvent) => {
    setProgress((prev) => {
      const current = prev[event.step] ?? { status: 'pending', errors: [] }
      return {
        ...prev,
        [event.step]: {
          status: event.status,
          migrated: event.migrated ?? current.migrated,
          total: event.total ?? current.total,
          errors: event.error
            ? [...current.errors, `${event.error.name}: ${event.error.message}`]
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

  async function startMigration(resume = false) {
    if (isMigrating) return
    setIsMigrating(true)
    setPanel('running')
    startListening()

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceApiKey: sourceKey,
          destinationApiKey: destKey,
          selectedStatuses,
          selectedReleaseGroups,
          selectedFields,
          resume,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start migration' }))
        throw new Error(err.error || 'Failed to start migration')
      }
    } catch (e: unknown) {
      setPanel('settings')
      setConnectError(e instanceof Error ? e.message : 'Failed to start migration')
      setIsMigrating(false)
    }
  }

  return (
    <main>
      {/* Page header */}
      <div className="mb-6">
        <h1 style={{ color: '#1a1523', fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Workspace Migration
        </h1>
        <p style={{ color: '#6e6882', fontSize: '14px', marginTop: '4px' }}>
          Copy products, features, releases, and notes between Productboard workspaces.
        </p>
      </div>

      {/* Step breadcrumb */}
      <StepBreadcrumb current={panel} />

      {panel === 'config' && (
        <Card>
          <CardHeader title="Connect workspaces" subtitle="Enter API keys for both workspaces to get started." />
          <ConfigForm
            onConnect={handleConnect}
            loading={connectLoading}
            error={connectError}
          />
        </Card>
      )}

      {panel === 'settings' && workspaceInfo && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="What to migrate" subtitle="Choose which features and releases to include." />
            <div className="space-y-6">
              <StatusSelector
                statuses={workspaceInfo.statuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
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
            </div>
          </Card>

          {connectError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ color: '#DC2626', fontSize: '13px' }}>{connectError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <PrimaryButton onClick={() => startMigration(false)} disabled={isMigrating}>
              Start migration
            </PrimaryButton>
            {hasPriorRun && (
              <SecondaryButton onClick={() => startMigration(true)} disabled={isMigrating}>
                Resume previous run
              </SecondaryButton>
            )}
          </div>
        </div>
      )}

      {panel === 'running' && (
        <Card>
          <CardHeader title="Migration in progress" subtitle="Each step runs in order. Errors on individual items are logged but won't stop the migration." />
          <MigrationDashboard progress={progress} />
        </Card>
      )}
    </main>
  )
}

// ── Local UI primitives ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e5ed',
      borderRadius: '12px',
      padding: '24px',
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ color: '#1a1523', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{title}</h2>
      <p style={{ color: '#6e6882', fontSize: '13px' }}>{subtitle}</p>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#f0edf5', margin: '0 -24px' }} />
}

function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#c4afd8' : '#6B2FA0',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 18px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: '#ffffff',
        color: disabled ? '#c4afd8' : '#6B2FA0',
        border: `1px solid ${disabled ? '#e8e5ed' : '#6B2FA0'}`,
        borderRadius: '8px',
        padding: '8px 18px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function StepBreadcrumb({ current }: { current: Panel }) {
  const steps: { id: Panel; label: string }[] = [
    { id: 'config', label: 'Connect' },
    { id: 'settings', label: 'Configure' },
    { id: 'running', label: 'Migrate' },
  ]
  const currentIndex = steps.findIndex((s) => s.id === current)

  return (
    <div className="flex items-center gap-2 mb-5">
      {steps.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                background: done ? '#6B2FA0' : active ? '#EDE4F5' : '#e8e5ed',
                color: done ? '#ffffff' : active ? '#6B2FA0' : '#a89bb8',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: active ? 600 : 400,
                color: active ? '#1a1523' : done ? '#6B2FA0' : '#a89bb8',
              }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '24px', height: '1px', background: '#e8e5ed' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
