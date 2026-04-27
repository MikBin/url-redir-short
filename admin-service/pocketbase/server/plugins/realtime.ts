import PocketBase from 'pocketbase'
import { syncEvents, SYNC_EVENT_NAME } from '../utils/broadcaster'
import { transformLink, type PocketBaseLink } from '../utils/transformer'

import { EventSource } from 'eventsource'

// Node.js < 22 lacks native EventSource, which PocketBase realtime needs
if (typeof globalThis.EventSource === 'undefined') {
  globalThis.EventSource = EventSource as any;
}

export default defineNitroPlugin(async (nitroApp) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
  const pbEmail = process.env.PB_ADMIN_EMAIL;
  const pbPassword = process.env.PB_ADMIN_PASSWORD;

  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  if (pbEmail && pbPassword) {
    try {
      await pb.collection('_superusers').authWithPassword(pbEmail, pbPassword);
      console.log('PocketBase realtime plugin authenticated as admin.');
    } catch (err) {
      console.warn('PocketBase realtime plugin admin auth failed:', err);
    }
  } else {
    console.log('PocketBase realtime plugin: No PB_ADMIN_EMAIL/PASSWORD provided, subscribing anonymously.');
  }

  try {
    pb.collection('links').subscribe('*', function (e) {
      console.log('PocketBase realtime event received!');
      console.log('Full Event:', JSON.stringify(e, (key, value) => key === 'pb' ? undefined : value, 2));
      
      const eventType = e.action; // 'create', 'update', 'delete'
      (async () => {
        try {
          let record = e.record;
          // If record is partial (missing fields), fetch the full record
          if (!record.slug) {
            console.log(`[Realtime] Record is partial, fetching full record for ${record.id}...`);
            record = await pb.collection('links').getOne(record.id);
            console.log(`[Realtime] Fetched record:`, JSON.stringify(record, null, 2));
          }

          const data = transformLink(record as PocketBaseLink);

          if (eventType === 'create') {
             syncEvents.emit(SYNC_EVENT_NAME, { event: 'create', data: data });
          } else if (eventType === 'update') {
             syncEvents.emit(SYNC_EVENT_NAME, { event: 'update', data: data });
          } else if (eventType === 'delete') {
             syncEvents.emit(SYNC_EVENT_NAME, { event: 'delete', data: data });
          }
        } catch (err: any) {
           console.error('Error processing PocketBase event:', err.message);
        }
      })();
    });
    console.log('PocketBase realtime plugin successfully subscribed to "links" collection.');
  } catch (err) {
    console.error('PocketBase realtime plugin failed to subscribe:', err);
  }
});