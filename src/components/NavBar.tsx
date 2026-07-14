'use client'

import { useWorkspace } from './WorkspaceContext'

export function NavBar() {
  const { workspaceInfo } = useWorkspace()

  return (
    <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #E0E2E5' }}>
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-3">

        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0079F2"/>
            <path d="M7 7h5a3 3 0 0 1 0 6H7V7z" fill="white"/>
            <path d="M7 13h6a4 4 0 0 1 0 4H7v-4z" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ color: '#000C2C', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' }}>
            Migration Tool
          </span>
        </div>

        {/* Right: connection status — always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <WorkspacePill label="Source"      user={workspaceInfo?.sourceUser} connected={!!workspaceInfo} />
          <span style={{ color: '#d4c8e2', fontSize: '12px' }}>→</span>
          <WorkspacePill label="Destination" user={workspaceInfo?.destUser}   connected={!!workspaceInfo} />
        </div>
      </div>
    </header>
  )
}

function WorkspacePill({
  label, user, connected,
}: {
  label: string
  user?: { name: string; email: string }
  connected: boolean
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: connected ? '#F5F9FF' : '#FAFAFB',
      border: `1px solid ${connected ? '#E0E2E5' : '#E0E2E5'}`,
      borderRadius: '20px', padding: '4px 10px 4px 8px',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
        background: connected ? '#22c55e' : '#d1d5db',
        boxShadow: connected ? '0 0 0 2px #dcfce7' : 'none',
      }} />
      <span style={{ fontSize: '12px', color: '#5F677B' }}>
        {label}:
      </span>
      <span style={{ fontSize: '12px', color: connected ? '#000C2C' : '#5F677B', fontWeight: 500 }}>
        {connected ? (user ? user.name : 'Connected') : 'Not connected'}
      </span>
    </div>
  )
}
