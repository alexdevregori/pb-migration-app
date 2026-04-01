'use client'

interface FieldConfig {
  id: string
  name: string
}

interface Props {
  fields: FieldConfig[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function FieldSelector({ fields, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  function selectAll() { onChange(fields.map((f) => f.id)) }
  function selectNone() { onChange([]) }

  if (fields.length === 0) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Custom fields</h3>
          <p style={sectionSubtitleStyle}>Selected fields will be copied to features and subfeatures.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <QuickLink onClick={selectAll}>All</QuickLink>
          <QuickLink onClick={selectNone}>None</QuickLink>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {fields.map((field) => {
          const checked = selected.includes(field.id)
          return (
            <button
              key={field.id}
              type="button"
              onClick={() => toggle(field.id)}
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
              {field.name}
            </button>
          )
        })}
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
