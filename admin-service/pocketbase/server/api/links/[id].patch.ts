import { z } from 'zod';
import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { broadcaster } from '../../utils/broadcaster';

const UpdateLinkSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/).optional(),
  destination: z.string().url().optional(),
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

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
  }

  const body = await readBody(event);
  const validation = UpdateLinkSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload', data: validation.error });
  }

  const pb = await serverPocketBase(event);

  try {
    const data = await pb.collection('links').update(id, validation.data);

    broadcaster.broadcast('update', data);

    return data;
  } catch (err: any) {
    throw createError({ statusCode: err.status || 500, statusMessage: err.message || 'Error updating link' });
  }
});
