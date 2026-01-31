import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';

const PORT = parseInt(process.env.PORT || '3001', 10);
const RULE_COUNT = parseInt(process.env.RULE_COUNT || '5000', 10);
const CHURN_ENABLED = process.env.CHURN === 'true';
const CHURN_INTERVAL = parseInt(process.env.CHURN_INTERVAL || '1000', 10);

const app = new Hono();

console.log(`[MockAdmin] Starting with configuration:`);
console.log(`- Port: ${PORT}`);
console.log(`- Rules: ${RULE_COUNT}`);
console.log(`- Churn: ${CHURN_ENABLED} (${CHURN_INTERVAL}ms)`);

app.get('/health', (c) => c.json({ status: 'ok' }));
app.post('/v1/collect', (c) => c.json({ status: 'ok' }));

app.get('/sync/stream', (c) => {
  console.log('[MockAdmin] Client connected to SSE stream');

  return streamSSE(c, async (stream) => {
    // 1. Send initial batch of rules
    console.log(`[MockAdmin] Sending ${RULE_COUNT} initial rules...`);

    // Send in chunks to avoid blocking too long
    const batchSize = 100;
    for (let i = 0; i < RULE_COUNT; i += batchSize) {
      for (let j = 0; j < batchSize && (i + j) < RULE_COUNT; j++) {
        const id = i + j;
        const payload = {
          type: 'create',
          data: {
            id: `rule-${id}`,
            path: `/load-${id}`,
            destination: `https://example.com/dest-${id}`,
            code: 301,
            // Add some metadata to simulate realistic payload
            metadata: {
              owner: `user-${id % 100}`,
              created_at: new Date().toISOString()
            }
          }
        };

        await stream.writeSSE({
          data: JSON.stringify(payload.data),
          event: payload.type,
          id: String(Date.now() + id),
        });
      }
      // Small breathing room
      await new Promise(r => setTimeout(r, 10));
    }

    console.log('[MockAdmin] Initial sync complete.');

    // 2. Handle Churn (if enabled)
    if (CHURN_ENABLED) {
      console.log('[MockAdmin] Starting churn loop...');
      while (true) {
        await new Promise(r => setTimeout(r, CHURN_INTERVAL));

        // Randomly update or delete a rule
        const id = Math.floor(Math.random() * RULE_COUNT);
        const isDelete = Math.random() > 0.8; // 20% deletes

        const payload = isDelete
          ? {
              type: 'delete',
              data: { id: `rule-${id}` }
            }
          : {
              type: 'update',
              data: {
                id: `rule-${id}`,
                path: `/load-${id}`, // Keep path same to avoid 404s during load test
                destination: `https://example.com/updated-${id}-${Date.now()}`,
                code: 302,
                metadata: {
                  owner: `user-${id % 100}`,
                  created_at: new Date().toISOString()
                }
              }
            };

        try {
          await stream.writeSSE({
            data: JSON.stringify(payload.data),
            event: payload.type,
            id: String(Date.now()),
          });
          // console.log(`[MockAdmin] Churn event: ${payload.type} rule-${id}`);
        } catch (e) {
          console.log('[MockAdmin] Stream closed');
          break;
        }
      }
    } else {
      // Keep connection open indefinitely
      while (true) {
        await new Promise(r => setTimeout(r, 1000));
        // Optional: Send keepalive
        // await stream.writeSSE({ event: 'ping', data: '' });
      }
    }
  });
});

serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log(`[MockAdmin] Server listening on http://localhost:${info.port}`);
});
