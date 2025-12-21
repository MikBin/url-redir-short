import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo'
import { HandleRequestUseCase } from '../../use-cases/handle-request';

export const createApp = (handleRequest: HandleRequestUseCase) => {
  const app = new Hono();

  app.get('/health', (c) => c.text('OK'));

  app.get('*', async (c) => {
    const path = new URL(c.req.url).pathname;

    // Get IP for analytics (Node.js specific way via conninfo helper, or header fallback)
    // Cloudflare Workers will have it in c.req.header('CF-Connecting-IP')
    let ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip');

    if (!ip) {
        // Fallback for Node.js local dev
        const info = getConnInfo(c);
        ip = info.remote.address || '127.0.0.1';
    }

    const rule = await handleRequest.execute(
        path,
        c.req.raw.headers,
        ip,
        c.req.url
    );

    if (rule) {
      // Create response
      const res = c.redirect(rule.destination, rule.code);

      // Phase 3.3: HSTS
      if (rule.hsts && rule.hsts.enabled) {
        let hstsValue = `max-age=${rule.hsts.maxAge || 31536000}`;
        if (rule.hsts.includeSubDomains) {
          hstsValue += '; includeSubDomains';
        }
        if (rule.hsts.preload) {
          hstsValue += '; preload';
        }
        res.headers.set('Strict-Transport-Security', hstsValue);
      }

      return res;
    }

    return c.notFound();
  });

  return app;
};
