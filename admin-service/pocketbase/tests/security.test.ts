import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAllowedOrigins, isOriginAllowed, securityHeaders } from '../server/middleware/1.security';

describe('Security Middleware Logic', () => {
  describe('securityHeaders', () => {
    it('should have the correct HSTS configuration', () => {
      expect(securityHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
    });

    it('should have correct basic security configurations', () => {
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
      expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(securityHeaders['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    });

    it('should have the correct Content-Security-Policy for PocketBase', () => {
      const csp = securityHeaders['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("font-src 'self' data:");
      expect(csp).toContain("connect-src 'self'");
      // Ensure no supabase domain leaked in connect-src
      expect(csp).not.toContain('supabase.co');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });
  });

  describe('getAllowedOrigins', () => {
    const originalEnv = process.env.CORS_ALLOWED_ORIGINS;

    beforeEach(() => {
      delete process.env.CORS_ALLOWED_ORIGINS;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.CORS_ALLOWED_ORIGINS = originalEnv;
      } else {
        delete process.env.CORS_ALLOWED_ORIGINS;
      }
    });

    it('should return empty array if env is not set', () => {
      expect(getAllowedOrigins()).toEqual([]);
    });

    it('should correctly parse single origin', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
      expect(getAllowedOrigins()).toEqual(['http://localhost:3000']);
    });

    it('should correctly parse multiple origins and trim whitespace', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000, https://example.com , http://other.org';
      expect(getAllowedOrigins()).toEqual([
        'http://localhost:3000',
        'https://example.com',
        'http://other.org'
      ]);
    });

    it('should ignore empty elements', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,,https://example.com, ';
      expect(getAllowedOrigins()).toEqual([
        'http://localhost:3000',
        'https://example.com'
      ]);
    });
  });

  describe('isOriginAllowed', () => {
    it('should return false if allowedOrigins is empty (fail-closed)', () => {
      expect(isOriginAllowed('http://localhost:3000', [])).toBe(false);
    });

    it('should return true if origin matches an allowed origin', () => {
      expect(isOriginAllowed('http://localhost:3000', ['http://localhost:3000', 'https://example.com'])).toBe(true);
    });

    it('should return false if origin does not match an allowed origin', () => {
      expect(isOriginAllowed('http://hacker.com', ['http://localhost:3000', 'https://example.com'])).toBe(false);
    });

    it('should return true if allowedOrigins contains wildcard "*"', () => {
      expect(isOriginAllowed('http://hacker.com', ['*'])).toBe(true);
      expect(isOriginAllowed('https://example.com', ['http://localhost:3000', '*'])).toBe(true);
    });
  });
});
