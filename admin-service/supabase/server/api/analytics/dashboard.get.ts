import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { createRequestLogger, handleError } from '../../utils/error-handler'

export default defineEventHandler(async (event) => {
  const logger = event.context.logger || createRequestLogger(event)

  try {
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const client = await serverSupabaseClient(event)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(todayStart)
    monthStart.setDate(monthStart.getDate() - 30)

    // Execute all queries in parallel
    const [
      totalClicksResult,
      todayClicksResult,
      weekClicksResult,
      monthClicksResult,
      topLinksResult,
      geoDistributionResult,
      deviceDistributionResult,
      browserDistributionResult,
      hourlyTrendResult
    ] = await Promise.all([
      // Total clicks (all time)
      client.from('analytics_events').select('*', { count: 'exact', head: true }),

      // Today's clicks
      client.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', todayStart.toISOString()),

      // This week's clicks
      client.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', weekStart.toISOString()),

      // This month's clicks
      client.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', monthStart.toISOString()),

      // Top 10 links by clicks
      client.rpc('get_top_links', { limit_count: 10 }).catch(() => ({ data: null, error: null })),

      // Geographic distribution
      client.from('analytics_events')
        .select('country')
        .not('country', 'is', null)
        .gte('timestamp', monthStart.toISOString())
        .limit(10000),

      // Device distribution
      client.from('analytics_events')
        .select('device_type')
        .not('device_type', 'is', null)
        .gte('timestamp', monthStart.toISOString())
        .limit(10000),

      // Browser distribution
      client.from('analytics_events')
        .select('browser')
        .not('browser', 'is', null)
        .gte('timestamp', monthStart.toISOString())
        .limit(10000),

      // Hourly trend for last 24 hours
      client.from('analytics_events')
        .select('timestamp')
        .gte('timestamp', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true })
        .limit(10000)
    ])

    // Process geographic distribution
    const geoData = geoDistributionResult.data || []
    const geoBreakdown = geoData.reduce((acc: Record<string, number>, row: { country: string }) => {
      acc[row.country] = (acc[row.country] || 0) + 1
      return acc
    }, {})
    const geoDistribution = Object.entries(geoBreakdown)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 10)

    // Process device distribution
    const deviceData = deviceDistributionResult.data || []
    const deviceBreakdown = deviceData.reduce((acc: Record<string, number>, row: { device_type: string }) => {
      acc[row.device_type] = (acc[row.device_type] || 0) + 1
      return acc
    }, {})
    const deviceDistribution = Object.entries(deviceBreakdown)
      .map(([device, count]) => ({ device, count }))

    // Process browser distribution
    const browserData = browserDistributionResult.data || []
    const browserBreakdown = browserData.reduce((acc: Record<string, number>, row: { browser: string }) => {
      acc[row.browser] = (acc[row.browser] || 0) + 1
      return acc
    }, {})
    const browserDistribution = Object.entries(browserBreakdown)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 10)

    // Process hourly trend
    const hourlyData = hourlyTrendResult.data || []
    const hourlyBreakdown: Record<string, number> = {}
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourKey = hourDate.toISOString().substring(0, 13) + ':00:00Z'
      hourlyBreakdown[hourKey] = 0
    }
    hourlyData.forEach((row: { timestamp: string }) => {
      const hourKey = row.timestamp.substring(0, 13) + ':00:00Z'
      if (hourlyBreakdown[hourKey] !== undefined) {
        hourlyBreakdown[hourKey]++
      }
    })
    const hourlyTrend = Object.entries(hourlyBreakdown)
      .map(([hour, count]) => ({ hour, count }))

    // Get top links from path aggregation if RPC doesn't exist
    let topLinks = topLinksResult.data
    if (!topLinks) {
      const pathResult = await client.from('analytics_events')
        .select('path')
        .gte('timestamp', monthStart.toISOString())
        .limit(10000)

      const pathBreakdown = (pathResult.data || []).reduce((acc: Record<string, number>, row: { path: string }) => {
        acc[row.path] = (acc[row.path] || 0) + 1
        return acc
      }, {})
      topLinks = Object.entries(pathBreakdown)
        .map(([path, clicks]) => ({ path, clicks }))
        .sort((a, b) => (b.clicks as number) - (a.clicks as number))
        .slice(0, 10)
    }

    // Set cache headers for this data (cache for 1 minute)
    event.node.res.setHeader('Cache-Control', 'private, max-age=60')

    return {
      summary: {
        totalClicks: totalClicksResult.count || 0,
        todayClicks: todayClicksResult.count || 0,
        weekClicks: weekClicksResult.count || 0,
        monthClicks: monthClicksResult.count || 0
      },
      topLinks,
      geoDistribution,
      deviceDistribution,
      browserDistribution,
      hourlyTrend,
      generatedAt: now.toISOString()
    }
  } catch (error) {
    handleError(event, error, logger)
  }
})
