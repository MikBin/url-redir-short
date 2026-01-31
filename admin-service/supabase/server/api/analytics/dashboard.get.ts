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
      aggregatesResult
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

      // Fetch raw events for last 30 days for aggregation (fallback since analytics_aggregates is unused)
      client.from('analytics_events')
        .select('path, timestamp, country, device_type, browser')
        .gte('timestamp', monthStart.toISOString())
        .limit(10000)
    ])

    const rawEvents = aggregatesResult.data || []

    // Process Top Links
    const linkClicks: Record<string, number> = {}
    // Process geographic distribution
    const geoMap: Record<string, number> = {}
    // Process device distribution
    const deviceMap: Record<string, number> = {}
    // Process browser distribution
    const browserMap: Record<string, number> = {}
    // Process hourly trend (last 24 hours)
    const hourlyBreakdown: Record<string, number> = {}

    // Initialize hourly breakdown for last 24h
    const trendStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourKey = hourDate.toISOString().substring(0, 13) + ':00:00Z'
      hourlyBreakdown[hourKey] = 0
    }

    rawEvents.forEach((event: any) => {
      // Top Links
      const path = event.path || 'unknown'
      linkClicks[path] = (linkClicks[path] || 0) + 1

      // Geo
      if (event.country) {
        geoMap[event.country] = (geoMap[event.country] || 0) + 1
      }

      // Device
      const device = event.device_type || 'unknown'
      deviceMap[device] = (deviceMap[device] || 0) + 1

      // Browser
      const browser = event.browser || 'unknown'
      browserMap[browser] = (browserMap[browser] || 0) + 1

      // Hourly (only if within last 24h)
      if (event.timestamp) {
        const eventTime = new Date(event.timestamp)
        if (eventTime >= trendStart && eventTime <= now) {
           const hourKey = eventTime.toISOString().substring(0, 13) + ':00:00Z'
           if (hourlyBreakdown[hourKey] !== undefined) {
             hourlyBreakdown[hourKey]++
           }
        }
      }
    })

    const topLinks = Object.entries(linkClicks)
      .map(([path, clicks]) => ({ path, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    const geoDistribution = Object.entries(geoMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const deviceDistribution = Object.entries(deviceMap)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)

    const browserDistribution = Object.entries(browserMap)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const hourlyTrend = Object.entries(hourlyBreakdown)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

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
