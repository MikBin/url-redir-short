import { EventEmitter } from 'events';
import { transformLink } from './transformer';

export const syncEvents = new EventEmitter();
export const SYNC_EVENT_NAME = 'pb-change';

export const broadcaster = {
  broadcast: (event: string, data: any) => {
    try {
      const transformedData = transformLink(data);
      syncEvents.emit(SYNC_EVENT_NAME, { event, data: transformedData });
    } catch (err) {
      console.error(`Error transforming or broadcasting event ${event}:`, err);
    }
  }
};
