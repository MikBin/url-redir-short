import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';
import { broadcaster } from '../../utils/broadcaster';

export default defineEventHandler(async (event) => {
  const user = await serverPocketBaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
  }

  const pb = await serverPocketBase(event);

  try {
    // Get the record first to broadcast its details (like slug) when deleted
    const record = await pb.collection('links').getOne(id);

    await pb.collection('links').delete(id);

    broadcaster.broadcast('delete', record);

    return { success: true };
  } catch (err: unknown) {
    throw createError({ statusCode: (err as { status?: number }).status || 500, statusMessage: (err instanceof Error ? err.message : String(err)) || 'Error deleting link' });
  }
});
