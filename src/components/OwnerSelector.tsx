'use client'

import { useState } from 'react'

interface Member {
  email: string
  name: string
}

interface Props {
  members: Member[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function OwnerSelector({ members, selected, onChange }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? members.filter((m) => {
        const q = query.toLowerCase()
        return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      })
    : members

  function toggle(email: string) {
    onChange(
      selected.includes(email) ? selected.filter((e) => e !== email) : [...selected, email]
    )
  }

  function selectNone() { onChange([]) }

  const selectedNames = selected.map((email) => {
    const m = members.find((m) => m.email === email)
    return m && m.name !== m.email ? m.name : email
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Filter by owner</h3>
          <p style={sectionSubtitleStyle}>
            Only features and subfeatures owned by selected members will be migrated.
            Products and components are always created as needed.
            Leave all unselected to migrate regardless of owner.
          </p>
        </div>
        {selected.length > 0 && (
          <button type="button" onClick={selectNone} style={clearBtnStyle}>
            Clear
          </button>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#8F96A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #CDCFD5',
            borderRadius: '8px',
            padding: '7px 12px 7px 32px',
            fontSize: '13px',
            color: '#000C2C',
            background: '#FAFAFB',
            outline: 'none',
          }}
        />
      </div>

      {members.length === 0 ? (
        <p style={{ color: '#8F96A7', fontSize: '13px', margin: 0 }}>No members found in this workspace.</p>
      ) : (
        <div style={{
          maxHeight: '220px',
          overflowY: 'auto',
          border: '1px solid #E0E2E5',
          borderRadius: '8px',
          background: '#ffffff',
        }}>
          {filtered.length === 0 ? (
            <p style={{ color: '#8F96A7', fontSize: '13px', margin: 0, padding: '10px 12px' }}>No members match &ldquo;{query}&rdquo;</p>
          ) : (
            filtered.map((member, i) => {
              const checked = selected.includes(member.email)
              return (
                <label
                  key={member.email}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderTop: i > 0 ? '1px solid #F0F2F5' : undefined,
                    background: checked ? '#F0F7FF' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(member.email)}
                    style={{ width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0, accentColor: '#0079F2' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#000C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {member.name !== member.email ? member.name : member.email}
                    </div>
                    {member.name !== member.email && (
                      <div style={{ fontSize: '11px', color: '#8F96A7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.email}
                      </div>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      )}

      {selected.length > 0 && (
        <p style={{ fontSize: '12px', color: '#5F677B', margin: '8px 0 0' }}>
          Filtering by: {selectedNames.join(', ')} — features/subfeatures not owned by them will be skipped.
        </p>
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

const clearBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#0079F2',
  fontSize: '12px', cursor: 'pointer', padding: '2px 0', fontWeight: 500, flexShrink: 0,
}
