import { serverPocketBase } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const pb = await serverPocketBase(event);
  const userId = pb.authStore.record?.id;

  // Clear auth store
  pb.authStore.clear();

  // Remove the cookie
  deleteCookie(event, 'pb_auth');

  console.info(`Audit Log: Auth Event - Logout for user ID: ${userId || 'unknown'}`);

  return { success: true };
});
