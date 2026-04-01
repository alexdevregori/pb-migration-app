'use client'

interface FieldConfig {
  id: string
  name: string
}

interface Props {
  fields: FieldConfig[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function FieldSelector({ fields, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  if (fields.length === 0) return null

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">Custom Fields to Migrate</h3>
      <div className="space-y-1">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(field.id)}
              onChange={() => toggle(field.id)}
            />
            {field.name}
          </label>
        ))}
      </div>
    </div>
  )
}
