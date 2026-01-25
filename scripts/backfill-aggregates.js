const { createClient } = require('../admin-service/supabase/node_modules/@supabase/supabase-js');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function backfill() {
  console.log('Starting backfill...');

  // 1. Fetch all events (chunked)
  let page = 0;
  const pageSize = 1000;
  let totalProcessed = 0;

  while (true) {
    const { data: events, error } = await client
      .from('analytics_events')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching events:', error);
      break;
    }

    if (!events || events.length === 0) {
      break;
    }

    console.log(`Processing chunk ${page} (${events.length} events)...`);

    for (const event of events) {
      let linkId = event.link_id;
      if (!linkId) {
        // Lookup link_id from path
        const slug = event.path.startsWith('/') ? event.path : '/' + event.path;
        const { data: link } = await client
          .from('links')
          .select('id')
          .eq('slug', slug)
          .limit(1)
          .maybeSingle();

        if (link) {
          linkId = link.id;
        }
      }

      if (linkId) {
        const date = new Date(event.timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getUTCHours();

        const { error: rpcError } = await client.rpc('increment_analytics_aggregate', {
          p_link_id: linkId,
          p_date: dateStr,
          p_hour: hour,
          p_country: event.country || null,
          p_device_type: event.device_type || null,
          p_browser: event.browser || null,
          p_count: 1
        });

        if (rpcError) {
          console.error('RPC Error:', rpcError);
        }
      }
    }

    totalProcessed += events.length;
    page++;
  }

  console.log(`Backfill complete. Processed ${totalProcessed} events.`);
}

backfill();
