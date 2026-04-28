import 'dotenv/config';
import PocketBase from 'pocketbase';

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
      {
        slug: 'google',
        destination: 'https://www.google.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
      },
      {
        slug: 'gh',
        destination: 'https://github.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: true,
      },
      {
        slug: 'inactive',
        destination: 'https://example.com',
        owner_id: testUser.id,
        domain_id: testDomain.id,
        is_active: false,
      }
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
    process.exit(0);
  } catch (error) {
    console.error('Fatal seed error:', error.message);
    process.exit(1);
  }
}

seed();