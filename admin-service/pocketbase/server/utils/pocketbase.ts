import PocketBase from 'pocketbase';
import type { H3Event } from 'h3';

export async function serverPocketBase(event: H3Event) {
  const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');

  // Try to load auth from cookie or Authorization header
  const authCookie = getCookie(event, 'pb_auth');
  if (authCookie) {
    pb.authStore.loadFromCookie(authCookie);
  } else {
    const authHeader = getHeader(event, 'Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Construct a mock string that PB can parse to token
      pb.authStore.save(token, null);
    }
  }

  try {
    if (pb.authStore.isValid) {
      await pb.collection('users').authRefresh();
    }
  } catch (err) {
    pb.authStore.clear();
  }

  return pb;
}

export async function serverPocketBaseUser(event: H3Event) {
  const pb = await serverPocketBase(event);
  return pb.authStore.model;
}
