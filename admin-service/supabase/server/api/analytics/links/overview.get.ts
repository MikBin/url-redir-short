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

  // Fetch click counts from analytics_aggregates
  // We want to sum click_count group by link_id
  const { data, error } = await client
    .from('analytics_aggregates')
    .select('link_id, click_count')

  if (error) {
    console.error('Error fetching aggregates:', error)
    return {}
  }

  const clicksByLink: Record<string, number> = {}

  if (data) {
    for (const row of data) {
      if (row.link_id) {
        clicksByLink[row.link_id] = (clicksByLink[row.link_id] || 0) + (row.click_count || 0)
      }
    }
  }

  return clicksByLink
})
