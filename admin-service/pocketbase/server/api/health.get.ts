import { defineEventHandler, setResponseStatus, setHeader } from 'h3';
import { getHealthStatus } from '../utils/monitoring';

export default defineEventHandler(async (event) => {
  const healthStatus = await getHealthStatus(event);

  if (healthStatus.status === 'unhealthy') {
    setResponseStatus(event, 503);
  } else if (healthStatus.status === 'degraded') {
    setResponseStatus(event, 200); // Matches what Supabase does (implicitly by not 503ing)
  }

  setHeader(event, 'Cache-Control', 'public, max-age=10');

  return healthStatus;
});
