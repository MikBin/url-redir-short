import { defineEventHandler, setResponseStatus, setHeader } from 'h3';
import { getHealthStatus } from '../utils/monitoring';

export default defineEventHandler(async (event) => {
  const healthStatus = await getHealthStatus(event);

  if (healthStatus.status === 'unhealthy') {
    setResponseStatus(event, 503);
  } else {
    setResponseStatus(event, 200);
  }

  setHeader(event, 'Cache-Control', 'public, max-age=10');

  return healthStatus;
});
