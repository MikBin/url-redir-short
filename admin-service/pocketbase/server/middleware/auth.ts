import { serverPocketBase } from '../utils/pocketbase';

export default defineEventHandler(async (event) => {
  // Only protect API routes, and skip auth-related endpoints as well as the sync SSE stream endpoint
  if (
    event.path.startsWith('/api/') &&
    !event.path.startsWith('/api/auth/') &&
    !event.path.startsWith('/api/sync/')
  ) {
    const pb = await serverPocketBase(event);

    // serverPocketBase already checks the cookie and the Authorization header
    // and calls authRefresh() to populate pb.authStore.record
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
