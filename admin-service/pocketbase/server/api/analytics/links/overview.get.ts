import { defineEventHandler, createError } from 'h3';
import { serverPocketBase } from '../../../utils/pocketbase';
import { aggregateLinkClicks } from '../../../utils/analytics';

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  try {
    const pb = await serverPocketBase(event);

    // Fetch analytics_aggregates records (paginated, up to 500)
    const result = await pb.collection('analytics_aggregates').getList(1, 500);

    // Aggregate click_count per link_id
    const aggregatedClicks = aggregateLinkClicks(result.items as any[]);

    return aggregatedClicks;
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return {};
  }
});
