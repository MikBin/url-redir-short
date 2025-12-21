import { AnalyticsPayload } from './collector';

export const EXPLICIT_PARAMS = ['utm_source', 'ref', 'source'];

export async function resolveReferrer(
  url: URL,
  headers: Headers
): Promise<{ referrer: string | null; referrer_source: 'explicit' | 'implicit' | 'none' }> {
  // Priority 1: Explicit Query Params
  for (const param of EXPLICIT_PARAMS) {
    const value = url.searchParams.get(param);
    if (value) {
      return { referrer: value, referrer_source: 'explicit' };
    }
  }

  // Priority 2: Implicit Header
  const refererHeader = headers.get('Referer');
  if (refererHeader) {
    return { referrer: refererHeader, referrer_source: 'implicit' };
  }

  return { referrer: null, referrer_source: 'none' };
}

export async function anonymizeIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function buildAnalyticsPayload(
  path: string,
  destination: string,
  ip: string,
  headers: Headers,
  status: number,
  originalUrl: string
): Promise<AnalyticsPayload> {
  const url = new URL(originalUrl);
  const { referrer, referrer_source } = await resolveReferrer(url, headers);
  const anonymizedIp = await anonymizeIp(ip);

  return {
    path,
    destination,
    timestamp: new Date().toISOString(),
    ip: anonymizedIp,
    user_agent: headers.get('User-Agent'),
    referrer,
    referrer_source,
    status,
  };
}
