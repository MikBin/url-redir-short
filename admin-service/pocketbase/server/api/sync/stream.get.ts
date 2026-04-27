import { syncEvents, SYNC_EVENT_NAME } from '../../utils/broadcaster'

export default defineEventHandler(async (event) => {
  // 1. Authorization
  let authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    const query = getQuery(event)
    if (query.apiKey) {
      authHeader = `Bearer ${query.apiKey}`
    }
  }

  // Use runtime configuration or environment variables directly
  const apiKey = process.env.SYNC_API_KEY
  console.log(`[Sync] Auth check: Received="${authHeader}", Expected="Bearer ${apiKey}"`)
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized', received: authHeader, expected: `Bearer ${apiKey ? '***' : 'MISSING'}` }
  }

  // 2. SSE Setup
  const eventStream = createEventStream(event)

  // 3. Define event listener
  const listener = (data: any) => {
    console.log(`[Sync Stream] Sending event: ${data.event} for ${data.data?.id}`);
    eventStream.push({
      event: data.event,
      data: JSON.stringify(data.data)
    })
  }

  // Send initial connection event
  eventStream.push({ data: JSON.stringify({ type: 'connected', timestamp: Date.now() }) })

  syncEvents.on(SYNC_EVENT_NAME, listener)

  // Cleanup when request closes
  eventStream.onClosed(() => {
    syncEvents.off(SYNC_EVENT_NAME, listener)
  })

  return eventStream.send()
})
