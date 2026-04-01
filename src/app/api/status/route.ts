import { migrationEmitter } from '@/lib/progress'
import type { ProgressEvent } from '@/lib/productboard/types'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function listener(event: ProgressEvent) {
        const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        controller.enqueue(data)
      }

      migrationEmitter.on('progress', listener)

      // Send a heartbeat comment every 15s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Return cleanup function
      return () => {
        migrationEmitter.off('progress', listener)
        clearInterval(heartbeat)
      }
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
