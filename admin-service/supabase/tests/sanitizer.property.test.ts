import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  sanitizeHtml,
  sanitizePath,
  sanitizeText,
  sanitizeSqlIdentifier,
  sanitizeUserAgent
} from '../server/utils/sanitizer';

describe('Sanitizer Properties', () => {
  it('sanitizeHtml should escape special characters', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const sanitized = sanitizeHtml(text);
        // It shouldn't contain raw special chars unless they were already safe?
        // No, it replaces them.
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('"');
        expect(sanitized).not.toContain("'");
        // & becomes &amp; so & IS present, but standalone & might be tricky.
        // Let's check that if input has <, output has &lt;
        if (text.includes('<')) expect(sanitized).toContain('&lt;');
        return true;
      })
    );
  });

  it('sanitizePath should remove dangerous characters and normalize slashes', () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        const sanitized = sanitizePath(path);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain('"');
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toMatch(/\/\//); // No double slashes
        return true;
      })
    );
  });

  it('sanitizeText should remove tags and trim', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const sanitized = sanitizeText(text);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).toBe(sanitized.trim());
        expect(sanitized.length).toBeLessThanOrEqual(1000);
        return true;
      })
    );
  });

  it('sanitizeSqlIdentifier should only allow alphanumeric and underscore', () => {
      fc.assert(
          fc.property(fc.string(), (text) => {
              const sanitized = sanitizeSqlIdentifier(text);
              expect(sanitized).toMatch(/^[a-zA-Z0-9_]*$/);
              return true;
          })
      );
  });

  it('sanitizeUserAgent should be safe and truncated', () => {
      fc.assert(
          fc.property(fc.option(fc.string()), (ua) => {
              const sanitized = sanitizeUserAgent(ua);
              if (!ua) { // Handles null, undefined, and empty string
                  expect(sanitized).toBeNull();
              } else {
                  expect(sanitized).not.toContain('<');
                  expect(sanitized).not.toContain('>');
                  expect(sanitized!.length).toBeLessThanOrEqual(500);
              }
              return true;
          })
      );
  });
});
