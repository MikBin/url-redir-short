import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { createRequestLogger, handleError } from '../../../utils/error-handler'
import { exportQuerySchema } from '../../../utils/sanitizer'

export default defineEventHandler(async (event) => {
  const logger = event.context.logger || createRequestLogger(event)

  try {
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const format = getRouterParam(event, 'format')
    if (!format || !['csv', 'json'].includes(format)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid format. Use csv or json.' })
    }

    const query = getQuery(event)
    const params = exportQuerySchema.safeParse({ ...query, format })
    if (!params.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: params.error.errors })
    }

    const client = await serverSupabaseClient(event)

    const now = new Date()
    const fromDate = params.data.from ? new Date(params.data.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const toDate = params.data.to ? new Date(params.data.to) : now

    // Build query
    let queryBuilder = client.from('analytics_events')
      .select('id, path, destination, timestamp, country, city, device_type, browser, os, referrer, status')
      .gte('timestamp', fromDate.toISOString())
      .lte('timestamp', toDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10000)

    // Filter by link if specified
    if (params.data.linkId) {
      // Get link to verify ownership
      const { data: link, error: linkError } = await client
        .from('links')
        .select('slug, owner_id')
        .eq('id', params.data.linkId)
        .single()

      if (linkError || !link) {
        throw createError({ statusCode: 404, statusMessage: 'Link not found' })
      }

      if (link.owner_id !== user.id) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
      }

      const path = link.slug.startsWith('/') ? link.slug : '/' + link.slug
      queryBuilder = queryBuilder.eq('path', path)
    }

    const { data: events, error } = await queryBuilder

    if (error) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to fetch analytics data' })
    }

    if (format === 'csv') {
      const csv = convertToCSV(events || [])
      event.node.res.setHeader('Content-Type', 'text/csv')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${now.toISOString().substring(0, 10)}.csv"`)
      return csv
    }

    // JSON format
    event.node.res.setHeader('Content-Type', 'application/json')
    event.node.res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${now.toISOString().substring(0, 10)}.json"`)

    return {
      exportedAt: now.toISOString(),
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      },
      totalRecords: events?.length || 0,
      data: events
    }
  } catch (error) {
    handleError(event, error, logger)
  }
})

function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return 'No data available'
  }

  const headers = ['id', 'path', 'destination', 'timestamp', 'country', 'city', 'device_type', 'browser', 'os', 'referrer', 'status']
  const rows = data.map(row => 
    headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"'
      }
      return stringValue
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}
