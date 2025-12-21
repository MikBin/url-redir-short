import { AnalyticsCollector, AnalyticsPayload } from '../../core/analytics/collector';

export class FireAndForgetCollector implements AnalyticsCollector {
  constructor(
    private readonly analyticsUrl: string,
    private readonly waitUntil?: (promise: Promise<any>) => void
  ) {}

  async collect(payload: AnalyticsPayload): Promise<void> {
    const task = fetch(`${this.analyticsUrl}/v1/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('Failed to send analytics:', err);
    });

    if (this.waitUntil) {
      this.waitUntil(task);
    } else {
      // In Node.js without specific waitUntil context, we just don't await it.
      // However, we should ensure unhandled rejections don't crash the process if possible,
      // though the .catch above handles that.
    }
  }
}
