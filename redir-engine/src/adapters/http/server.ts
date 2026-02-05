import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo'
import { HandleRequestUseCase } from '../../use-cases/handle-request';

export const createApp = (handleRequest: HandleRequestUseCase) => {
  const app = new Hono();

  app.get('/health', (c) => c.text('OK'));

  app.all('*', async (c) => {
    // Allow GET, POST, and HEAD
    if (c.req.method !== 'GET' && c.req.method !== 'POST' && c.req.method !== 'HEAD') {
       return c.text('Method not allowed', 405);
    }

    const url = new URL(c.req.url);
    const path = url.pathname;

    let ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip');
    if (!ip) {
        const info = getConnInfo(c);
        ip = info.remote.address || '127.0.0.1';
    }

    // Defer body parsing until we know the route requires a password
    const passwordProvider = async () => {
      if (c.req.method === 'POST') {
         try {
           const body = await c.req.parseBody();
           if (body['password']) {
              return body['password'] as string;
           }
         } catch (e) {
           // ignore parsing errors
         }
      }
      return undefined;
    };

    const result = await handleRequest.execute(
        path,
        c.req.raw.headers,
        ip,
        url,
        passwordProvider
    );

    if (!result) {
      return c.notFound();
    }

    if (result.type === 'redirect') {
      const rule = result.rule;
      const res = c.redirect(rule.destination, rule.code);

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
    } else if (result.type === 'password_required') {
       // Render HTML form
       const errorMsg = result.error ? '<p style="color:red">Incorrect password</p>' : '';
       // Use empty action to submit to same URL including query string
       // Or use c.req.url but ensure it's relative or full.
       // Empty action is standard for "post back to self".
       // However, we need to ensure method is POST.

       const html = `
         <!DOCTYPE html>
         <html>
         <head><title>Password Protected</title></head>
         <body>
           <h2>This link is password protected</h2>
           ${errorMsg}
           <form method="POST" action="">
             <input type="password" name="password" placeholder="Enter password" />
             <button type="submit">Submit</button>
           </form>
         </body>
         </html>
       `;
       return c.html(html);
    }

    return c.notFound();
  });

  return app;
};
