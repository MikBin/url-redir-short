import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const QuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  perPage: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  action: z.enum(['create', 'update', 'delete']).optional()
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })

  const query = getQuery(event)
  const validation = QuerySchema.safeParse(query)
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params', data: validation.error })
  }

  const { page, perPage, action } = validation.data
  const client = await serverSupabaseClient(event)

  // Ensure the user owns the link first (RLS applies, but this provides a 404 if not found/unauthorized)
  const { data: link, error: linkError } = await client
    .from('links')
    .select('id')
    .eq('id', id)
    .single()

  if (linkError) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' })
  }

  let dbQuery = client
    .from('link_audit_log')
    .select(`
      id,
      action,
      changes,
      created_at,
      actor_id
    `, { count: 'exact' })
    .eq('link_id', id)
    .order('created_at', { ascending: false })

  if (action) {
    dbQuery = dbQuery.eq('action', action)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  dbQuery = dbQuery.range(from, to)

  const { data, error, count } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  // Formatting response
  const entries = data.map((entry: any) => ({
      id: entry.id,
      action: entry.action,
      actorId: entry.actor_id,
      changes: entry.changes,
      createdAt: entry.created_at
  }))

  return {
    entries,
    total: count || 0,
    page,
    perPage
  }
})
