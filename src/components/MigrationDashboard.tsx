'use client'

import type { StepName, StepStatus } from '@/lib/productboard/types'

const STEP_LABELS: Record<StepName, string> = {
  migrationProduct: 'Create Migration Product',
  products: 'Products → Components',
  components: 'Components',
  features: 'Features',
  subfeatures: 'Subfeatures',
  releaseGroups: 'Release Groups',
  releases: 'Releases',
  discoverNotes: 'Discover Notes',
  companies: 'Companies',
  users: 'Users',
  notes: 'Notes',
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

function StatusBadge({ status }: { status: StepStatus }) {
  const styles: Record<StepStatus, string> = {
    pending: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  const labels: Record<StepStatus, string> = {
    pending: 'Waiting',
    in_progress: 'Running',
    completed: 'Done',
    failed: 'Failed',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function MigrationDashboard({ progress }: Props) {
  return (
    <div className="space-y-2">
      {STEP_ORDER.map((step) => {
        const state = progress[step] ?? { status: 'pending', errors: [] }
        return (
          <div key={step} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{STEP_LABELS[step]}</span>
              <div className="flex items-center gap-3">
                {state.total !== undefined && (
                  <span className="text-xs text-gray-500">
                    {state.migrated ?? 0} / {state.total}
                  </span>
                )}
                <StatusBadge status={state.status} />
              </div>
            </div>
            {state.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {state.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">{err}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
