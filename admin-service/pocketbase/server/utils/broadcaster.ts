import { EventEmitter } from 'events';

export const syncEvents = new EventEmitter();
export const SYNC_EVENT_NAME = 'db-change';

export const broadcaster = {
  broadcast: (type: string, data: any) => {
    syncEvents.emit(SYNC_EVENT_NAME, { type, data });
  }
};
