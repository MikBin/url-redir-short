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
    } catch (batchErr: any) {
      // Fallback to individual inserts if batch fails (e.g. unique constraint violation)
      // This preserves the original partial success behavior.
      for (const link of valid) {
        try {
          await pb.collection('links').create({
            slug: link.slug,
            destination: link.destination,
            owner_id: user.id,
          });
          successCount++;
        } catch (err: any) {
          invalid.push({ ...link, error: err.message });
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
  } catch (err: any) {
    logAudit({
      actor: { id: user.id },
      action: 'bulk_import',
      resource: { type: 'link', id: 'bulk' },
      status: 'failure',
      error: err.message,
    });
    throw createError({
      statusCode: 400,
      statusMessage: err.message,
    });
  }
});
