import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { validateBulkLinks } from '../utils/bulk'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)

  // Expecting body to be the array itself or { links: [...] }
  // Let's support { links: [...] } for extensibility
  const links = body.links || body

  try {
    const { valid, invalid } = validateBulkLinks(links)

    if (valid.length === 0) {
        return { success: 0, failed: invalid.length, invalid_items: invalid }
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
        throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return {
        success: data ? data.length : 0,
        failed: invalid.length, // counts purely invalid format
        invalid_items: invalid,
        // Note: if ignored duplicates, they won't be in 'data' usually depending on driver,
        // but let's assume 'success' is count of inserted/returned rows.
        // Actually upsert with ignoreDuplicates: true returns null for ignored rows in some versions,
        // or just returns the rows that were inserted/updated.
    }
  } catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: e.message })
  }
})
