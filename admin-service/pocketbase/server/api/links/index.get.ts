import { serverPocketBase, serverPocketBaseUser } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const user = await serverPocketBaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const pb = await serverPocketBase(event);

  try {
    const query = getQuery(event);
    const page = parseInt(query.page as string) || 1;
    const perPage = parseInt(query.perPage as string) || 50;

    // We can rely on PocketBase's listRule "@request.auth.id = owner_id"
    // to automatically filter records based on the authenticated user.
    const result = await pb.collection('links').getList(page, perPage, {
      sort: '-created',
    });

    return result;
  } catch (err: any) {
    throw createError({ statusCode: err.status || 500, statusMessage: err.message || 'Error fetching links' });
  }
});
