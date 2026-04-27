import 'dotenv/config';
import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';

const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');

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
    await pb.collection('_superusers').authWithPassword(
      process.env.PB_ADMIN_EMAIL,
      process.env.PB_ADMIN_PASSWORD
    );
    console.log('Successfully authenticated as admin.');

    console.log('Reading schema from pb_schema.json...');
    const schemaRaw = readFileSync(new URL('./pb_schema.json', import.meta.url), 'utf-8');
    const collections = JSON.parse(schemaRaw);

    console.log(`Found ${collections.length} collections to initialize.`);

    // Order collections based on dependencies:
    // domains -> links -> analytics_events, analytics_aggregates
    const order = ['domains', 'links', 'sessions', 'analytics_events', 'analytics_aggregates'];

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
      console.log(`\nProcessing collection: ${collection.name}`);
      try {
        // Delete if exists for a clean slate
        try {
          await pb.collections.delete(collection.name);
          console.log(`🗑️ Deleted existing collection: ${collection.name}`);
        } catch (e) {}

        await pb.collections.create(collection);
        console.log(`✅ Successfully created collection: ${collection.name}`);
      } catch (err) {
        console.error(`❌ Error creating collection ${collection.name}:`, err.message);
        if (err.data) {
          console.error('Validation errors:', JSON.stringify(err.data, null, 2));
        }
      }
    }

    console.log('\nInitialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal initialization error:', error.message);
    process.exit(1);
  }
}

init();
