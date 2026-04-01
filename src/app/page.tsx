'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConfigForm } from '@/components/ConfigForm'
import { StatusSelector } from '@/components/StatusSelector'
import { ReleaseGroupSelector } from '@/components/ReleaseGroupSelector'
import { FieldSelector } from '@/components/FieldSelector'
import { MigrationDashboard } from '@/components/MigrationDashboard'
import type { WorkspaceInfo, ProgressEvent, StepName, StepStatus } from '@/lib/productboard/types'

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

  // Check for prior run on mount — GET /api/migrate returns { hasPriorRun: boolean }
  useEffect(() => {
    fetch('/api/migrate')
      .then((r) => r.json())
      .then((data) => { if (data.hasPriorRun) setHasPriorRun(true) })
      .catch(() => {})
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
    const es = new EventSource('/api/status')
    es.onmessage = (e) => {
      const event: ProgressEvent = JSON.parse(e.data)
      handleProgress(event)
    }
    es.onerror = () => es.close()
  }

  async function startMigration(resume = false) {
    setPanel('running')
    startListening()

    await fetch('/api/migrate', {
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
  }

  return (
    <main>
      <h1 className="text-2xl font-bold mb-8">Productboard Migration Tool</h1>

      {panel === 'config' && (
        <section className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Connect Workspaces</h2>
          <ConfigForm
            onConnect={handleConnect}
            loading={connectLoading}
            error={connectError}
          />
        </section>
      )}

      {panel === 'settings' && workspaceInfo && (
        <section className="bg-white border rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold">Migration Settings</h2>
          <StatusSelector
            statuses={workspaceInfo.statuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <ReleaseGroupSelector
            releaseGroups={workspaceInfo.releaseGroups}
            selected={selectedReleaseGroups}
            onChange={setSelectedReleaseGroups}
          />
          <FieldSelector
            fields={workspaceInfo.customFields}
            selected={selectedFields}
            onChange={setSelectedFields}
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => startMigration(false)}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm"
            >
              Start Migration
            </button>
            {hasPriorRun && (
              <button
                onClick={() => startMigration(true)}
                className="border border-blue-600 text-blue-600 px-5 py-2 rounded text-sm"
              >
                Resume Previous Run
              </button>
            )}
          </div>
        </section>
      )}

      {panel === 'running' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Migration Progress</h2>
          <MigrationDashboard progress={progress} />
        </section>
      )}
    </main>
  )
}
