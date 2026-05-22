'use client'

export interface NoteFilterConfig {
  includeLinkedNotes: boolean
  linkedNotesMaxAgeDays: number | null
  includeNotesLinkedToNonMigratedFeatures: boolean
  nonMigratedLinkedNotesMaxAgeDays: number | null
  includeUnprocessedOrphanNotes: boolean
  unprocessedOrphanNotesMaxAgeDays: number | null
  includeProcessedOrphanNotes: boolean
  processedOrphanNotesMaxAgeDays: number | null
  appendSourceOwnerOnUnassigned: boolean
}

interface Props {
  config: NoteFilterConfig
  onChange: (config: NoteFilterConfig) => void
}

export function NoteFilterSelector({ config, onChange }: Props) {
  function set(patch: Partial<NoteFilterConfig>) {
    onChange({ ...config, ...patch })
  }

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <h3 style={sectionTitleStyle}>Notes</h3>
        <p style={sectionSubtitleStyle}>Choose which notes to bring over.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <BucketRow
          checked={config.includeLinkedNotes}
          onToggle={(v) => set({ includeLinkedNotes: v })}
          label="Notes linked to migrated features"
          desc="Notes attached to features or subfeatures being migrated."
          maxAgeDays={config.linkedNotesMaxAgeDays}
          onMaxAgeDaysChange={(v) => set({ linkedNotesMaxAgeDays: v })}
          enabled={config.includeLinkedNotes}
        />

        <BucketRow
          checked={config.includeNotesLinkedToNonMigratedFeatures}
          onToggle={(v) => set({ includeNotesLinkedToNonMigratedFeatures: v })}
          label="Notes linked to features not being migrated"
          desc="Notes attached to features excluded from this migration."
          maxAgeDays={config.nonMigratedLinkedNotesMaxAgeDays}
          onMaxAgeDaysChange={(v) => set({ nonMigratedLinkedNotesMaxAgeDays: v })}
          enabled={config.includeNotesLinkedToNonMigratedFeatures}
        />

        <BucketRow
          checked={config.includeUnprocessedOrphanNotes}
          onToggle={(v) => set({ includeUnprocessedOrphanNotes: v })}
          label="Unprocessed notes not linked to any feature"
          desc="Unprocessed notes with no feature attachment."
          maxAgeDays={config.unprocessedOrphanNotesMaxAgeDays}
          onMaxAgeDaysChange={(v) => set({ unprocessedOrphanNotesMaxAgeDays: v })}
          enabled={config.includeUnprocessedOrphanNotes}
        />

        <BucketRow
          checked={config.includeProcessedOrphanNotes}
          onToggle={(v) => set({ includeProcessedOrphanNotes: v })}
          label="Processed notes not linked to any feature"
          desc="Already-processed notes with no feature attachment."
          maxAgeDays={config.processedOrphanNotesMaxAgeDays}
          onMaxAgeDaysChange={(v) => set({ processedOrphanNotesMaxAgeDays: v })}
          enabled={config.includeProcessedOrphanNotes}
        />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '4px' }}>
          <input
            type="checkbox"
            checked={config.appendSourceOwnerOnUnassigned}
            onChange={(e) => set({ appendSourceOwnerOnUnassigned: e.target.checked })}
            style={{ marginTop: '2px', flexShrink: 0, accentColor: '#0079F2', width: '14px', height: '14px' }}
          />
          <div>
            <div style={labelStyle}>Append source owner to unassigned notes</div>
            <div style={descStyle}>Adds &ldquo;Source Owner: email@email.com&rdquo; to the bottom of notes whose owner isn&rsquo;t in the destination workspace.</div>
          </div>
        </label>
      </div>
    </div>
  )
}

interface BucketRowProps {
  checked: boolean
  onToggle: (v: boolean) => void
  label: string
  desc: string
  maxAgeDays: number | null
  onMaxAgeDaysChange: (v: number | null) => void
  enabled: boolean
}

function BucketRow({ checked, onToggle, label, desc, maxAgeDays, onMaxAgeDaysChange, enabled }: BucketRowProps) {
  return (
    <div>
      <label style={rowStyle}>
        <Toggle checked={checked} onChange={onToggle} />
        <div>
          <div style={labelStyle}>{label}</div>
          <div style={descStyle}>{desc}</div>
        </div>
      </label>

      {enabled && (
        <div style={{ marginLeft: '44px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={descStyle}>Created in the last</span>
          <input
            type="number"
            min={1}
            max={3650}
            placeholder="No limit"
            value={maxAgeDays ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onMaxAgeDaysChange(null)
              } else {
                const n = parseInt(raw)
                if (!isNaN(n) && n > 0) onMaxAgeDaysChange(n)
              }
            }}
            style={{
              width: '80px',
              padding: '4px 8px',
              border: '1px solid #CDCFD5',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#000C2C',
              textAlign: 'center',
            }}
          />
          {maxAgeDays !== null && <span style={descStyle}>days</span>}
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
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
