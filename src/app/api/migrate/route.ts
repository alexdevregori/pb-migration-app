import { NextRequest, NextResponse } from 'next/server'
import type { MigrationConfig } from '@/lib/productboard/types'
import { loadState } from '@/lib/state'
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

  if (
    !config.sourceApiKey ||
    !config.destinationApiKey ||
    !Array.isArray(config.selectedStatuses) ||
    !Array.isArray(config.selectedReleaseGroups) ||
    !Array.isArray(config.selectedFields)
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Load existing state if resuming, otherwise start fresh
  const resume = body.resume === true
  const existingState = resume ? await loadState() : null

  // Run migration in the background — do not await
  runMigration(config, existingState, emitProgress).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    emitProgress({ step: 'migrationProduct', status: 'failed', error: {
      step: 'migrationProduct', sourceId: '', name: 'Migration', message,
    }})
    console.error('Migration failed:', error)
  })

  return NextResponse.json({ started: true })
}
