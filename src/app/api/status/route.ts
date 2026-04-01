import { migrationEmitter } from '@/lib/progress'
import type { ProgressEvent } from '@/lib/productboard/types'

export async function GET() {
  const encoder = new TextEncoder()

  // Declared outside start() so cancel() can reference them
  let progressListener: ((event: ProgressEvent) => void) | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      progressListener = (event: ProgressEvent) => {
        const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        controller.enqueue(data)
      }

      migrationEmitter.on('progress', progressListener)

      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeatTimer !== null) clearInterval(heartbeatTimer)
        }
      }, 15000)
    },
    cancel() {
      if (progressListener) migrationEmitter.off('progress', progressListener)
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
