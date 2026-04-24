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

    for (const link of valid) {
      try {
        await pb.collection('links').create({
          slug: link.slug,
          destination: link.destination,
          owner_id: user.id,
        });
        successCount++;
      } catch (err: any) {
        // Log individual failures? Or just accumulate?
        // We'll increment failed for ones that didn't create correctly
        // but not fail the whole request immediately.
        // Wait, standard batch behavior is to return how many succeeded.
        // The problem description says "creates a record in the links collection... in a loop or batch"
        // Let's just track how many failed and push to invalid or similar.
        // For now, let's log the error and increment invalid
        invalid.push({ ...link, error: err.message });
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
