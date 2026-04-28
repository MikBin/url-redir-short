import { H3Event, defineEventHandler, setHeader, setResponseStatus } from 'h3';

export const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || '';
  if (!originsEnv) return [];
  return originsEnv.split(',').map((o) => o.trim()).filter(Boolean);
};

export const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
};

export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

export default defineEventHandler((event: H3Event) => {
  const origin = event.node.req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  for (const [header, value] of Object.entries(securityHeaders)) {
    setHeader(event, header, value);
  }

  if (origin) {
    if (isOriginAllowed(origin, allowedOrigins)) {
      setHeader(event, 'Access-Control-Allow-Origin', origin);
      setHeader(event, 'Access-Control-Allow-Credentials', 'true');
      setHeader(
        event,
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      setHeader(
        event,
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Correlation-ID'
      );
      setHeader(event, 'Access-Control-Max-Age', '86400');
    }
  }

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204);
    return '';
  }
});
