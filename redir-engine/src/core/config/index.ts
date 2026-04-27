export interface AppConfig {
  port: number;
  adminServiceUrl: string;
  analyticsServiceUrl: string;
  syncApiKey?: string;
}

export const loadConfig = (env: Record<string, string | undefined> = process.env): AppConfig => {
  const port = parseInt(env.PORT || '3000', 10);
  const adminServiceUrl = env.ADMIN_SERVICE_URL || 'http://localhost:3001/api/sync/stream';
  const analyticsServiceUrl = env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';
  const syncApiKey = env.SYNC_API_KEY;

  if (isNaN(port)) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  return {
    port,
    adminServiceUrl,
    analyticsServiceUrl,
    syncApiKey,
  };
};
