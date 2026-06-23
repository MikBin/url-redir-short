import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../../src/core/config';

describe('loadConfig', () => {
  it('should return default values when env is empty', () => {
    const config = loadConfig({});
    expect(config).toEqual({
      port: 3000,
      adminServiceUrl: 'http://localhost:3001/api/sync/stream',
      analyticsServiceUrl: 'http://localhost:3002',
      syncApiKey: undefined,
    });
  });

  it('should override default values with provided env values', () => {
    const config = loadConfig({
      PORT: '8080',
      ADMIN_SERVICE_URL: 'http://admin.local',
      ANALYTICS_SERVICE_URL: 'http://analytics.local',
      SYNC_API_KEY: 'test-key',
    });

    expect(config).toEqual({
      port: 8080,
      adminServiceUrl: 'http://admin.local',
      analyticsServiceUrl: 'http://analytics.local',
      syncApiKey: 'test-key',
    });
  });

  it('should throw an error if PORT is invalid', () => {
    expect(() => loadConfig({ PORT: 'not-a-number' })).toThrowError('Invalid PORT: not-a-number');
  });

  it('should fallback to process.env when no argument is provided', () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '9999';
    try {
      const config = loadConfig();
      expect(config.port).toBe(9999);
    } finally {
      process.env.PORT = originalPort;
    }
  });
});
