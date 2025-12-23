import { syncEvents, SYNC_EVENT_NAME } from '../../utils/broadcaster'

export default defineEventHandler(async (event) => {
  // 1. Authorization
  const authHeader = getHeader(event, 'authorization')
  // Simple Bearer check
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  // 2. SSE Setup
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setResponseStatus(event, 200)

  // 3. Create Stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: any) => {
        const str = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(str))
      }

      // Send initial ping or handshake
      send({ type: 'connected', timestamp: Date.now() })

      // Listener
      const listener = (data: any) => {
        send(data)
      }

      syncEvents.on(SYNC_EVENT_NAME, listener)

      // Cleanup
      event.node.req.on('close', () => {
        syncEvents.off(SYNC_EVENT_NAME, listener)
        // controller.close() // Usually not needed if req closed, but good practice if we were closing from server side
      })
    }
  })

  return stream
})
