import { defineEventHandler, getRouterParam, getQuery, setHeader, createError } from 'h3'
import { createRequestLogger, handleError } from '../../../../utils/error-handler'
import { serverPocketBase } from '../../../../utils/pocketbase'
import { analyticsQuerySchema } from '../../../../utils/sanitizer'

export function aggregateEvents(events: any[]) {
  const totalClicks = events.length
  const uniqueSessionIds = new Set()

  const timeSeriesMap = new Map<string, number>()
  const countriesMap = new Map<string, number>()
  const citiesMap = new Map<string, number>()
  const devicesMap = new Map<string, number>()
  const browsersMap = new Map<string, number>()
  const osMap = new Map<string, number>()
  const referrersMap = new Map<string, number>()

  for (const event of events) {
    if (event.session_id) {
      uniqueSessionIds.add(event.session_id)
    }

    // Time series (YYYY-MM-DD)
    const date = event.timestamp ? event.timestamp.substring(0, 10) : 'unknown'
    timeSeriesMap.set(date, (timeSeriesMap.get(date) || 0) + 1)

    if (event.country) {
      countriesMap.set(event.country, (countriesMap.get(event.country) || 0) + 1)
    }
    if (event.city) {
      citiesMap.set(event.city, (citiesMap.get(event.city) || 0) + 1)
    }
    if (event.device_type) {
      devicesMap.set(event.device_type, (devicesMap.get(event.device_type) || 0) + 1)
    }
    if (event.browser) {
      browsersMap.set(event.browser, (browsersMap.get(event.browser) || 0) + 1)
    }
    if (event.os) {
      osMap.set(event.os, (osMap.get(event.os) || 0) + 1)
    }
    if (event.referrer) {
      referrersMap.set(event.referrer, (referrersMap.get(event.referrer) || 0) + 1)
    }
  }

  const mapToArray = (map: Map<string, number>, keyName: string) => {
    return Array.from(map.entries())
      .map(([key, count]) => ({ [keyName]: key, count }))
      .sort((a, b) => b.count - a.count)
  }

  return {
    totalClicks,
    uniqueVisitors: uniqueSessionIds.size,
    timeSeries: Array.from(timeSeriesMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    countries: mapToArray(countriesMap, 'country'),
    cities: mapToArray(citiesMap, 'city'),
    devices: mapToArray(devicesMap, 'device'),
    browsers: mapToArray(browsersMap, 'browser'),
    operatingSystems: mapToArray(osMap, 'os'),
    referrers: mapToArray(referrersMap, 'referrer')
  }
}

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event)

  try {
    if (!event.context.user) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    const linkId = getRouterParam(event, 'linkId')
    if (!linkId || linkId.trim() === '') {
      throw createError({ statusCode: 400, message: 'Missing linkId' })
    }

    let query
    try {
      query = analyticsQuerySchema.parse(getQuery(event))
    } catch (e: any) {
      throw createError({ statusCode: 400, message: 'Invalid query parameters: ' + e.message })
    }

    const pb = await serverPocketBase(event)

    let link
    try {
      link = await pb.collection('links').getOne(linkId)
    } catch (e: any) {
      throw createError({ statusCode: 404, message: 'Link not found' })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const fromDate = query.from || thirtyDaysAgo.toISOString()
    const toDate = query.to || now.toISOString()

    const filter = `link_id = "${linkId}" && timestamp >= "${fromDate}" && timestamp <= "${toDate}"`
    const events = await pb.collection('analytics_events').getFullList({
      filter,
      sort: '-timestamp'
    })

    const aggregations = aggregateEvents(events)

    setHeader(event, 'Cache-Control', 'private, max-age=60')

    return {
      link: {
        id: link.id,
        slug: link.slug,
        destination: link.destination
      },
      dateRange: {
        from: fromDate,
        to: toDate
      },
      summary: {
        totalClicks: aggregations.totalClicks,
        uniqueVisitors: aggregations.uniqueVisitors
      },
      timeSeries: aggregations.timeSeries,
      geographic: {
        countries: aggregations.countries,
        cities: aggregations.cities
      },
      devices: aggregations.devices,
      browsers: aggregations.browsers,
      operatingSystems: aggregations.operatingSystems,
      referrers: aggregations.referrers,
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    return handleError(event, error, logger)
  }
})
