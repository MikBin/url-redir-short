import { defineEventHandler, getRouterParam, getQuery, setHeader, createError, sendStream } from 'h3'
import { createRequestLogger, handleError } from '../../../utils/error-handler'
import { serverPocketBase } from '../../../utils/pocketbase'
import { exportQuerySchema } from '../../../utils/sanitizer'

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
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "statusCode" in err && (err as { statusCode: number }).statusCode === 403) throw err

        throw createError({
          statusCode: 404,
          message: 'Link not found',
        })
      }
    }

    const selectedFields = ['id', 'path', 'destination', 'timestamp', 'country', 'city', 'device_type', 'browser', 'os', 'referrer', 'status']

    const dateStr = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      setHeader(event, 'Content-Type', 'text/csv')
      setHeader(event, 'Content-Disposition', `attachment; filename="analytics-export-${dateStr}.csv"`)

      let currentPage = 1
      let totalPages = 1

      const stream = new ReadableStream({
        async start(controller) {
          const headers = selectedFields
          controller.enqueue(headers.map(header => `"${header}"`).join(',') + '\n')
        },
        async pull(controller) {
          if (currentPage > totalPages) {
            controller.close()
            return
          }

          try {
            const result = await pb.collection('analytics_events').getList(currentPage, 1000, {
              filter,
              sort: '-timestamp',
            })

            totalPages = result.totalPages

            if (!result.items || result.items.length === 0) {
              if (currentPage === 1) {
                controller.enqueue('No data available\n')
              }
              controller.close()
              return
            }

            const headers = selectedFields
            let chunkStr = ''
            for (const record of result.items) {
              const row: Record<string, unknown> = {}
              for (const field of selectedFields) {
                row[field] = record[field]
              }

              const values = headers.map(header => {
                let val = row[header]
                if (val === null || val === undefined) {
                  val = ''
                }
                const stringVal = String(val)
                if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                  return `"${stringVal.replace(/"/g, '""')}"`
                }
                return stringVal
              })
              chunkStr += values.join(',') + '\n'
            }

            controller.enqueue(chunkStr)
            currentPage++

          } catch (error) {
            controller.error(error)
          }
        }
      })

      return sendStream(event, stream)
    }

    // json format
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="analytics-export-${dateStr}.json"`)

    const records = await pb.collection('analytics_events').getFullList({
      filter,
      sort: '-timestamp',
      batch: 500,
    })

    const data = records.map((record) => {
      const filteredRecord: Record<string, unknown> = {}
      for (const field of selectedFields) {
        filteredRecord[field] = record[field]
      }
      return filteredRecord
    })

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
