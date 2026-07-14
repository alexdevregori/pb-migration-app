'use client'

import { useState } from 'react'

interface Props {
  onConnect: (sourceKey: string, destKey: string) => void
  loading: boolean
  error: string | null
}

export function ConfigForm({ onConnect, loading, error }: Props) {
  const [showSource, setShowSource] = useState(false)
  const [showDest, setShowDest] = useState(false)

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
          <div style={inputWrapStyle}>
            <input
              id="sourceKey"
              name="sourceKey"
              type={showSource ? 'text' : 'password'}
              required
              style={inputStyle}
              placeholder="Enter your API key"
            />
            <ToggleButton show={showSource} onToggle={() => setShowSource((v) => !v)} />
          </div>
          <p style={hintStyle}>The workspace you&apos;re migrating <em>from</em></p>
        </div>
        <div>
          <label style={labelStyle} htmlFor="destKey">Destination workspace API key</label>
          <div style={inputWrapStyle}>
            <input
              id="destKey"
              name="destKey"
              type={showDest ? 'text' : 'password'}
              required
              style={inputStyle}
              placeholder="Enter your API key"
            />
            <ToggleButton show={showDest} onToggle={() => setShowDest((v) => !v)} />
          </div>
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
          background: loading ? '#93C5FD' : '#0079F2',
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

function ToggleButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute',
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        padding: '2px',
        cursor: 'pointer',
        color: '#8F96A7',
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
      }}
      aria-label={show ? 'Hide API key' : 'Show API key'}
    >
      {show ? (
        // Eye-off icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        // Eye icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
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
  color: '#000C2C',
  marginBottom: '6px',
}

const inputWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #CDCFD5',
  borderRadius: '8px',
  padding: '8px 36px 8px 12px',
  fontSize: '14px',
  color: '#000C2C',
  background: '#FAFAFB',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8F96A7',
  margin: '4px 0 0',
}
