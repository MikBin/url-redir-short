import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const client = await serverSupabaseClient(event)

  // Fetch latest events
  const { data: events, error } = await client
    .from('analytics_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  // Calculate some basic stats
  const totalClicks = await client.from('analytics_events').select('*', { count: 'exact', head: true })

  return {
    events,
    totalClicks: totalClicks.count
  }
})
