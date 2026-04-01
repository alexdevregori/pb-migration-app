'use client'

interface Props {
  onConnect: (sourceKey: string, destKey: string) => void
  loading: boolean
  error: string | null
}

export function ConfigForm({ onConnect, loading, error }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const sourceKey = (form.elements.namedItem('sourceKey') as HTMLInputElement).value
    const destKey = (form.elements.namedItem('destKey') as HTMLInputElement).value
    onConnect(sourceKey, destKey)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle} htmlFor="sourceKey">Source workspace API key</label>
          <input
            id="sourceKey"
            name="sourceKey"
            type="password"
            required
            style={inputStyle}
            placeholder="pb_key_..."
          />
          <p style={hintStyle}>The workspace you&apos;re migrating <em>from</em></p>
        </div>
        <div>
          <label style={labelStyle} htmlFor="destKey">Destination workspace API key</label>
          <input
            id="destKey"
            name="destKey"
            type="password"
            required
            style={inputStyle}
            placeholder="pb_key_..."
          />
          <p style={hintStyle}>The workspace you&apos;re migrating <em>to</em></p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#DC2626', fontSize: '13px', margin: 0 }}>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          background: loading ? '#c4afd8' : '#6B2FA0',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '9px 20px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {loading && <Spinner />}
        {loading ? 'Connecting…' : 'Connect workspaces'}
      </button>
    </form>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="white" strokeOpacity="0.3" strokeWidth="2"/>
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#1a1523',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d4cede',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#1a1523',
  background: '#fafafa',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#a89bb8',
  margin: '4px 0 0',
}
