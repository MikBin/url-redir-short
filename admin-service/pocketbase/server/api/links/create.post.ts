import { z } from 'zod';
import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { broadcaster } from '../../utils/broadcaster';

const CreateLinkSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/),
  destination: z.string().url(),
  domain_id: z.string().optional(),
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
});

export default defineEventHandler(async (event) => {
  const user = await serverPocketBaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  const validation = CreateLinkSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload', data: validation.error });
  }

  const payload = validation.data;
  const pb = await serverPocketBase(event);

  try {
    const data = await pb.collection('links').create({
      ...payload,
      owner_id: user.id,
      is_active: true
    });

    // Transform record as needed, or broadcast the raw record for SSE Sync Endpoint to handle
    broadcaster.broadcast('create', data);

    return data;
  } catch (err: any) {
    throw createError({ statusCode: err.status || 500, statusMessage: err.message || 'Error creating link' });
  }
});
