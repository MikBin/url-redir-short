import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { transformLink, SupabaseLink } from '../server/utils/transformer';

describe('Transformer Properties', () => {
  it('should transform any valid SupabaseLink to RedirectRule', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          slug: fc.string({ minLength: 1 }), // Slugs are non-empty
          destination: fc.webUrl(),
          is_active: fc.option(fc.boolean()),
          targeting: fc.option(fc.object()), // Using object for simplicity as any
          ab_testing: fc.option(fc.object()),
          hsts: fc.option(fc.object()),
          password_protection: fc.option(fc.object()),
          expires_at: fc.option(fc.date().map(d => d.toISOString())),
          max_clicks: fc.option(fc.integer({ min: 1 })),
          created_at: fc.option(fc.date().map(d => d.toISOString())),
          updated_at: fc.option(fc.date().map(d => d.toISOString())),
          owner_id: fc.option(fc.uuid()),
          domain_id: fc.option(fc.uuid()),
        }),
        (link) => {
           // Type cast needed because fast-check record produces a type that might miss some optional keys if not defined perfectly matching interface,
           // but SupabaseLink has many optionals.
           // However, fast-check record with required keys `id`, `slug`, `destination` generates those, and optionals are handled by `fc.option`.

           const supabaseLink: SupabaseLink = link as unknown as SupabaseLink;

           const rule = transformLink(supabaseLink);

           expect(rule.id).toBe(supabaseLink.id);
           expect(rule.destination).toBe(supabaseLink.destination);
           expect(rule.path.startsWith('/')).toBe(true);

           if (supabaseLink.slug.startsWith('/')) {
               expect(rule.path).toBe(supabaseLink.slug);
           } else {
               expect(rule.path).toBe('/' + supabaseLink.slug);
           }

           if (supabaseLink.targeting) expect(rule.targeting).toEqual(supabaseLink.targeting);
           if (supabaseLink.ab_testing) expect(rule.ab_testing).toEqual(supabaseLink.ab_testing);
           if (supabaseLink.hsts) expect(rule.hsts).toEqual(supabaseLink.hsts);
           if (supabaseLink.password_protection) expect(rule.password_protection).toEqual(supabaseLink.password_protection);

           if (supabaseLink.expires_at) {
               const date = new Date(supabaseLink.expires_at);
               if (!isNaN(date.getTime())) {
                   expect(rule.expiresAt).toBe(date.getTime());
               }
           }

           if (supabaseLink.max_clicks !== null && supabaseLink.max_clicks !== undefined) {
               expect(rule.maxClicks).toBe(supabaseLink.max_clicks);
           }

           return true;
        }
      )
    );
  });
});
