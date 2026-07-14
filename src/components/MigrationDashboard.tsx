'use client'

import { useState, useEffect, useRef } from 'react'
import type { StepName, StepStatus, MigrationError } from '@/lib/productboard/types'

const STEP_LABELS: Record<StepName, string> = {
  discovery: 'Discovering entity data',
  migrationProduct: 'Create Migration product',
  products: 'Products',
  components: 'Components',
  features: 'Features',
  subfeatures: 'Subfeatures',
  dependencies: 'Dependencies',
  releaseGroups: 'Release groups',
  releases: 'Releases',
  discoverNotes: 'Discovering note data',
  companies: 'Companies',
  users: 'Users',
  notes: 'Notes',
}

const STEP_ICONS: Record<StepName, string> = {
  discovery: '🔎',
  migrationProduct: '🏗',
  products: '📦',
  components: '🧩',
  features: '✨',
  subfeatures: '🔹',
  dependencies: '🔗',
  releaseGroups: '📅',
  releases: '🚀',
  discoverNotes: '🔍',
  companies: '🏢',
  users: '👤',
  notes: '📝',
}

const STEP_ORDER: StepName[] = [
  'discovery', 'migrationProduct', 'products', 'components', 'features', 'subfeatures', 'dependencies',
  'releaseGroups', 'releases', 'discoverNotes', 'companies', 'users', 'notes',
]

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  message?: string
  errors: MigrationError[]
}

interface Props {
  progress: Record<string, StepState>
  activeSteps: StepName[]
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function MigrationDashboard({ progress, activeSteps }: Props) {
  // Track start/end timestamps per step. Using refs so updates don't trigger re-renders.
  const stepStartTimes = useRef<Partial<Record<StepName, number>>>({})
  const stepEndTimes   = useRef<Partial<Record<StepName, number>>>({})
  // Tick counter to force re-render every second while something is running
  const [tick, setTick] = useState(0)

  // Record start/end times as statuses change
  useEffect(() => {
    for (const step of activeSteps) {
      const status = progress[step]?.status
      if (status === 'in_progress' && !stepStartTimes.current[step]) {
        stepStartTimes.current[step] = Date.now()
        stepEndTimes.current[step] = undefined
      }
      if ((status === 'completed' || status === 'failed') && stepStartTimes.current[step] && !stepEndTimes.current[step]) {
        stepEndTimes.current[step] = Date.now()
      }
    }
  }, [progress, activeSteps])

  // Tick every second while any step is in_progress
  useEffect(() => {
    const running = activeSteps.some((s) => progress[s]?.status === 'in_progress')
    if (!running) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [progress, activeSteps])

  const now = Date.now()

  // Per-step elapsed durations (ms)
  const stepDurations: Partial<Record<StepName, number>> = {}
  for (const step of activeSteps) {
    const start = stepStartTimes.current[step]
    if (!start) continue
    const end = stepEndTimes.current[step] ?? now
    stepDurations[step] = end - start
  }

  // Total: from first step start to last step end (or now if still running)
  const allStarts = Object.values(stepStartTimes.current).filter((v): v is number => v !== undefined)
  const allEnds   = activeSteps.map((s) => {
    const status = progress[s]?.status
    if (status === 'completed' || status === 'failed') return stepEndTimes.current[s]
    if (status === 'in_progress') return now
    return undefined
  }).filter((v): v is number => v !== undefined)

  const totalStart = allStarts.length > 0 ? Math.min(...allStarts) : null
  const totalEnd   = allEnds.length > 0   ? Math.max(...allEnds)   : null
  const totalMs    = totalStart !== null && totalEnd !== null ? totalEnd - totalStart : null

  const isRunning = activeSteps.some((s) => progress[s]?.status === 'in_progress')
  const isDone    = activeSteps.length > 0 && activeSteps.every((s) => {
    const st = progress[s]?.status
    return st === 'completed' || st === 'failed'
  })

  // Each step owns an equal slice of 100%.
  const stepWeight = activeSteps.length > 0 ? 100 / activeSteps.length : 0
  const pct = Math.round(
    activeSteps.reduce((sum, s) => {
      const st = progress[s]
      if (!st || st.status === 'pending') return sum
      if (st.status === 'completed' || st.status === 'failed') return sum + stepWeight
      if (st.total && st.total > 0) return sum + stepWeight * ((st.migrated ?? 0) / st.total)
      return sum
    }, 0)
  )

  return (
    <div>
      {/* Overall progress bar + total time */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', color: '#5F677B' }}>Overall progress</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {totalMs !== null && (
              <span style={{ fontSize: '12px', color: isRunning ? '#0079F2' : '#5F677B', fontVariantNumeric: 'tabular-nums' }}>
                {isRunning ? '⏱ ' : isDone ? '✓ ' : ''}{formatDuration(totalMs)}
              </span>
            )}
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#000C2C' }}>
              {pct}%
            </span>
          </div>
        </div>
        <div style={{ height: '6px', background: '#F0F2F5', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #0079F2, #0565C6)',
            borderRadius: '3px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Step rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {activeSteps.map((step, i) => {
          const state = progress[step] ?? { status: 'pending', errors: [] }
          return (
            <StepRow
              key={step}
              index={i + 1}
              icon={STEP_ICONS[step]}
              label={STEP_LABELS[step]}
              state={state}
              durationMs={stepDurations[step]}
            />
          )
        })}
      </div>
    </div>
  )
}

