import PocketBase from 'pocketbase'
import { syncEvents, SYNC_EVENT_NAME } from '../utils/broadcaster'
import { transformLink, type PocketBaseLink } from '../utils/transformer'

// Node.js < 22 lacks native EventSource, which PocketBase realtime needs
if (typeof globalThis.EventSource === 'undefined') {
  import('eventsource').then((mod) => {
    globalThis.EventSource = (mod.default || mod) as any;
  }).catch(() => {
    console.warn('eventsource polyfill not found. PocketBase realtime may fail if Node < 22.');
  });
}

export default defineNitroPlugin(async (nitroApp) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
  const pbEmail = process.env.PB_ADMIN_EMAIL;
  const pbPassword = process.env.PB_ADMIN_PASSWORD;

  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  if (pbEmail && pbPassword) {
    try {
      await pb.admins.authWithPassword(pbEmail, pbPassword);
      console.log('PocketBase realtime plugin authenticated as admin.');
    } catch (err) {
      console.warn('PocketBase realtime plugin admin auth failed:', err);
    }
  } else {
    console.log('PocketBase realtime plugin: No PB_ADMIN_EMAIL/PASSWORD provided, subscribing anonymously.');
  }

  try {
    pb.collection('links').subscribe('*', function (e) {
      console.log('PocketBase realtime event received!', e.action, e.record.id);
      
      const eventType = e.action; // 'create', 'update', 'delete'
      let data = null;

      try {
        data = transformLink(e.record as PocketBaseLink);

        if (eventType === 'create') {
           syncEvents.emit(SYNC_EVENT_NAME, { event: 'create', data: data });
        } else if (eventType === 'update') {
           syncEvents.emit(SYNC_EVENT_NAME, { event: 'update', data: data });
        } else if (eventType === 'delete') {
           syncEvents.emit(SYNC_EVENT_NAME, { event: 'delete', data: data });
        }
      } catch (err) {
         console.error('Error transforming PocketBase payload:', err);
      }
    });
    console.log('PocketBase realtime plugin successfully subscribed to "links" collection.');
  } catch (err) {
    console.error('PocketBase realtime plugin failed to subscribe:', err);
  }
});