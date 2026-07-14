'use client'

import { useState, useMemo } from 'react'
import type { StepName, MigrationError } from '@/lib/productboard/types'

interface StepState {
  status: string
  errors: MigrationError[]
}

interface Props {
  progress: Record<string, StepState>
  activeSteps: StepName[]
  onClose: () => void
}

const STEP_LABELS: Record<string, string> = {
  migrationProduct: 'Migration product',
  products:         'Products',
  components:       'Components',
  features:         'Features',
  subfeatures:      'Subfeatures',
  dependencies:     'Dependencies',
  releaseGroups:    'Release groups',
  releases:         'Releases',
  discoverNotes:    'Discover notes',
  companies:        'Companies',
  users:            'Users',
  notes:            'Notes',
}

export function LogDrawer({ progress, activeSteps, onClose }: Props) {
  const [stepFilter, setStepFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const allEntries: (MigrationError & { stepLabel: string })[] = useMemo(() => {
    const entries: (MigrationError & { stepLabel: string })[] = []
    for (const step of activeSteps) {
      const errors = progress[step]?.errors ?? []
      for (const err of errors) {
        entries.push({ ...err, stepLabel: STEP_LABELS[step] ?? step })
      }
    }
    return entries
  }, [progress, activeSteps])

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      if (stepFilter !== 'all' && e.step !== stepFilter) return false
      const sev = e.severity ?? 'error'
      if (severityFilter !== 'all' && sev !== severityFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.name.toLowerCase().includes(q) && !e.message.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allEntries, stepFilter, severityFilter, search])

  function toggleRow(i: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function downloadCsv() {
    const header = 'Step,Name,Severity,Message,Method,URL,Body'
    const rows = filtered.map((e) =>
      [
        e.stepLabel,
        e.name,
        e.severity ?? 'error',
        e.message,
        e.request?.method ?? '',
        e.request?.url ?? '',
        e.request?.body ? JSON.stringify(e.request.body) : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'migration-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const warningCount = allEntries.filter((e) => (e.severity ?? 'error') === 'warning').length
  const errorCount   = allEntries.filter((e) => (e.severity ?? 'error') === 'error').length
  const stepsWithIssues = activeSteps.filter((s) => (progress[s]?.errors?.length ?? 0) > 0)

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 12, 44, 0.3)', zIndex: 40 }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '640px', maxWidth: '100vw',
        background: '#ffffff',
        borderLeft: '1px solid #E0E2E5',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,12,44,0.08)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E0E2E5',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#000C2C', margin: 0 }}>Migration log</h2>
            <p style={{ fontSize: '12px', color: '#5F677B', margin: '2px 0 0' }}>
              {errorCount > 0 && <span style={{ color: '#DC2626' }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
              {errorCount > 0 && warningCount > 0 && <span style={{ color: '#5F677B' }}> · </span>}
              {warningCount > 0 && <span style={{ color: '#D97706' }}>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
              {allEntries.length === 0 && <span style={{ color: '#059669' }}>No issues</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              style={{
                background: 'none',
                border: '1px solid #E0E2E5',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: filtered.length === 0 ? '#8F96A7' : '#000C2C',
                cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export CSV
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8F96A7', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E0E2E5', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or message…"
            style={{
              flex: 1, border: '1px solid #CDCFD5', borderRadius: '6px',
              padding: '6px 10px', fontSize: '13px', color: '#000C2C',
              background: '#FAFAFB', outline: 'none',
            }}
          />
          <select value={stepFilter} onChange={(e) => setStepFilter(e.target.value)} style={selectStyle}>
            <option value="all">All steps</option>
            {stepsWithIssues.map((s) => (
              <option key={s} value={s}>{STEP_LABELS[s] ?? s}</option>
            ))}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="all">All types</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#8F96A7' }}>
                {allEntries.length === 0 ? 'No issues logged during this migration.' : 'No results match your filters.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #E0E2E5' }}>
                  <th style={thStyle}>Step</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={{ ...thStyle, width: '40%' }}>Message</th>
                  <th style={{ ...thStyle, width: '20px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const isWarning = (entry.severity ?? 'error') === 'warning'
                  const isExpanded = expandedRows.has(i)
                  const hasRequest = !!entry.request

                  return (
                    <>
                      <tr
                        key={i}
                        onClick={() => hasRequest && toggleRow(i)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid #F0F2F5',
                          background: isExpanded ? '#F8FAFF' : i % 2 === 0 ? '#ffffff' : '#FAFAFB',
                          cursor: hasRequest ? 'pointer' : 'default',
                        }}
                      >
                        <td style={tdStyle}>
                          <span style={{ color: '#5F677B' }}>{entry.stepLabel}</span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500, color: '#000C2C' }}>
                          {entry.name}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: '11px', fontWeight: 600,
                            padding: '2px 7px', borderRadius: '20px',
                            background: isWarning ? '#FFFBEB' : '#FEF2F2',
                            color: isWarning ? '#D97706' : '#DC2626',
                          }}>
                            {isWarning ? 'Warning' : 'Error'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: '#5F677B', wordBreak: 'break-word' }}>
                          {entry.message}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {hasRequest && (
                            <svg
                              width="12" height="12" viewBox="0 0 12 12" fill="none"
                              style={{ transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: '#8F96A7' }}
                            >
                              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </td>
                      </tr>

                      {/* Expanded request details */}
                      {isExpanded && hasRequest && (
                        <tr key={`${i}-expanded`} style={{ borderBottom: '1px solid #F0F2F5' }}>
                          <td colSpan={5} style={{ padding: '0 12px 12px', background: '#F8FAFF' }}>
                            <div style={{
                              background: '#0F172A',
                              borderRadius: '6px',
                              padding: '12px',
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              color: '#E2E8F0',
                              overflowX: 'auto',
                            }}>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#93C5FD', fontWeight: 700 }}>{entry.request!.method}</span>
                                {' '}
                                <span style={{ color: '#86EFAC' }}>https://api.productboard.com{entry.request!.url}</span>
                              </div>
                              {!!entry.request!.body && (
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#CBD5E1' }}>
                                  {JSON.stringify(entry.request!.body, null, 2)}
                                </pre>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', borderTop: '1px solid #E0E2E5',
          flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '12px', color: '#8F96A7' }}>
            Showing {filtered.length} of {allEntries.length} issue{allEntries.length !== 1 ? 's' : ''}
          </span>
          {filtered.some((e) => e.request) && (
            <span style={{ fontSize: '11px', color: '#8F96A7' }}>Click a row to view request details</span>
          )}
        </div>
      </div>
    </>
  )
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #CDCFD5', borderRadius: '6px', padding: '6px 10px',
  fontSize: '13px', color: '#000C2C', background: '#FAFAFB', cursor: 'pointer', outline: 'none',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#8F96A7',
  textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '9px 12px', verticalAlign: 'top',
}