function StepRow({
  index, icon, label, state, durationMs,
}: {
  index: number
  icon: string
  label: string
  state: { status: StepStatus; migrated?: number; total?: number; message?: string; errors: MigrationError[] }
  durationMs?: number
}) {
  const badge = BADGE_CONFIG[state.status]

  return (
    <div style={{
      border: `1px solid ${state.status === 'in_progress' ? '#BFDBFE' : '#E0E2E5'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      background: state.status === 'in_progress' ? '#F0F7FF' : '#FAFAFB',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Step number / status icon */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          background: badge.bg,
          flexShrink: 0,
        }}>
          {state.status === 'completed' ? (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1.5" stroke="#0079F2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : state.status === 'failed' ? (
            <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>✕</span>
          ) : state.status === 'in_progress' ? (
            <SpinnerPurple />
          ) : (
            <span style={{ color: '#8F96A7', fontSize: '11px', fontWeight: 600 }}>{index}</span>
          )}
        </div>

        {/* Label + icon */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>{icon}</span>
            <span style={{
              fontSize: '13px',
              fontWeight: state.status === 'in_progress' ? 600 : 500,
              color: state.status === 'pending' ? '#8F96A7' : '#000C2C',
            }}>
              {label}
            </span>
          </div>
        </div>

        {/* Count */}
        {state.total !== undefined && (
          <span style={{ fontSize: '12px', color: '#5F677B', flexShrink: 0 }}>
            {state.migrated ?? 0} / {state.total}
          </span>
        )}

        {/* Duration */}
        {durationMs !== undefined && state.status !== 'pending' && (
          <span style={{
            fontSize: '11px',
            color: state.status === 'in_progress' ? '#0079F2' : '#8F96A7',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
            minWidth: '36px',
            textAlign: 'right',
          }}>
            {formatDuration(durationMs)}
          </span>
        )}

        {/* Status badge */}
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: '20px',
          background: badge.bg,
          color: badge.text,
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}>
          {badge.label}
        </span>
      </div>

      {/* Live message (discovery phase labels etc.) */}
      {state.message && state.status !== 'pending' && (
        <div style={{ marginTop: '6px' }}>
          <p style={{ fontSize: '11px', color: '#5F677B', margin: 0, fontStyle: 'italic' }}>
            {state.message}
          </p>
        </div>
      )}

      {/* Inline errors/warnings — show compact counts split by severity */}
      {state.errors.length > 0 && (() => {
        const errorCount   = state.errors.filter((e) => e.severity !== 'warning').length
        const warningCount = state.errors.filter((e) => e.severity === 'warning').length
        return (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F0F2F5', display: 'flex', gap: '12px' }}>
            {errorCount > 0 && (
              <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>
                ✕ {errorCount} error{errorCount !== 1 ? 's' : ''} — open the log to view details
              </p>
            )}
            {warningCount > 0 && (
              <p style={{ fontSize: '12px', color: '#D97706', margin: 0 }}>
                ⚠ {warningCount} warning{warningCount !== 1 ? 's' : ''} — open the log to view details
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}

const BADGE_CONFIG: Record<StepStatus, { bg: string; text: string; label: string }> = {
  pending:     { bg: '#F0F2F5', text: '#8F96A7', label: 'Waiting' },
  in_progress: { bg: '#EFF6FF', text: '#0079F2', label: 'Running' },
  completed:   { bg: '#ECFDF5', text: '#059669', label: 'Done' },
  failed:      { bg: '#FEF2F2', text: '#DC2626', label: 'Failed' },
}

function SpinnerPurple() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="#BFDBFE" strokeWidth="2"/>
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#0079F2" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
