'use client'

import { deriveFieldType } from '@/lib/field-type'

interface FieldConfig {
  id: string
  name: string
  schema: {
    type: string
    format?: string
    required?: string[]
    constraints?: { maxLength?: number }
  }
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

  // Filter out fields with empty names before grouping
  const visibleFields = fields.filter((f) => f.name?.trim())

  function selectAll() { onChange(visibleFields.map((f) => f.id)) }
  function selectNone() { onChange([]) }

  if (visibleFields.length === 0) return null

  // Group by derived human-readable type, sort groups and fields within each group alphabetically
  const grouped = new Map<string, FieldConfig[]>()
  for (const field of visibleFields) {
    const type = deriveFieldType(field.schema)
    if (!grouped.has(type)) grouped.set(type, [])
    grouped.get(type)!.push(field)
  }
  const sortedGroups = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, groupFields]) => ({
      type,
      fields: [...groupFields].sort((a, b) => a.name.localeCompare(b.name)),
    }))

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {sortedGroups.map(({ type, fields: groupFields }) => (
          <div key={type}>
            <p style={groupLabelStyle}>{type}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {groupFields.map((field) => {
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
                      border: `1px solid ${checked ? '#BFDBFE' : '#E0E2E5'}`,
                      background: checked ? '#EFF6FF' : '#ffffff',
                      color: checked ? '#0079F2' : '#6B7280',
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
        ))}
      </div>
    </div>
  )
}


const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#000C2C', margin: 0,
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: '12px', color: '#8F96A7', margin: '2px 0 0',
}

const groupLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#8F96A7',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  margin: '0 0 6px 2px',
}

function QuickLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', color: '#0079F2',
      fontSize: '12px', cursor: 'pointer', padding: '2px 0', fontWeight: 500,
    }}>
      {children}
    </button>
  )
}
