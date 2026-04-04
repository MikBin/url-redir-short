import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';

import PocketBase from 'pocketbase';
const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');
import { BetterMockAdminService extends EventEmitter {
  private app: Hono;
    private server: any;
    private running: boolean = false;
    private connectionCount: number = 0;

    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  this.app.get('/sync/stream', async (c) => {
      return streamSSE(c, async (stream) => {
        this.connectionCount++;

        const listener = async (payload: any) => {
          if (!this.running) return;
          try {
            await stream.writeSSE({
              data: JSON.stringify(payload.data),
              event: payload.type,
              id: String(Date.now()),
            });
          } catch (e) {
            console.error('[MockAdmin] Error writing SSE:', e);
          }
        };

        this.on('push', listener);
        this.emit('connection');

        // Let the client know it connected successfully
        await stream.writeSSE({
          data: 'connected',
          event: 'connected',
          id: String(Date.now()),
        });
        this.emit('connection');
        console.log(`[MockAdmin] Client connected (Total: ${this.connectionCount})`);

        let aborted = false;
        stream.onAbort(() => {
          aborted = true;
          this.connectionCount--;
          console.log(`[MockAdmin] Client disconnected (Total: ${this.connectionCount})`);
          this.off('push', listener);
        }
      });
    }
  });
}
</final_file_content>
const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');

async function seed() {
  try {
    const adminEmail = process.env.PB_ADMIN_EMAIL;
    const adminPassword = process.env.PB_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables are required.');
      process.exit(1);
    }

    console.log(`Authenticating as admin ${adminEmail}...`);
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
    console.log('Successfully authenticated as admin.');

    // Create test user
    let testUser;
    try {
      testUser = await pb.collection('users').create({
        email: 'test@example.com',
        password: 'testpassword123',
        passwordConfirm: 'testpassword123',
        name: 'Test User',
      });
      console.log('✅ Created test user:', testUser.id);
    } catch (err) {
      if (err.status === 400) {
        // User might already exist, try to find them
        const existingUsers = await pb.collection('users').getList(1, 1, {
          filter: 'email = "test@example.com"'
        });
        if (existingUsers.items.length > 0) {
          testUser = existingUsers.items[0];
          console.log('ℹ️ Test user already exists:', testUser.id);
        }
      } else {
        throw err;
      }
    }

    // Create test domain
    let testDomain;
    try {
      testDomain = await pb.collection('domains').create({
        domain: 'localhost',
        owner_id: testUser.id,
      });
      console.log('✅ Created test domain: localhost');
    } catch (err) {
      if (err.status === 400) {
        const existingDomains = await pb.collection('domains').getList(1, 1, {
          filter: 'domain = "localhost"'
        });
        if (existingDomains.items.length > 0) {
          testDomain = existingDomains.items[0];
          console.log('ℹ️ Test domain already exists: localhost');
        }
      } else {
        throw err;
      }
    }

    // Create test links with various configurations
    const testLinks = [
      // Basic redirect
      {
        slug: 'google',
        destination: 'https://www.google.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
      },
      // Simple short link
      {
        slug: 'gh',
        destination: 'https://github.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
      },
      // Inactive link (for testing 404 behavior)
      {
        slug: 'inactive',
        destination: 'https://example.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: false,
      },
      // Geo-targeting
      {
        slug: 'geo',
        destination: 'https://example.com/default',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        targeting: {
          geo: {
            US: 'https://example.com/us',
            EU: 'https://example.com/eu',
            default: 'https://example.com/default'
          }
        }
      },
      // Language targeting
      {
        slug: 'lang',
        destination: 'https://example.com/en',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        targeting: {
          language: {
            en: 'https://example.com/en',
            es: 'https://example.com/es',
            fr: 'https://example.com/fr',
            default: 'https://example.com/en'
          }
        }
      },
      // Device targeting
      {
        slug: 'device',
        destination: 'https://example.com/desktop',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        targeting: {
          device: {
            mobile: 'https://example.com/mobile',
            tablet: 'https://example.com/tablet',
            desktop: 'https://example.com/desktop'
          }
        }
      },
      // A/B testing (50/50 split)
      {
        slug: 'ab-test',
        destination: 'https://example.com/a',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        ab_testing: {
          enabled: true,
          variants: [
            { weight: 50, destination: 'https://example.com/a' },
            { weight: 50, destination: 'https://example.com/b' }
          ]
        }
      },
      // A/B testing (70/30 split)
      {
        slug: 'ab-weighted',
        destination: 'https://example.com/main',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        ab_testing: {
          enabled: true,
          variants: [
            { weight: 70, destination: 'https://example.com/main' },
            { weight: 30, destination: 'https://example.com/variant' }
          ]
        }
      },
      // Password protected
      {
        slug: 'secret',
        destination: 'https://example.com/secret-content',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        password_protection: {
          enabled: true,
          password_hash: 'test123' // In production this would be hashed
        }
      },
      // Link with expiration (expires in 1 year)
      {
        slug: 'expires',
        destination: 'https://example.com/temporary',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      // Link with max clicks
      {
        slug: 'limited',
        destination: 'https://example.com/limited',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        max_clicks: 100,
      },
      // HSTS enabled
      {
        slug: 'secure',
        destination: 'https://example.com/secure',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        hsts: {
          enabled: true,
          max_age: 31536000,
          include_subdomains: true,
          preload: false
        }
      },
      // Combined: geo + device targeting
      {
        slug: 'combined',
        destination: 'https://example.com/default',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
        targeting: {
          geo: {
            US: 'https://example.com/us',
            default: 'https://example.com/global'
          },
          device: {
            mobile: 'https://m.example.com',
            desktop: 'https://www.example.com'
          }
        }
      },
      // Null domain (global link - works on any domain)
      {
        slug: 'global',
        destination: 'https://example.com/global',
        owner_id: testUser.id,
        domain_id: null,
        is_active: true,
      },
    ];

    for (const linkData of testLinks) {
      try {
        const link = await pb.collection('links').create(linkData);
        console.log(`✅ Created link: /${linkData.slug}`);
      } catch (err) {
        if (err.status === 400) {
          console.log(`ℹ️ Link /${linkData.slug} might already exist, skipping.`);
        } else {
          console.error(`❌ Error creating link /${linkData.slug}:`, err.message);
        }
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nTest credentials:');
    console.log('  Email: test@example.com');
    console.log('  Password: testpassword123');
    console.log('\nTest links available:');
    console.log('  /google          - Basic redirect to Google');
    console.log('  /gh              - Short link to GitHub');
    console.log('  /inactive        - Inactive link (404)');
    console.log('  /geo             - Geo-targeted redirect');
    console.log('  /lang            - Language-targeted redirect');
    console.log('  /device          - Device-targeted redirect');
    console.log('  /ab-test         - A/B testing (50/50)');
    console.log('  /ab-weighted     - A/B testing (70/30)');
    console.log('  /secret          - Password protected');
    console.log('  /expires         - Expires in 1 year');
    console.log('  /limited         - Max 100 clicks');
    console.log('  /secure          - HSTS enabled');
    console.log('  /combined        - Combined geo + device targeting');
    console.log('  /global          - Global link (no domain)');
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal seed error:', error.message);
    process.exit(1);
  }
}

seed();