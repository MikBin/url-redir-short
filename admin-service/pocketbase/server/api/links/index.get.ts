import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { createRequestLogger, handleError } from '../../utils/error-handler';

export default defineEventHandler(async (event) => {
  const logger = createRequestLogger(event);

  try {
    const user = event.context.user || await serverPocketBaseUser(event);
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const pb = await serverPocketBase(event);

    // We can rely on PocketBase's listRule "@request.auth.id = owner_id"
    // to automatically filter records based on the authenticated user.
    const result = await pb.collection('links').getFullList({
      sort: '-created',
    });

    return result;
  } catch (err) {
    return handleError(event, err, logger);
  }
});
