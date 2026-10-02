import 'dotenv/config';
import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';

const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');

async function collectionExists(name) {
  try {
    await pb.collections.getOne(name);
    return true;
  } catch (e) {
    return false;
  }
}

async function init() {
  try {
    const adminEmail = process.env.PB_ADMIN_EMAIL;
    const adminPassword = process.env.PB_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables are required.');
      process.exit(1);
    }

    console.log(`Authenticating as admin ${adminEmail}...`);
    // Admin authentication (PocketBase 0.22+ uses _superusers collection)
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
    console.log('Successfully authenticated as admin.');

    console.log('Reading schema from pb_schema.json...');
    const schemaRaw = readFileSync(new URL('./pb_schema.json', import.meta.url), 'utf-8');
    const collections = JSON.parse(schemaRaw);

    console.log(`Found ${collections.length} collections to initialize.`);

    // Order collections based on dependencies:
    // apps -> domains -> links -> sessions
    const order = ['apps', 'domains', 'links', 'sessions', 'system_config'];

    // Sort collections to match the dependency order
    const orderedCollections = [...collections].sort((a, b) => {
      const indexA = order.indexOf(a.name);
      const indexB = order.indexOf(b.name);
      // If not in the order list, push to the end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    for (const collection of orderedCollections) {
      // Idempotent and non-destructive: existing collections and their data
      // are never deleted or recreated (task 1.6). Schema changes belong to
      // pb_migrations, which PocketBase applies on serve.
      if (await collectionExists(collection.name)) {
        console.log(`↷ Skipping existing collection: ${collection.name}`);
        continue;
      }

      try {
        await pb.collections.create(collection);
        console.log(`✅ Created collection: ${collection.name}`);
      } catch (err) {
        console.error(`❌ Error creating collection ${collection.name}:`, err.message);
        if (err.data) {
          console.error('Validation errors:', JSON.stringify(err.data, null, 2));
        }
      }
    }

    console.log('\nInitialization complete (idempotent — no data deleted).');
    process.exit(0);
  } catch (error) {
    console.error('Fatal initialization error:', error.message);
    process.exit(1);
  }
}

init();
