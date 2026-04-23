import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { validateBulkLinks } from '../utils/bulk'
import { logAudit } from '../utils/audit'
import { parseCsv } from '../utils/csv-parser'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const contentType = getHeader(event, 'content-type') || ''

  let links: any[] = []
  let invalidCsvRows: any[] = []

  if (contentType.includes('multipart/form-data')) {
    const formData = await readMultipartFormData(event)
    if (!formData) {
      throw createError({ statusCode: 400, statusMessage: 'Empty form data' })
    }

    // Find the 'file' field
    const fileField = formData.find(field => field.name === 'file')
    if (!fileField || !fileField.data) {
      throw createError({ statusCode: 400, statusMessage: 'Missing file in form data' })
    }

    const bodyText = fileField.data.toString('utf8')
    const parsed = parseCsv(bodyText)
    links = parsed.rows
    invalidCsvRows = parsed.errors.map(err => ({ item: `Row ${err.row}`, error: err.message }))
  } else if (contentType.includes('text/csv')) {
    const bodyText = await readRawBody(event, 'utf8')
    if (!bodyText) {
      throw createError({ statusCode: 400, statusMessage: 'Empty CSV body' })
    }
    const parsed = parseCsv(bodyText)
    links = parsed.rows
    invalidCsvRows = parsed.errors.map(err => ({ item: `Row ${err.row}`, error: err.message }))
  } else {
    const body = await readBody(event)
    links = body.links || body
  }

  try {
    const { valid, invalid } = validateBulkLinks(links)

    // Combine JSON validation errors with CSV parsing errors
    const allInvalid = [...invalid, ...invalidCsvRows]

    if (valid.length === 0) {
        return { success: 0, failed: allInvalid.length, invalid_items: allInvalid }
    }

    const client = await serverSupabaseClient(event)

    const dataToInsert = valid.map(link => ({
        slug: link.slug,
        destination: link.destination,
        owner_id: user.id
    }))

    // using ignoreDuplicates: true to skip existing slugs
    const { data, error } = await client
        .from('links')
        .upsert(dataToInsert, { onConflict: 'slug', ignoreDuplicates: true })
        .select()

    if (error) {
        logAudit({
            actor: { id: user.id, role: user.role },
            action: 'bulk_import',
            resource: { type: 'link', id: 'bulk' },
            status: 'failure',
            error: error.message,
            newValue: { requested: valid.length }
        })
        throw createError({ statusCode: 500, statusMessage: error.message })
    }

    logAudit({
        actor: { id: user.id, role: user.role },
        action: 'bulk_import',
        resource: { type: 'link', id: 'bulk' },
        status: 'success',
        newValue: { count: data ? data.length : 0, failed: allInvalid.length },
        metadata: { invalid_items: allInvalid }
    })

    return {
        success: data ? data.length : 0,
        failed: allInvalid.length, // counts purely invalid format
        invalid_items: allInvalid,
        // Note: if ignored duplicates, they won't be in 'data' usually depending on driver,
        // but let's assume 'success' is count of inserted/returned rows.
        // Actually upsert with ignoreDuplicates: true returns null for ignored rows in some versions,
        // or just returns the rows that were inserted/updated.
    }
  } catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: e.message })
  }
})
