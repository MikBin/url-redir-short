import { z } from 'zod';
import { serverPocketBase } from '../../../utils/pocketbase';

export const HistoryQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  perPage: z.string().regex(/^\d+$/).default('20').transform(Number),
  action: z.enum(['create', 'update', 'delete']).optional()
});

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
  }

  const query = getQuery(event);
  const validation = HistoryQuerySchema.safeParse(query);

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: validation.error
    });
  }

  const { page, perPage, action } = validation.data;
  const pb = await serverPocketBase(event);

  try {
    await pb.collection('links').getOne(id);
  } catch (err: any) {
    if (err.status === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' });
    }
    throw createError({ statusCode: 500, statusMessage: 'Error fetching link' });
  }

  let filter = `link_id = '${id}'`;
  if (action) {
    filter += ` && action = '${action}'`;
  }

  try {
    const result = await pb.collection('link_audit_log').getList(page, perPage, {
      filter,
      sort: '-created'
    });

    const entries = result.items.map(item => ({
      id: item.id,
      action: item.action,
      actorId: item.actor_id,
      changes: item.changes,
      createdAt: item.created
    }));

    return {
      entries,
      total: result.totalItems,
      page: result.page,
      perPage: result.perPage
    };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message || 'Error fetching audit log' });
  }
});
