import { Hono } from 'hono';
import { HandleRequestUseCase } from '../../use-cases/handle-request';

export const createApp = (handleRequest: HandleRequestUseCase) => {
  const app = new Hono();

  app.get('/health', (c) => c.text('OK'));

  app.get('*', async (c) => {
    const path = new URL(c.req.url).pathname;
    const rule = handleRequest.execute(path);

    if (rule) {
      return c.redirect(rule.destination, rule.code);
    }

    return c.notFound();
  });

  return app;
};
