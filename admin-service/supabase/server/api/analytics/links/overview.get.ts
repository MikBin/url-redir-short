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

  // Fetch click counts from aggregated view
  const { data, error } = await client
    .from('link_analytics_overview')
    .select('link_id, total_clicks')

  if (error) {
    console.error('Error fetching aggregates:', error)
    return {}
  }

  const clicksByLink: Record<string, number> = {}

  if (data) {
    for (const row of data as any[]) {
      if (row.link_id) {
        // Ensure it's a number as bigint sums might come back as strings from PostgREST
        clicksByLink[row.link_id] = Number(row.total_clicks) || 0
      }
    }
  }

  return clicksByLink
})
