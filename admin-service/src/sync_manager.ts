import { UpdateEvent } from './types';

export class SyncManager {
  // Set of connected clients (Response objects or abstract sinks)
  private clients: Set<any> = new Set();

  constructor() {
    //
  }

  /**
   * Registers a new client connection for SSE updates.
   * @param clientResponse The HTTP response object to write to.
   */
  addClient(clientResponse: any) {
    this.clients.add(clientResponse);
    console.log('Client connected. Total clients:', this.clients.size);

    // Cleanup logic would go here (e.g., when connection closes)
  }

  /**
   * Broadcasts an update to all connected engines.
   */
  broadcast(event: UpdateEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;

    this.clients.forEach(client => {
      try {
        client.write(payload);
      } catch (err) {
        console.error('Failed to push to client', err);
        this.clients.delete(client);
      }
    });
  }
}
