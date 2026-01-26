import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { logAudit } from '../../utils/audit'

const CreateLinkSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/),
  destination: z.string().url(),
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
  }).optional()
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const validation = CreateLinkSchema.safeParse(body)
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload', data: validation.error })
  }

  const payload = validation.data
  const client = await serverSupabaseClient(event)

  // Insert
  const { data, error } = await client
    .from('links')
    .insert({
      ...payload,
      owner_id: user.id
    })
    .select()
    .single()

  if (error) {
    logAudit({
        actor: { id: user.id, role: user.role },
        action: 'create',
        resource: { type: 'link', id: 'unknown' },
        status: 'failure',
        error: error.message,
        newValue: payload
    })
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  logAudit({
      actor: { id: user.id, role: user.role },
      action: 'create',
      resource: { type: 'link', id: data.id },
      status: 'success',
      newValue: data
  })

  return data
})
