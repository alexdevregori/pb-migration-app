'use client'

interface Status {
  id: string
  name: string
}

interface Props {
  statuses: Status[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function StatusSelector({ statuses, selected, onChange }: Props) {
  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    )
  }

  function selectAll() { onChange(statuses.map((s) => s.name)) }
  function selectNone() { onChange([]) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Feature statuses</h3>
          <p style={sectionSubtitleStyle}>Only features and subfeatures with these statuses will be migrated.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <QuickLink onClick={selectAll}>All</QuickLink>
          <QuickLink onClick={selectNone}>None</QuickLink>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {statuses.map((status) => {
          const checked = selected.includes(status.name)
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => toggle(status.name)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                border: `1px solid ${checked ? '#6B2FA0' : '#d4cede'}`,
                background: checked ? '#EDE4F5' : '#ffffff',
                color: checked ? '#6B2FA0' : '#6e6882',
                transition: 'all 0.15s',
              }}
            >
              {checked && <span style={{ marginRight: '4px' }}>✓</span>}
              {status.name}
            </button>
          )
        })}
        {statuses.length === 0 && (
          <p style={{ color: '#a89bb8', fontSize: '13px' }}>No statuses found in this workspace.</p>
        )}
      </div>
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
