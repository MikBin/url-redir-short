import { z } from 'zod';
import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { broadcaster } from '../../utils/broadcaster';
import { createRequestLogger, handleError } from '../../utils/error-handler';
import { logAudit } from '../../utils/audit';

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
});

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event);

  try {
    const user = event.context.user || await serverPocketBaseUser(event);
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

    let data;
    try {
      data = await pb.collection('links').create({
        ...payload,
        owner_id: user.id,
        is_active: true
      });
    } catch (err: any) {
      logAudit({
          actor: { id: user.id, role: user?.role },
          action: 'create',
          resource: { type: 'link', id: 'unknown' },
          status: 'failure',
          error: err.message,
          newValue: payload
      });
      throw err; // rethrow to be caught by outer catch for standard handling
    }

    logAudit({
        actor: { id: user.id, role: user?.role },
        action: 'create',
        resource: { type: 'link', id: data.id },
        status: 'success',
        newValue: data
    });

    // Transform record as needed, or broadcast the raw record for SSE Sync Endpoint to handle
    broadcaster.broadcast('create', data);

    return data;
  } catch (err) {
    return handleError(event, err, logger);
  }
});
