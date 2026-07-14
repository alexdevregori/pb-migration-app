'use client'

import { useState } from 'react'

export const ALL_FEATURE_FIELDS = [
  'description',
  'health',
  'workProgress',
  'effort',
  'timeframe',
  'owner',
  'dependencies',
  'tags',
] as const

export type FeatureFieldId = typeof ALL_FEATURE_FIELDS[number]

const FIELD_META: Record<FeatureFieldId, { label: string; description: string }> = {
  description:  { label: 'Description',   description: 'Rich text description body' },
  health:       { label: 'Health',        description: 'On track / at risk / off track status and comment' },
  workProgress: { label: 'Work progress', description: 'Manual completion percentage' },
  effort:       { label: 'Effort',        description: 'Effort score' },
  timeframe:    { label: 'Timeframe',     description: 'Start date, end date, and granularity' },
  owner:        { label: 'Owner',         description: 'Assigned member, matched by email' },
  dependencies: { label: 'Dependencies',  description: 'Relationships between features' },
  tags:         { label: 'Tags',          description: 'Feature tags' },
}

interface Props {
  selected: string[]
  onChange: (selected: string[]) => void
  tagKeywords: string[]
  onTagKeywordsChange: (keywords: string[]) => void
  tagMatchMode: 'contains' | 'exact'
  onTagMatchModeChange: (mode: 'contains' | 'exact') => void
}

export function FeatureFieldSelector({ selected, onChange, tagKeywords, onTagKeywordsChange, tagMatchMode, onTagMatchModeChange }: Props) {
  const [keywordInput, setKeywordInput] = useState('')
  const tagsChecked = selected.includes('tags')

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  function selectAll()  { onChange([...ALL_FEATURE_FIELDS]) }
  function selectNone() { onChange([]) }

  function addKeyword() {
    const trimmed = keywordInput.trim()
    if (!trimmed || tagKeywords.includes(trimmed)) return
    onTagKeywordsChange([...tagKeywords, trimmed])
    setKeywordInput('')
  }

  function removeKeyword(kw: string) {
    onTagKeywordsChange(tagKeywords.filter((k) => k !== kw))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword() }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h3 style={sectionTitleStyle}>Default fields</h3>
          <p style={sectionSubtitleStyle}>Choose which built-in fields to copy onto each feature and subfeature.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <QuickLink onClick={selectAll}>All</QuickLink>
          <QuickLink onClick={selectNone}>None</QuickLink>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {ALL_FEATURE_FIELDS.map((id) => {
          const checked = selected.includes(id)
          const meta = FIELD_META[id]
          return (
            <div key={id}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: id === 'tags' && tagsChecked ? '8px 8px 0 0' : '8px',
                  border: `1px solid ${checked ? '#BFDBFE' : '#E0E2E5'}`,
                  borderBottom: id === 'tags' && tagsChecked ? 'none' : undefined,
                  background: checked ? '#F0F7FF' : '#FAFAFB',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Checkbox checked={checked} onChange={() => toggle(id)} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: '#000C2C', fontWeight: 500 }}>{meta.label}</span>
                  <span style={{ fontSize: '12px', color: '#8F96A7', marginLeft: '8px' }}>{meta.description}</span>
                </div>
              </label>

              {/* Tag keyword filter — only shown when tags is checked */}
              {id === 'tags' && tagsChecked && (
                <div style={{
                  padding: '10px 12px 12px',
                  border: '1px solid #BFDBFE',
                  borderTop: '1px solid #dbeafe',
                  borderRadius: '0 0 8px 8px',
                  background: '#F0F7FF',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#5F677B', margin: 0 }}>
                      Filter by keyword — leave empty to bring all tags.
                    </p>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                      {(['contains', 'exact'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onTagMatchModeChange(mode)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            border: `1px solid ${tagMatchMode === mode ? '#0079F2' : '#BFDBFE'}`,
                            background: tagMatchMode === mode ? '#0079F2' : '#ffffff',
                            color: tagMatchMode === mode ? '#ffffff' : '#5F677B',
                          }}
                        >
                          {mode === 'contains' ? 'Contains' : 'Exact'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: tagKeywords.length > 0 ? '8px' : '0' }}>
                    {tagKeywords.map((kw) => (
                      <span
                        key={kw}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#DBEAFE', color: '#1D4ED8',
                          fontSize: '12px', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '20px',
                        }}
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 0, lineHeight: 1, fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. roadmap"
                      style={{
                        flex: 1,
                        border: '1px solid #BFDBFE',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '13px',
                        color: '#000C2C',
                        background: '#ffffff',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      disabled={!keywordInput.trim()}
                      style={{
                        background: keywordInput.trim() ? '#0079F2' : '#CDCFD5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: keywordInput.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
