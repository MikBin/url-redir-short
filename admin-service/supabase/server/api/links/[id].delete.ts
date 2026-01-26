import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { logAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })

  const client = await serverSupabaseClient(event)

  // Fetch old value for audit
  const { data: oldData, error: fetchError } = await client
     .from('links')
     .select('*')
     .eq('id', id)
     .single()

  if (fetchError) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' })
  }

  // Delete
  const { error } = await client
    .from('links')
    .delete()
    .eq('id', id)

  if (error) {
    logAudit({
        actor: { id: user.id, role: user.role },
        action: 'delete',
        resource: { type: 'link', id },
        status: 'failure',
        error: error.message,
        oldValue: oldData
    })
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  logAudit({
      actor: { id: user.id, role: user.role },
      action: 'delete',
      resource: { type: 'link', id },
      status: 'success',
      oldValue: oldData
  })

  return { success: true }
})
