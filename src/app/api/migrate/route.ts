import { NextRequest, NextResponse } from 'next/server'
import type { MigrationConfig } from '@/lib/productboard/types'
import { loadState, clearState } from '@/lib/state'
import { runMigration } from '@/lib/migrators/index'
import { emitProgress } from '@/lib/progress'

// GET /api/migrate — check whether a prior migration run exists on disk
export async function GET() {
  const state = await loadState()
  return NextResponse.json({ hasPriorRun: state !== null })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const config = body as MigrationConfig

  if (!Array.isArray(config.selectedProducts)) config.selectedProducts = []

  if (
    !config.sourceApiKey ||
    !config.destinationApiKey ||
    !Array.isArray(config.selectedStatuses) ||
    !Array.isArray(config.selectedProducts) ||
    !Array.isArray(config.selectedReleaseGroups) ||
    !Array.isArray(config.selectedFields)
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (config.selectedProducts.length > 0 && config.selectedStatuses.length === 0) {
    return NextResponse.json(
      { error: 'At least one status must be selected when products are selected.' },
      { status: 400 }
    )
  }

  console.log('[migrate] selectedProducts:', JSON.stringify(config.selectedProducts))
  console.log('[migrate] selectedStatuses:', JSON.stringify(config.selectedStatuses))

  // Load existing state if resuming, otherwise wipe and start fresh
  const resume = body.resume === true
  if (!resume) await clearState()
  const existingState = resume ? await loadState() : null

  // Run migration in the background — do not await
  runMigration(config, existingState, emitProgress).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Log the full stack so the real step is visible in server logs
    console.error('Migration failed (unhandled):', error)
    // Emit against discoverNotes as a catch-all — the real culprit will be visible in logs
    emitProgress({ step: 'discoverNotes', status: 'failed', error: {
      step: 'discoverNotes', sourceId: '', name: 'Unhandled error', message,
    }})
  })

  return NextResponse.json({ started: true })
}
