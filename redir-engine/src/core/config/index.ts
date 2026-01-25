export interface AppConfig {
  port: number;
  adminServiceUrl: string;
  analyticsServiceUrl: string;
}

export const loadConfig = (env: Record<string, string | undefined> = process.env): AppConfig => {
  const port = parseInt(env.PORT || '3000', 10);
  const adminServiceUrl = env.ADMIN_SERVICE_URL || 'http://localhost:3001/sync/stream';
  const analyticsServiceUrl = env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';

  if (isNaN(port)) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  return {
    port,
    adminServiceUrl,
    analyticsServiceUrl,
  };
};
