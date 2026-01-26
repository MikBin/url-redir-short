import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { logAudit } from '../../utils/audit'

const UpdateLinkSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/).optional(),
  destination: z.string().url().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_clicks: z.number().nullable().optional(),
  password_protection: z.object({
    enabled: z.boolean(),
    password: z.string().optional()
  }).optional(),
  hsts: z.object({
    enabled: z.boolean(),
    maxAge: z.number(),
    includeSubDomains: z.boolean(),
    preload: z.boolean()
  }).optional(),
  targeting: z.object({
    enabled: z.boolean(),
    rules: z.array(z.any())
  }).optional(),
  ab_testing: z.object({
    enabled: z.boolean(),
    variations: z.array(z.any())
  }).optional(),
  updated_at: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })

  const body = await readBody(event)
  const validation = UpdateLinkSchema.safeParse(body)
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload', data: validation.error })
  }

  const payload = validation.data
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

  // Update
  const { data, error } = await client
    .from('links')
    .update({
        ...payload,
        updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    logAudit({
        actor: { id: user.id, role: user.role },
        action: 'update',
        resource: { type: 'link', id },
        status: 'failure',
        error: error.message,
        oldValue: oldData,
        newValue: payload
    })
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  logAudit({
      actor: { id: user.id, role: user.role },
      action: 'update',
      resource: { type: 'link', id: data.id },
      status: 'success',
      oldValue: oldData,
      newValue: data
  })

  return data
})
