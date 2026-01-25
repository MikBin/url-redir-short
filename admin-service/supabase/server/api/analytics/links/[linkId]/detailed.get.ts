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

    // Build path for querying (links are stored by path)
    const path = link.slug.startsWith('/') ? link.slug : '/' + link.slug

    // Execute queries in parallel
    const [
      eventsResult,
      totalClicksResult,
      uniqueSessionsResult,
      geoResult,
      deviceResult,
      browserResult,
      osResult,
      referrerResult
    ] = await Promise.all([
      // Time series data
      client.from('analytics_events')
        .select('timestamp')
        .eq('path', path)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .order('timestamp', { ascending: true })
        .limit(10000),

      // Total clicks
      client.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('path', path)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString()),

      // Unique sessions
      client.from('analytics_events')
        .select('session_id')
        .eq('path', path)
        .not('session_id', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000),

      // Geographic breakdown
      client.from('analytics_events')
        .select('country, city')
        .eq('path', path)
        .not('country', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000),

      // Device breakdown
      client.from('analytics_events')
        .select('device_type')
        .eq('path', path)
        .not('device_type', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000),

      // Browser breakdown
      client.from('analytics_events')
        .select('browser')
        .eq('path', path)
        .not('browser', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000),

      // OS breakdown
      client.from('analytics_events')
        .select('os')
        .eq('path', path)
        .not('os', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000),

      // Referrer breakdown
      client.from('analytics_events')
        .select('referrer, referrer_source')
        .eq('path', path)
        .not('referrer', 'is', null)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .limit(10000)
    ])

    // Process time series based on groupBy
    const groupBy = params.data.groupBy || 'day'
    const timeSeriesData = processTimeSeries(eventsResult.data || [], groupBy, fromDate, toDate)

    // Process unique sessions
    const uniqueSessions = new Set((uniqueSessionsResult.data || []).map((r: { session_id: string }) => r.session_id))

    // Process geographic data
    const geoBreakdown = aggregateField(geoResult.data || [], 'country')
    const cityBreakdown = aggregateField(geoResult.data || [], 'city')

    // Process device data
    const deviceBreakdown = aggregateField(deviceResult.data || [], 'device_type')

    // Process browser data
    const browserBreakdown = aggregateField(browserResult.data || [], 'browser')

    // Process OS data
    const osBreakdown = aggregateField(osResult.data || [], 'os')

    // Process referrer data
    const referrerBreakdown = aggregateField(referrerResult.data || [], 'referrer')

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
        totalClicks: totalClicksResult.count || 0,
        uniqueVisitors: uniqueSessions.size
      },
      timeSeries: timeSeriesData,
      geographic: {
        countries: geoBreakdown,
        cities: cityBreakdown.slice(0, 20)
      },
      devices: deviceBreakdown,
      browsers: browserBreakdown,
      operatingSystems: osBreakdown,
      referrers: referrerBreakdown.slice(0, 20),
      generatedAt: now.toISOString()
    }
  } catch (error) {
    handleError(event, error, logger)
  }
})

function aggregateField(data: any[], field: string): { value: string; count: number }[] {
  const breakdown: Record<string, number> = {}
  data.forEach(row => {
    const value = row[field]
    if (value) {
      breakdown[value] = (breakdown[value] || 0) + 1
    }
  })
  return Object.entries(breakdown)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}

function processTimeSeries(
  data: { timestamp: string }[],
  groupBy: string,
  fromDate: Date,
  toDate: Date
): { period: string; count: number }[] {
  const buckets: Record<string, number> = {}

  // Initialize buckets
  const current = new Date(fromDate)
  while (current <= toDate) {
    const key = formatPeriod(current, groupBy)
    buckets[key] = 0
    incrementDate(current, groupBy)
  }

  // Count events
  data.forEach(row => {
    const date = new Date(row.timestamp)
    const key = formatPeriod(date, groupBy)
    if (buckets[key] !== undefined) {
      buckets[key]++
    }
  })

  return Object.entries(buckets).map(([period, count]) => ({ period, count }))
}

function formatPeriod(date: Date, groupBy: string): string {
  switch (groupBy) {
    case 'hour':
      return date.toISOString().substring(0, 13) + ':00:00Z'
    case 'day':
      return date.toISOString().substring(0, 10)
    case 'week':
      const weekStart = new Date(date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      return weekStart.toISOString().substring(0, 10)
    case 'month':
      return date.toISOString().substring(0, 7)
    default:
      return date.toISOString().substring(0, 10)
  }
}

function incrementDate(date: Date, groupBy: string): void {
  switch (groupBy) {
    case 'hour':
      date.setHours(date.getHours() + 1)
      break
    case 'day':
      date.setDate(date.getDate() + 1)
      break
    case 'week':
      date.setDate(date.getDate() + 7)
      break
    case 'month':
      date.setMonth(date.getMonth() + 1)
      break
    default:
      date.setDate(date.getDate() + 1)
  }
}
