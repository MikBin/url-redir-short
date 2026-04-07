import { serverPocketBase } from '../../utils/pocketbase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password, passwordConfirm, name } = body || {};

  if (!email || !password || !passwordConfirm) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password, and password confirmation are required',
    });
  }

  if (password !== passwordConfirm) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Passwords do not match',
    });
  }

  const pb = await serverPocketBase(event);

  try {
    // 1. Create the user
    const record = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      name,
    });

    console.info(`Audit Log: Auth Event - Registration success for email: ${email}, user ID: ${record.id}`);

    // 2. Auto-login the user after registration
    const authData = await pb.collection('users').authWithPassword(email, password);

    setCookie(event, 'pb_auth', JSON.stringify({ token: pb.authStore.token, model: pb.authStore.record }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return {
      token: pb.authStore.token,
      user: authData.record,
    };
  } catch (error: any) {
    console.error(`Registration failed for email: ${email}`, error);
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Registration failed',
    });
  }
});
