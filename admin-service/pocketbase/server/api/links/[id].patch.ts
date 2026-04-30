import { z } from 'zod';
import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { broadcaster } from '../../utils/broadcaster';
import { createRequestLogger, handleError } from '../../utils/error-handler';
import { logAudit } from '../../utils/audit';

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
  }).optional()
});

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event);

  try {
    const user = event.context.user || await serverPocketBaseUser(event);
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

    let oldData;
    try {
      oldData = await pb.collection('links').getOne(id);
    } catch (err: any) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' });
    }

    let data;
    try {
      data = await pb.collection('links').update(id, validation.data);
    } catch (err: any) {
      logAudit({
          actor: { id: user.id, role: user?.role },
          action: 'update',
          resource: { type: 'link', id },
          status: 'failure',
          error: err.message,
          oldValue: oldData,
          newValue: validation.data
      });
      throw err;
    }

    logAudit({
        actor: { id: user.id, role: user?.role },
        action: 'update',
        resource: { type: 'link', id: data.id },
        status: 'success',
        oldValue: oldData,
        newValue: data
    });

    broadcaster.broadcast('update', data);

    return data;
  } catch (err) {
    return handleError(event, err, logger);
  }
});
