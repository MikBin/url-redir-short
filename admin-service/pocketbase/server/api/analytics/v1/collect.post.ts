import { createHash } from 'crypto';
import { z } from 'zod';
import { serverPocketBase } from '../../../utils/pocketbase';

const AnalyticsPayloadSchema = z.object({
  path: z.string().min(1).max(2048),
  destination: z.string().min(1).max(2048).url(),
  timestamp: z.string().datetime().optional(),
  ip: z.string().optional(),
  user_agent: z.string().max(500).nullable().optional(),
  referrer: z.string().max(2048).url().nullable().optional(),
  referrer_source: z.enum(['explicit', 'implicit', 'none']).optional(),
  status: z.number().int().min(100).max(599),
  session_id: z.string().uuid().optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet', 'bot']).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional()
});

type AnalyticsPayload = z.infer<typeof AnalyticsPayloadSchema>;

const IP_HASH_SALT = process.env.IP_HASH_SALT || 'default-salt';

function hashIP(ip: string): string {
  return createHash('sha256').update(ip + IP_HASH_SALT).digest('hex');
}

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[^\w\s\-._~:/?#[\]@!$&'()*+,;=%]/g, '')
    .trim();
}

export default defineEventHandler(async (event) => {
  const pb = await serverPocketBase(event);
  const body = await readBody<AnalyticsPayload>(event);

  let validatedData;
  try {
    validatedData = AnalyticsPayloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid payload format',
        data: error.errors
      });
    }
    throw error;
  }

  let clientIP = event.node.req.headers['x-forwarded-for'] ||
                 event.node.req.headers['x-real-ip'] ||
                 event.node.req.socket.remoteAddress || 'unknown';

  if (Array.isArray(clientIP)) {
    clientIP = clientIP[0];
  } else if (typeof clientIP === 'string' && clientIP.includes(',')) {
    clientIP = clientIP.split(',')[0].trim();
  }

  const sanitizedData = {
    ...validatedData,
    path: sanitizeInput(validatedData.path),
    destination: sanitizeInput(validatedData.destination),
    user_agent: validatedData.user_agent ? sanitizeInput(validatedData.user_agent) : null,
    referrer: validatedData.referrer ? sanitizeInput(validatedData.referrer) : null
  };

  const hashedIP = hashIP(sanitizedData.ip || clientIP as string);
  const timestamp = sanitizedData.timestamp || new Date().toISOString();

  const ingestTask = (async () => {
    try {
      // Find the link ID matching the path
      let linkId: string | null = null;
      try {
        const slug = sanitizedData.path.startsWith('/') ? sanitizedData.path : '/' + sanitizedData.path;
        const link = await pb.collection('links').getFirstListItem(`slug = "${slug}"`);
        linkId = link.id;
      } catch (e) {
        // Not found or other error, proceed without link_id
      }

      // Store in analytics_events
      const eventRecord = {
        path: sanitizedData.path,
        destination: sanitizedData.destination,
        timestamp: timestamp,
        ip: hashedIP,
        user_agent: sanitizedData.user_agent,
        referrer: sanitizedData.referrer,
        referrer_source: sanitizedData.referrer_source || 'none',
        status: sanitizedData.status,
        session_id: sanitizedData.session_id,
        country: sanitizedData.country,
        city: sanitizedData.city,
        device_type: sanitizedData.device_type,
        browser: sanitizedData.browser,
        os: sanitizedData.os,
        link_id: linkId
      };

      await pb.collection('analytics_events').create(eventRecord);

      // Update analytics_aggregates if linkId exists
      if (linkId) {
        const dateObj = new Date(timestamp);
        // Ensure date format is YYYY-MM-DD
        const dateStr = dateObj.toISOString().split('T')[0] + ' 00:00:00.000Z'; // PB uses UTC datetime strings for date
        const hour = dateObj.getUTCHours();

        try {
          const filter = `link_id = "${linkId}" && date = "${dateStr}" && hour = ${hour}`;
          const aggregate = await pb.collection('analytics_aggregates').getFirstListItem(filter);

          const updates: any = {
            "click_count+": 1
          };

          if (sanitizedData.country) {
             const breakdown = aggregate.country_breakdown || {};
             breakdown[sanitizedData.country] = (breakdown[sanitizedData.country] || 0) + 1;
             updates.country_breakdown = breakdown;
          }

          if (sanitizedData.device_type) {
             const breakdown = aggregate.device_breakdown || {};
             breakdown[sanitizedData.device_type] = (breakdown[sanitizedData.device_type] || 0) + 1;
             updates.device_breakdown = breakdown;
          }

          if (sanitizedData.browser) {
             const breakdown = aggregate.browser_breakdown || {};
             breakdown[sanitizedData.browser] = (breakdown[sanitizedData.browser] || 0) + 1;
             updates.browser_breakdown = breakdown;
          }

          if (sanitizedData.referrer) {
              const breakdown = aggregate.referrer_breakdown || {};
              breakdown[sanitizedData.referrer] = (breakdown[sanitizedData.referrer] || 0) + 1;
              updates.referrer_breakdown = breakdown;
          }

          await pb.collection('analytics_aggregates').update(aggregate.id, updates);

        } catch (e) {
          // If aggregate doesn't exist, create it
          // Pocketbase throws a 404 when getFirstListItem finds no matches
          if ((e as any).status === 404) {
             const newAggregate: any = {
               link_id: linkId,
               date: dateStr,
               hour: hour,
               click_count: 1,
               unique_visitors: 0 // Cannot easily compute here, need robust uniqueness tracking
             };

             if (sanitizedData.country) newAggregate.country_breakdown = { [sanitizedData.country]: 1 };
             if (sanitizedData.device_type) newAggregate.device_breakdown = { [sanitizedData.device_type]: 1 };
             if (sanitizedData.browser) newAggregate.browser_breakdown = { [sanitizedData.browser]: 1 };
             if (sanitizedData.referrer) newAggregate.referrer_breakdown = { [sanitizedData.referrer]: 1 };

             await pb.collection('analytics_aggregates').create(newAggregate);
          } else {
             console.error('Failed to update analytics_aggregate', e);
          }
        }
      }

    } catch (e) {
      console.error('Analytics ingestion task failed', e);
    }
  })();

  if (event.waitUntil) {
    event.waitUntil(ingestTask);
  } else {
    ingestTask.catch(err => console.error('Background ingestion task failed:', err));
  }

  return {
    success: true,
    queued: true,
    timestamp: timestamp
  };
});
