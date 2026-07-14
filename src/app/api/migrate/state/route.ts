import { NextResponse } from 'next/server'
import { loadState, STATE_FILE_PATH } from '@/lib/state'
import fs from 'fs/promises'

// GET /api/migrate/state — returns the full saved migration state for UI restoration
export async function GET() {
  const state = await loadState()
  if (!state) return NextResponse.json(null)
  return NextResponse.json(state)
}

// DELETE /api/migrate/state — clears the saved state so a fresh migration can begin
export async function DELETE() {
  try {
    await fs.unlink(STATE_FILE_PATH)
  } catch (err: unknown) {
    // ENOENT means it was already gone — that's fine
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  return NextResponse.json({ cleared: true })
}
