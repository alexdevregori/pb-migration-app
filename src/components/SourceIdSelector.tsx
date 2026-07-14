'use client'

interface Props {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function SourceIdSelector({ enabled, onChange }: Props) {
  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <h3 style={sectionTitleStyle}>Source entity ID</h3>
        <p style={sectionSubtitleStyle}>Store each entity's original source API ID in a custom text field.</p>
      </div>

      <div style={{
        background: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM8 5v4M8 10.5v.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: '1.5' }}>
          Useful if note linking fails during migration. After import you can look up entities by their
          original source ID and link notes manually. You&apos;ll choose the destination text field in the next step.
        </p>
      </div>

      <label style={rowStyle}>
        <Toggle checked={enabled} onChange={() => onChange(!enabled)} />
        <div>
          <div style={labelStyle}>Write source ID to a custom field</div>
          <div style={descStyle}>
            The original source API UUID will be written to a text field you choose in the next step.
          </div>
        </div>
      </label>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        flexShrink: 0,
        width: '32px',
        height: '18px',
        borderRadius: '9px',
        background: checked ? '#0079F2' : '#CDCFD5',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s',
        marginTop: '2px',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '16px' : '2px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: '#ffffff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#000C2C',
  margin: 0,
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8F96A7',
  margin: '2px 0 0',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#000C2C',
}

const descStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8F96A7',
  marginTop: '1px',
}
