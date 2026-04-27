import { defineEventHandler, createError } from 'h3';
import { serverPocketBase } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const pb = await serverPocketBase(event);

  try {
    const [eventsResult, totalClicksResult] = await Promise.all([
      pb.collection('analytics_events').getList(1, 100, { sort: '-created' }),
      pb.collection('analytics_events').getList(1, 1)
    ]);

    return {
      events: eventsResult.items,
      totalClicks: totalClicksResult.totalItems,
    };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: 'Database error' });
  }
});
