import { defineEventHandler, getRouterParam, getQuery, setHeader, createError } from 'h3'
import { createRequestLogger, handleError } from '../../../utils/error-handler'
import { serverPocketBase } from '../../../utils/pocketbase'
import { exportQuerySchema } from '../../../utils/sanitizer'

// Exporting for testing
export function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data available'
  }

  const headers = Object.keys(data[0])
  const csvRows = []

  // Add header row
  csvRows.push(headers.map(header => `"${header}"`).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header]
      if (val === null || val === undefined) {
        val = ''
      }
      const stringVal = String(val)
      // Escape quotes by doubling them, wrap in quotes if contains comma, quote, or newline
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`
      }
      return stringVal
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event)

  try {
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized',
      })
    }

    const format = getRouterParam(event, 'format')
    if (format !== 'csv' && format !== 'json') {
      throw createError({
        statusCode: 400,
        message: 'Invalid export format. Must be "csv" or "json".',
      })
    }

    const rawQuery = getQuery(event)
    const parsedQuery = exportQuerySchema.safeParse({
      ...rawQuery,
      format // Inject format into query object to satisfy schema if needed
    })

    if (!parsedQuery.success) {
      throw createError({
        statusCode: 400,
        message: 'Invalid query parameters',
        data: parsedQuery.error.format(),
      })
    }

    const query = parsedQuery.data
    const pb = await serverPocketBase(event)

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const fromDate = query.from ? new Date(query.from) : thirtyDaysAgo
    const toDate = query.to ? new Date(query.to) : now

    let filter = `timestamp >= "${fromDate.toISOString().replace('T', ' ')}" && timestamp <= "${toDate.toISOString().replace('T', ' ')}"`

    if (query.linkId) {
      try {
        const link = await pb.collection('links').getOne(query.linkId)
        if (link.owner_id !== user.id) {
          throw createError({
            statusCode: 403,
            message: 'Forbidden: You do not own this link',
          })
        }
        filter += ` && path = "${link.slug}"`
      } catch (err: any) {
        if (err.statusCode === 403) throw err
        throw createError({
          statusCode: 404,
          message: 'Link not found',
        })
      }
    }

    const records = await pb.collection('analytics_events').getFullList({
      filter,
      sort: '-timestamp',
      batch: 500,
    })

    const selectedFields = ['id', 'path', 'destination', 'timestamp', 'country', 'city', 'device_type', 'browser', 'os', 'referrer', 'status']

    const data = records.map((record) => {
      const filteredRecord: any = {}
      for (const field of selectedFields) {
        filteredRecord[field] = record[field]
      }
      return filteredRecord
    })

    const dateStr = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      const csvData = convertToCSV(data)
      setHeader(event, 'Content-Type', 'text/csv')
      setHeader(event, 'Content-Disposition', `attachment; filename="analytics-export-${dateStr}.csv"`)
      return csvData
    }

    // json format
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="analytics-export-${dateStr}.json"`)

    return {
      exportedAt: new Date().toISOString(),
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      totalRecords: data.length,
      data,
    }

  } catch (error) {
    return handleError(event, error, logger)
  }
})
