import { serverPocketBase } from '../../utils/pocketbase';
import { createRequestLogger, handleError } from '../../utils/error-handler';
import { processAnalyticsEvents } from '../../utils/analytics';

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event);

  try {
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const pb = await serverPocketBase(event);

    const now = new Date();

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatPbDate = (d: Date) => d.toISOString().replace('T', ' '); // PB accepts standard ISO

    const [totalClicksRes, todayClicksRes, weekClicksRes, monthClicksRes, rawEventsRes] = await Promise.all([
      pb.collection('analytics_events').getList(1, 1),
      pb.collection('analytics_events').getList(1, 1, { filter: `timestamp >= "${formatPbDate(todayStart)}"` }),
      pb.collection('analytics_events').getList(1, 1, { filter: `timestamp >= "${formatPbDate(weekStart)}"` }),
      pb.collection('analytics_events').getList(1, 1, { filter: `timestamp >= "${formatPbDate(monthStart)}"` }),
      pb.collection('analytics_events').getList(1, 10000, {
        filter: `timestamp >= "${formatPbDate(monthStart)}"`,
        fields: 'path,timestamp,country,device_type,browser'
      })
    ]);

    const aggregations = processAnalyticsEvents(rawEventsRes.items, now);

    setResponseHeader(event, 'Cache-Control', 'private, max-age=60');

    return {
      summary: {
        totalClicks: totalClicksRes.totalItems,
        todayClicks: todayClicksRes.totalItems,
        weekClicks: weekClicksRes.totalItems,
        monthClicks: monthClicksRes.totalItems
      },
      ...aggregations,
      generatedAt: now.toISOString()
    };
  } catch (error) {
    return handleError(event, error, logger);
  }
});
