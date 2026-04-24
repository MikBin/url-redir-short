import { defineEventHandler, setHeader, createError } from 'h3';
import { createRequestLogger, handleError } from '../utils/error-handler';
import { getMetrics } from '../utils/monitoring';

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event);

  try {
    // Requires authentication
    if (!event.context.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    setHeader(event, 'Cache-Control', 'no-store');

    return getMetrics();
  } catch (error) {
    return handleError(event, error, logger);
  }
});
