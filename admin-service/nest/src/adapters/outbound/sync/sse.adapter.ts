import { SyncEmitterPort } from '../../../domain/ports/sync.port';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class SseSyncAdapter implements SyncEmitterPort {
  private eventSubject = new Subject<any>();

  broadcast(event: any): void {
    console.log('SseSyncAdapter: broadcasting', event);
    this.eventSubject.next(event);
  }

  getEventStream() {
    return this.eventSubject.asObservable();
  }
}
