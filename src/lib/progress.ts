import { EventEmitter } from 'events'
import type { ProgressEvent } from './productboard/types'

// Module-level singleton — shared across all imports in the same process.
// Works because this app runs locally (single Node.js process).
export const migrationEmitter = new EventEmitter()

export function emitProgress(event: ProgressEvent): void {
  migrationEmitter.emit('progress', event)
}
