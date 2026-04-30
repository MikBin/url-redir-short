import { serverPocketBase } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body || {};

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required',
    });
  }

  const pb = await serverPocketBase(event);

  try {
    const authData = await pb.collection('users').authWithPassword(email, password);

    setCookie(event, 'pb_auth', JSON.stringify({ token: pb.authStore.token, model: pb.authStore.model }), {
      httpOnly: false, // Allow client-side UI to read login status
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    console.info(`Audit Log: Auth Event - Login success for email: ${email}, user ID: ${authData.record.id}`);

    return {
      token: pb.authStore.token,
      user: authData.record,
    };
  } catch (error: any) {
    console.info(`Audit Log: Auth Event - Login failed for email: ${email}`);
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
    });
  }
});
