'use client'

import type { PBReleaseGroup } from '@/lib/productboard/types'

interface Props {
  releaseGroups: PBReleaseGroup[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ReleaseGroupSelector({ releaseGroups, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  function selectAll() { onChange(releaseGroups.map((rg) => rg.id)) }
  function selectNone() { onChange([]) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Release groups</h3>
          <p style={sectionSubtitleStyle}>Only releases from selected groups will be migrated.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <QuickLink onClick={selectAll}>All</QuickLink>
          <QuickLink onClick={selectNone}>None</QuickLink>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {releaseGroups.map((rg) => {
          const checked = selected.includes(rg.id)
          return (
            <label
              key={rg.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${checked ? '#d4c2e8' : '#ede8f3'}`,
                background: checked ? '#faf6ff' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Checkbox checked={checked} onChange={() => toggle(rg.id)} />
              <span style={{ fontSize: '13px', color: '#1a1523', fontWeight: 500 }}>{rg.fields.name}</span>
            </label>
          )
        })}
        {releaseGroups.length === 0 && (
          <p style={{ color: '#a89bb8', fontSize: '13px' }}>No release groups found in this workspace.</p>
        )}
      </div>
    </div>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '4px',
        border: `1.5px solid ${checked ? '#6B2FA0' : '#d4cede'}`,
        background: checked ? '#6B2FA0' : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1a1523',
  margin: 0,
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#a89bb8',
  margin: '2px 0 0',
}

function QuickLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#6B2FA0',
        fontSize: '12px',
        cursor: 'pointer',
        padding: '2px 0',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  )
}
