import PocketBase from 'pocketbase';
import type { H3Event } from 'h3';

export async function serverPocketBase(event: H3Event) {
  const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');
  pb.autoCancellation(false);

  // Try to load auth from cookie or Authorization header
  const authCookie = getCookie(event, 'pb_auth');
  if (authCookie) {
    try {
      // Robust parsing for JSON stored in cookies
      let data = typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      
      if (data && data.token) {
        pb.authStore.save(data.token, data.model);
      }
    } catch (e) {
      console.warn('[PB] Cookie parse failure:', e);
      pb.authStore.clear();
    }
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
