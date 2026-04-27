import { describe, it, expect } from 'vitest';
import { processAnalyticsEvents } from '../server/utils/analytics';

describe('Analytics Utility', () => {
  it('should compute aggregations correctly', () => {
    const now = new Date('2024-05-01T12:00:00.000Z');

    // Create an event from 2 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
    const twoHoursAgoIso = twoHoursAgo.toISOString();

    const mockEvents = [
      { path: '/a', country: 'US', device_type: 'desktop', browser: 'Chrome', timestamp: now.toISOString() },
      { path: '/a', country: 'US', device_type: 'mobile', browser: 'Safari', timestamp: now.toISOString() },
      { path: '/b', country: 'CA', device_type: 'desktop', browser: 'Firefox', timestamp: twoHoursAgoIso },
      { path: '/c', country: 'UK', device_type: 'tablet', browser: 'Chrome', timestamp: now.toISOString() },
      { path: '/a', country: 'US', device_type: 'desktop', browser: 'Chrome', timestamp: now.toISOString() }
    ];

    const result = processAnalyticsEvents(mockEvents, now);

    // Test topLinks
    expect(result.topLinks).toHaveLength(3);
    expect(result.topLinks[0]).toEqual({ path: '/a', count: 3 });
    expect(result.topLinks.find(l => l.path === '/b')?.count).toBe(1);

    // Test geoDistribution
    expect(result.geoDistribution).toHaveLength(3);
    expect(result.geoDistribution[0]).toEqual({ name: 'US', count: 3 });

    // Test deviceDistribution
    expect(result.deviceDistribution).toHaveLength(3);
    const desktop = result.deviceDistribution.find(d => d.name === 'desktop');
    expect(desktop?.count).toBe(3); // '/a' (2x) and '/b' (1x) desktop = 3

    // Test browserDistribution
    expect(result.browserDistribution).toHaveLength(3);
    const chrome = result.browserDistribution.find(b => b.name === 'Chrome');
    expect(chrome?.count).toBe(3);

    // Test hourlyTrend
    expect(result.hourlyTrend).toHaveLength(24);

    // Sort logic in the utility sorts by time ascending
    // The latest hour should have 4 clicks
    const latestHourTs = new Date(now.getTime()).setUTCMinutes(0, 0, 0);
    const latestHourIso = new Date(latestHourTs).toISOString();
    const latestHourData = result.hourlyTrend.find(h => h.time === latestHourIso);
    expect(latestHourData?.count).toBe(4);

    const twoHoursAgoTs = new Date(twoHoursAgo.getTime()).setUTCMinutes(0, 0, 0);
    const twoHoursAgoDataIso = new Date(twoHoursAgoTs).toISOString();
    const twoHoursData = result.hourlyTrend.find(h => h.time === twoHoursAgoDataIso);
    expect(twoHoursData?.count).toBe(1);
  });
});
