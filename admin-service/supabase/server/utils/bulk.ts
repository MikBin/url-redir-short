export interface BulkLinkImport {
  slug: string
  destination: string
  [key: string]: unknown
}

export const validateBulkLinks = (links: unknown[]): { valid: BulkLinkImport[], invalid: unknown[] } => {
  const valid: BulkLinkImport[] = []
  const invalid: unknown[] = []

  if (!Array.isArray(links)) {
      throw new Error('Input must be an array')
  }

  for (const item of links) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item)
    ) {
      const link = item as Record<string, unknown>;
      if (
        typeof link.slug === 'string' &&
        typeof link.destination === 'string' &&
        link.slug.trim() !== '' &&
        link.destination.trim() !== ''
      ) {
         valid.push({
             ...link,
             slug: link.slug.trim(),
             destination: link.destination.trim()
         })
         continue;
      }
    }
    invalid.push(item)
  }

  return { valid, invalid }
}
