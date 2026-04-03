import { serverPocketBase } from '../utils/pocketbase';

export default defineEventHandler(async (event) => {
  // Only protect API routes, and skip auth-related endpoints
  if (event.path.startsWith('/api/') && !event.path.startsWith('/api/auth/')) {
    const pb = await serverPocketBase(event);

    // serverPocketBase already checks the cookie and the Authorization header
    // and calls authRefresh() to populate pb.authStore.model
    if (!pb.authStore.isValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      });
    }

    // Attach user record to context
    event.context.user = pb.authStore.record;
  }
});
