import { serverPocketBase } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const pb = await serverPocketBase(event);
  const userId = pb.authStore.record?.id;

  // Clear auth store
  pb.authStore.clear();

  // Clear the auth cookie
  setCookie(event, 'pb_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'strict',
    maxAge: 0 // Expire immediately
  });

  console.info(`Audit Log: Auth Event - Logout for user ID: ${userId || 'unknown'}`);

  return { success: true, message: 'Logged out successfully' };
});
