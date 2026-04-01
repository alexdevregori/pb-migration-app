'use client'

import type { StepName, StepStatus } from '@/lib/productboard/types'

const STEP_LABELS: Record<StepName, string> = {
  migrationProduct: 'Create Migration product',
  products: 'Products → Components',
  components: 'Components',
  features: 'Features',
  subfeatures: 'Subfeatures',
  releaseGroups: 'Release groups',
  releases: 'Releases',
  discoverNotes: 'Discover notes',
  companies: 'Companies',
  users: 'Users',
  notes: 'Notes',
}

const STEP_ICONS: Record<StepName, string> = {
  migrationProduct: '🏗',
  products: '📦',
  components: '🧩',
  features: '✨',
  subfeatures: '🔹',
  releaseGroups: '📅',
  releases: '🚀',
  discoverNotes: '🔍',
  companies: '🏢',
  users: '👤',
  notes: '📝',
}

const STEP_ORDER: StepName[] = [
  'migrationProduct', 'products', 'components', 'features', 'subfeatures',
  'releaseGroups', 'releases', 'discoverNotes', 'companies', 'users', 'notes',
]

interface StepState {
  status: StepStatus
  migrated?: number
  total?: number
  errors: string[]
}

interface Props {
  progress: Record<string, StepState>
}

export function MigrationDashboard({ progress }: Props) {
  const completedCount = STEP_ORDER.filter((s) => (progress[s]?.status ?? 'pending') === 'completed').length

  return (
    <div>
      {/* Overall progress bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', color: '#6e6882' }}>Overall progress</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1523' }}>
            {completedCount} / {STEP_ORDER.length} steps
          </span>
        </div>
        <div style={{ height: '6px', background: '#f0edf5', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(completedCount / STEP_ORDER.length) * 100}%`,
            background: 'linear-gradient(90deg, #6B2FA0, #9B59B6)',
            borderRadius: '3px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Step rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {STEP_ORDER.map((step, i) => {
          const state = progress[step] ?? { status: 'pending', errors: [] }
          return (
            <StepRow
              key={step}
              index={i + 1}
              icon={STEP_ICONS[step]}
              label={STEP_LABELS[step]}
              state={state}
            />
          )
        })}
      </div>
    </div>
  )
}

function StepRow({
  index, icon, label, state,
}: {
  index: number
  icon: string
  label: string
  state: { status: StepStatus; migrated?: number; total?: number; errors: string[] }
}) {
  const badge = BADGE_CONFIG[state.status]

  return (
    <div style={{
      border: `1px solid ${state.status === 'in_progress' ? '#d4c2e8' : '#ede8f3'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      background: state.status === 'in_progress' ? '#faf6ff' : '#fafafa',
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
              <path d="M1 5L4.5 8.5L11 1.5" stroke="#6B2FA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : state.status === 'failed' ? (
            <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>✕</span>
          ) : state.status === 'in_progress' ? (
            <SpinnerPurple />
          ) : (
            <span style={{ color: '#a89bb8', fontSize: '11px', fontWeight: 600 }}>{index}</span>
          )}
        </div>

        {/* Label + icon */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>{icon}</span>
            <span style={{
              fontSize: '13px',
              fontWeight: state.status === 'in_progress' ? 600 : 500,
              color: state.status === 'pending' ? '#a89bb8' : '#1a1523',
            }}>
              {label}
            </span>
          </div>
        </div>

        {/* Count */}
        {state.total !== undefined && (
          <span style={{ fontSize: '12px', color: '#6e6882', flexShrink: 0 }}>
            {state.migrated ?? 0} / {state.total}
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
          textTransform: 'uppercase',
        }}>
          {badge.label}
        </span>
      </div>

      {/* Inline errors */}
      {state.errors.length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0edf5' }}>
          {state.errors.map((err, i) => (
            <p key={i} style={{ fontSize: '12px', color: '#DC2626', margin: i > 0 ? '3px 0 0' : '0' }}>
              ⚠ {err}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

const BADGE_CONFIG: Record<StepStatus, { bg: string; text: string; label: string }> = {
  pending:     { bg: '#f0edf5', text: '#a89bb8', label: 'Waiting' },
  in_progress: { bg: '#EDE4F5', text: '#6B2FA0', label: 'Running' },
  completed:   { bg: '#ECFDF5', text: '#059669', label: 'Done' },
  failed:      { bg: '#FEF2F2', text: '#DC2626', label: 'Failed' },
}

function SpinnerPurple() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="#d4c2e8" strokeWidth="2"/>
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#6B2FA0" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
