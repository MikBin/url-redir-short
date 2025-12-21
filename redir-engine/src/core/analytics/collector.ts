export interface AnalyticsPayload {
  path: string;
  destination: string;
  timestamp: string;
  ip: string;
  user_agent: string | null;
  referrer: string | null;
  referrer_source: 'explicit' | 'implicit' | 'none';
  status: number;
}

export interface AnalyticsCollector {
  collect(payload: AnalyticsPayload): Promise<void>;
}
