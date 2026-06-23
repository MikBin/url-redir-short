import { defineEventHandler, readBody, createError } from 'h3';
import { serverPocketBase } from '../utils/pocketbase';
import { validateBulkLinks } from '../utils/bulk';
import { logAudit } from '../utils/audit';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const body = await readBody(event);
  const links = body?.links ?? body;

  try {
    const { valid, invalid } = validateBulkLinks(links);

    if (valid.length === 0) {
      logAudit({
        actor: { id: user.id },
        action: 'bulk_import',
        resource: { type: 'link', id: 'bulk' },
        status: 'success',
        newValue: { count: 0, failed: invalid.length },
        metadata: { invalid_items: invalid },
      });

      return {
        success: 0,
        failed: invalid.length,
        invalid_items: invalid,
      };
    }

    const pb = await serverPocketBase(event);
    let successCount = 0;

    try {
      // Use PocketBase Batch API to optimize N+1 queries into a single request
      const batch = pb.createBatch();
      for (const link of valid) {
        batch.collection('links').create({
          slug: link.slug,
          destination: link.destination,
          owner_id: user.id,
        });
      }
      await batch.send();
      successCount = valid.length;
    } catch (batchErr: unknown) {
      // Optimized Fallback: Pre-fetch existing slugs to filter duplicates before retrying
      // This prevents N+1 queries by executing a single query for conflicting constraints.
      const existingSlugsSet = new Set<string>();

      try {
        const slugs = valid.map(l => l.slug).filter(Boolean);
        if (slugs.length > 0) {
          // Chunking to avoid URL too long issues if there are many links
          const chunkSize = 100;
          for (let i = 0; i < slugs.length; i += chunkSize) {
            const chunk = slugs.slice(i, i + chunkSize);
            const filterStr = chunk.map(s => `slug="${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(' || ');
            const existingRecords = await pb.collection('links').getFullList({
              filter: filterStr,
              fields: 'slug'
            });
            for (const record of existingRecords) {
              if (record.slug) existingSlugsSet.add(record.slug);
            }
          }
        }
      } catch (fetchErr) {
        // Ignore fetch errors and let the individual fallback handle it
        console.warn('[PB] Bulk pre-fetch failed:', fetchErr);
      }

      const safeToInsert = [];
      const seenSlugsInPayload = new Set<string>();

      for (const link of valid) {
        // Also handle duplicates within the payload itself
        if (existingSlugsSet.has(link.slug) || seenSlugsInPayload.has(link.slug)) {
          invalid.push({ ...link, error: 'Unique constraint failed for slug: ' + link.slug });
          continue;
        }
        seenSlugsInPayload.add(link.slug);
        safeToInsert.push(link);
      }

      if (safeToInsert.length > 0) {
        try {
          const secondBatch = pb.createBatch();
          for (const link of safeToInsert) {
            secondBatch.collection('links').create({
              slug: link.slug,
              destination: link.destination,
              owner_id: user.id,
            });
          }
          await secondBatch.send();
          successCount = safeToInsert.length;
        } catch (secondBatchErr) {
          // Final Fallback to individual inserts if the second batch still fails
          // (e.g., due to other unknown constraints).
          for (const link of safeToInsert) {
            try {
              await pb.collection('links').create({
                slug: link.slug,
                destination: link.destination,
                owner_id: user.id,
              });
              successCount++;
            } catch (err: unknown) {
              invalid.push({ ...link, error: (err instanceof Error ? err.message : String(err)) });
            }
          }
        }
      }
    }

    const failedCount = invalid.length;

    logAudit({
      actor: { id: user.id },
      action: 'bulk_import',
      resource: { type: 'link', id: 'bulk' },
      status: 'success',
      newValue: { count: successCount, failed: failedCount },
      metadata: { invalid_items: invalid },
    });

    return {
      success: successCount,
      failed: failedCount,
      invalid_items: invalid,
    };
  } catch (err: unknown) {
    logAudit({
      actor: { id: user.id },
      action: 'bulk_import',
      resource: { type: 'link', id: 'bulk' },
      status: 'failure',
      error: (err instanceof Error ? err.message : String(err)),
    });
    throw createError({
      statusCode: 400,
      statusMessage: (err instanceof Error ? err.message : String(err)),
    });
  }
});
