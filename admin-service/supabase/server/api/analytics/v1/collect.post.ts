import { serverSupabaseServiceRole } from '#supabase/server'

interface AnalyticsPayload {
  path: string
  destination: string
  timestamp: string
  ip: string
  user_agent: string | null
  referrer: string | null
  referrer_source: 'explicit' | 'implicit' | 'none'
  status: number
}

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)
  const body = await readBody<AnalyticsPayload>(event)

  // Basic validation
  if (!body || !body.path || !body.destination) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Payload',
    })
  }

  // Validate timestamp
  if (body.timestamp && isNaN(Date.parse(body.timestamp))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Timestamp',
    })
  }

  const { error } = await client
    .from('analytics_events')
    .insert({
      path: body.path,
      destination: body.destination,
      timestamp: body.timestamp, // Ensure format matches timestamptz (ISO string usually works)
      ip: body.ip,
      user_agent: body.user_agent,
      referrer: body.referrer,
      referrer_source: body.referrer_source,
      status: body.status
    })

  if (error) {
    console.error('Failed to store analytics:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }

  return { success: true }
})
