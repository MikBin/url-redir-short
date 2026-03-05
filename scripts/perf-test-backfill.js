const LATENCY_MS = 10; // Simulated network latency per query

class MockSupabase {
  constructor() {
    this.queryCount = 0;
  }

  from(table) {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          limit: (n) => ({
            maybeSingle: async () => {
              this.queryCount++;
              await new Promise(r => setTimeout(r, LATENCY_MS));
              if (table === 'links' && val.startsWith('/slug-')) {
                return { data: { id: 'link-' + val.split('-')[1] }, error: null };
              }
              return { data: null, error: null };
            }
          })
        }),
        in: (col, vals) => ({
          then: async (resolve) => {
            this.queryCount++;
            await new Promise(r => setTimeout(r, LATENCY_MS));
            const data = vals.map(v => ({ slug: v, id: 'link-' + v.split('-')[1] }));
            resolve({ data, error: null });
          }
        })
      }),
    };
  }

  async rpc(name, params) {
    this.queryCount++;
    await new Promise(r => setTimeout(r, LATENCY_MS));
    return { error: null };
  }
}

async function originalLogic(events, client) {
  for (const event of events) {
    let linkId = event.link_id;
    if (!linkId) {
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

      await client.rpc('increment_analytics_aggregate', {
        p_link_id: linkId,
        p_date: dateStr,
        p_hour: hour,
        p_country: event.country || null,
        p_device_type: event.device_type || null,
        p_browser: event.browser || null,
        p_count: 1
      });
    }
  }
}

async function optimizedLogic(events, client) {
  // 1. Identify missing link_ids and their slugs
  const slugsToLookup = new Set();
  for (const event of events) {
    if (!event.link_id) {
      const slug = event.path.startsWith('/') ? event.path : '/' + event.path;
      slugsToLookup.add(slug);
    }
  }

  // 2. Batch lookup link_ids
  const linkMap = new Map();
  if (slugsToLookup.size > 0) {
    const { data: links } = await client
      .from('links')
      .select('slug, id')
      .in('slug', Array.from(slugsToLookup));

    if (links) {
      links.forEach(l => linkMap.set(l.slug, l.id));
    }
  }

  // 3. Process events
  for (const event of events) {
    let linkId = event.link_id;
    if (!linkId) {
      const slug = event.path.startsWith('/') ? event.path : '/' + event.path;
      linkId = linkMap.get(slug);
    }

    if (linkId) {
      const date = new Date(event.timestamp);
      const dateStr = date.toISOString().split('T')[0];
      const hour = date.getUTCHours();

      await client.rpc('increment_analytics_aggregate', {
        p_link_id: linkId,
        p_date: dateStr,
        p_hour: hour,
        p_country: event.country || null,
        p_device_type: event.device_type || null,
        p_browser: event.browser || null,
        p_count: 1
      });
    }
  }
}

async function runBenchmark() {
  const numEvents = 100;
  const events = Array.from({ length: numEvents }, (_, i) => ({
    path: `/slug-${i % 10}`,
    timestamp: new Date().toISOString(),
    link_id: null
  }));

  console.log(`Benchmarking with ${numEvents} events (10 unique slugs, all missing link_id)...`);

  // Original
  const client1 = new MockSupabase();
  const start1 = Date.now();
  await originalLogic(events, client1);
  const duration1 = Date.now() - start1;
  console.log(`\nOriginal Logic:`);
  console.log(`  Duration: ${duration1}ms`);
  console.log(`  Queries:  ${client1.queryCount}`);

  // Optimized
  const client2 = new MockSupabase();
  const start2 = Date.now();
  await optimizedLogic(events, client2);
  const duration2 = Date.now() - start2;
  console.log(`\nOptimized Logic:`);
  console.log(`  Duration: ${duration2}ms`);
  console.log(`  Queries:  ${client2.queryCount}`);

  const speedup = (duration1 / duration2).toFixed(2);
  const queryReduction = (client1.queryCount - client2.queryCount);
  console.log(`\nSpeedup: ${speedup}x`);
  console.log(`Query Reduction: ${queryReduction} queries`);
}

runBenchmark();
