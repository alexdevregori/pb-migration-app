'use client'

interface ReleaseGroup {
  id: string
  fields: { name: string }
}

interface Props {
  releaseGroups: ReleaseGroup[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ReleaseGroupSelector({ releaseGroups, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Release Groups to Migrate</h3>
      <div className="space-y-1">
        {releaseGroups.map((rg) => (
          <label key={rg.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(rg.id)}
              onChange={() => toggle(rg.id)}
            />
            {rg.fields.name}
          </label>
        ))}
      </div>
    </div>
  )
}
