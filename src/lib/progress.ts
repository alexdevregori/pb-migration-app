import { EventEmitter } from 'events'
import type { ProgressEvent } from './productboard/types'

// Next.js App Router bundles each route module independently, so a plain
// module-level singleton would create separate instances per route.
// Anchoring on globalThis gives one shared instance for the whole process.
declare global {
  // eslint-disable-next-line no-var
  var __migrationEmitter: EventEmitter | undefined
}

if (!globalThis.__migrationEmitter) {
  globalThis.__migrationEmitter = new EventEmitter()
  globalThis.__migrationEmitter.setMaxListeners(50)
}

export const migrationEmitter = globalThis.__migrationEmitter

export function emitProgress(event: ProgressEvent): void {
  migrationEmitter.emit('progress', event)
}
