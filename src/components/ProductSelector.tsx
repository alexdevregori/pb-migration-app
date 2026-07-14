'use client'

interface Props {
  products: { id: string; name: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ProductSelector({ products, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  function selectAll()  { onChange(products.map((p) => p.id)) }
  function selectNone() { onChange([]) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Products</h3>
          <p style={sectionSubtitleStyle}>Only features under selected products will be migrated.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <QuickLink onClick={selectAll}>All</QuickLink>
          <QuickLink onClick={selectNone}>None</QuickLink>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((product) => {
          const checked = selected.includes(product.id)
          return (
            <label
              key={product.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${checked ? '#BFDBFE' : '#E0E2E5'}`,
                background: checked ? '#F0F7FF' : '#FAFAFB',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Checkbox checked={checked} onChange={() => toggle(product.id)} />
              <span style={{ fontSize: '13px', color: '#000C2C', fontWeight: 500 }}>{product.name}</span>
            </label>
          )
        })}
        {products.length === 0 && (
          <p style={{ color: '#8F96A7', fontSize: '13px' }}>No products found in this workspace.</p>
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
        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
        border: `1.5px solid ${checked ? '#0079F2' : '#CDCFD5'}`,
        background: checked ? '#0079F2' : '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  fontSize: '13px', fontWeight: 600, color: '#000C2C', margin: 0,
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: '12px', color: '#8F96A7', margin: '2px 0 0',
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
