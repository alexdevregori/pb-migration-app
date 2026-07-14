'use client'

interface JiraIntegration {
  id: string
  name: string
  status: string
}

interface Props {
  integrations: JiraIntegration[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function JiraIntegrationSelector({ integrations, selectedIds, onChange }: Props) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <h3 style={sectionTitleStyle}>Jira</h3>
        <p style={sectionSubtitleStyle}>Migrate Jira issue keys to the destination workspace.</p>
      </div>

      {/* Disclaimer */}
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
          Jira integration links cannot be migrated directly. Instead, the Jira issue key (e.g.{' '}
          <span style={{ fontFamily: 'monospace', background: '#FEF3C7', padding: '1px 4px', borderRadius: '3px' }}>PROJ-123</span>
          ) can be written to a custom text field in the destination workspace. You&apos;ll choose
          the destination field for each integration in the next step.
        </p>
      </div>

      {integrations.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#8F96A7' }}>
          No Jira integrations found in the source workspace.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {integrations.map((integration) => {
            const checked = selectedIds.includes(integration.id)
            return (
              <label key={integration.id} style={rowStyle}>
                <Toggle checked={checked} onChange={() => toggle(integration.id)} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={labelStyle}>{integration.name}</span>
                    {integration.status === 'disabled' && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#92400E',
                        background: '#FEF3C7',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        disabled
                      </span>
                    )}
                  </div>
                  <div style={descStyle}>
                    Issue keys will be written to a destination text field you choose in the next step.
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      )}
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
