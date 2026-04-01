'use client'

interface Status {
  id: string
  name: string
}

interface Props {
  statuses: Status[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function StatusSelector({ statuses, selected, onChange }: Props) {
  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    )
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Feature & Subfeature Statuses to Migrate</h3>
      <div className="space-y-1">
        {statuses.map((status) => (
          <label key={status.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(status.name)}
              onChange={() => toggle(status.name)}
            />
            {status.name}
          </label>
        ))}
      </div>
    </div>
  )
}
