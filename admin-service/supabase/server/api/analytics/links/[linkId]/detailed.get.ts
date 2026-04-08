import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { createRequestLogger, handleError } from '../../../../utils/error-handler'
import { analyticsQuerySchema } from '../../../../utils/sanitizer'

export default defineEventHandler(async (event) => {
  const logger = event.context.logger || createRequestLogger(event)

  try {
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const linkId = getRouterParam(event, 'linkId')
    if (!linkId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid link ID' })
    }

    const query = getQuery(event)
    const params = analyticsQuerySchema.safeParse(query)
    if (!params.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: params.error.errors })
    }

    const client = await serverSupabaseClient(event)

    // Verify link ownership
    const { data: link, error: linkError } = await client
      .from('links')
      .select('id, slug, destination, owner_id')
      .eq('id', linkId)
      .single()

    if (linkError || !link) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' })
    }

    if (link.owner_id !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const now = new Date()
    const fromDate = params.data.from ? new Date(params.data.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const toDate = params.data.to ? new Date(params.data.to) : now
    const groupBy = params.data.groupBy || 'day'

    // Execute aggregation RPC at the database level
    const { data: stats, error: statsError } = await client.rpc('get_link_detailed_stats', {
      p_link_id: linkId,
      p_from: fromDate.toISOString(),
      p_to: toDate.toISOString(),
      p_group_by: groupBy
    })

    if (statsError) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to fetch analytics' })
    }

    // Set cache headers (cache historical data longer)
    const isHistoricalData = toDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)
    event.node.res.setHeader('Cache-Control', isHistoricalData ? 'private, max-age=3600' : 'private, max-age=60')

    return {
      link: {
        id: link.id,
        slug: link.slug,
        destination: link.destination
      },
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      },
      summary: {
        totalClicks: stats.total_clicks || 0,
        uniqueVisitors: stats.unique_visitors || 0
      },
      timeSeries: stats.time_series || [],
      geographic: {
        countries: stats.countries || [],
        cities: stats.cities || []
      },
      devices: stats.devices || [],
      browsers: stats.browsers || [],
      operatingSystems: stats.operating_systems || [],
      referrers: stats.referrers || [],
      generatedAt: now.toISOString()
    }
  } catch (error) {
    handleError(event, error, logger)
  }
})
