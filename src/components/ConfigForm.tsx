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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="sourceKey">
          Source Workspace API Key
        </label>
        <input
          id="sourceKey"
          name="sourceKey"
          type="password"
          required
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="pb_key_..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="destKey">
          Destination Workspace API Key
        </label>
        <input
          id="destKey"
          name="destKey"
          type="password"
          required
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="pb_key_..."
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {loading ? 'Connecting...' : 'Connect'}
      </button>
    </form>
  )
}
