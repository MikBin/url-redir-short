import { z } from 'zod';

const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

export const APP_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const AppRegistryRowSchema = z
  .object({
    app_id: z.string().max(64).regex(APP_ID_PATTERN),
    share_host: z.string().max(253).regex(HOSTNAME_PATTERN),
    allowed_host: z.string().max(253).regex(HOSTNAME_PATTERN),
    url_template: z.record(z.string().min(1), z.string().min(1)),
    daily_create_limit: z.number().int().min(1).max(1_000_000).default(100),
    active: z.boolean()
  })
  .superRefine((row, ctx) => {
    if (row.share_host === row.allowed_host) {
      ctx.addIssue({
        code: 'custom',
        path: ['share_host'],
        message: 'share_host must differ from allowed_host'
      });
    }

    const entries = Object.entries(row.url_template);
    if (entries.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['url_template'],
        message: 'url_template must define at least one share type'
      });
      return;
    }

    for (const [type, template] of entries) {
      if (!template.startsWith(`https://${row.allowed_host}/`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['url_template', type],
          message: `template must be an HTTPS URL on the allowed host ${row.allowed_host}`
        });
      }

      if (!template.includes('{contentId}')) {
        ctx.addIssue({
          code: 'custom',
          path: ['url_template', type],
          message: 'template must contain the {contentId} placeholder'
        });
      }
    }
  });

export type AppRegistryRow = z.infer<typeof AppRegistryRowSchema>;

export function validateAppRow(row: unknown): z.SafeParseReturnType<unknown, AppRegistryRow> {
  return AppRegistryRowSchema.safeParse(row);
}
