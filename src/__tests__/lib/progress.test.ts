import { migrationEmitter, emitProgress } from '@/lib/progress'
import type { ProgressEvent } from '@/lib/productboard/types'

describe('Progress System', () => {
  it('emitProgress fires a progress event on the emitter', (done) => {
    const event: ProgressEvent = {
      step: 'products',
      status: 'in_progress',
      migrated: 1,
      total: 10,
    }

    migrationEmitter.once('progress', (received: ProgressEvent) => {
      expect(received).toEqual(event)
      done()
    })

    emitProgress(event)
  })
})
