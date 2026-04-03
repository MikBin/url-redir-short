import { transformLink } from '../../utils/transformer';
import { syncEvents, SYNC_EVENT_NAME } from '../../utils/broadcaster';

export default defineEventHandler((event) => {
  // Enforce Sync API Key from headers
  const authHeader = getHeader(event, 'Authorization');
  const expectedToken = process.env.SYNC_API_KEY || 'local-dev-sync-key';

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  setHeader(event, 'Content-Type', 'text/event-stream');
  setHeader(event, 'Cache-Control', 'no-cache');
  setHeader(event, 'Connection', 'keep-alive');

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `data: {"type":"connected","timestamp":${Date.now()}}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectEvent));

      // Listen for database changes from broadcaster
      const listener = (payload: { type: string; data: any }) => {
        try {
          const rule = transformLink(payload.data);
          const sseMsg = `event: ${payload.type}\ndata: ${JSON.stringify(rule)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseMsg));
        } catch (e) {
          // Ignore processing errors
        }
      };

      syncEvents.on(SYNC_EVENT_NAME, listener);

      event.node.req.on('close', () => {
        syncEvents.off(SYNC_EVENT_NAME, listener);
        try { controller.close(); } catch (e) {}
      });
    }
  });

  return stream;
});
