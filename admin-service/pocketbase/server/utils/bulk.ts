export interface BulkLinkImport {
  slug: string;
  destination: string;
  [key: string]: any;
}

export function validateBulkLinks(links: any[]): { valid: BulkLinkImport[], invalid: any[] } {
  if (!Array.isArray(links)) {
    throw new Error('Input must be an array of links');
  }

  const valid: BulkLinkImport[] = [];
  const invalid: any[] = [];

  for (const item of links) {
    if (!item || typeof item !== 'object') {
      invalid.push(item);
      continue;
    }

    if (typeof item.slug !== 'string' || typeof item.destination !== 'string') {
      invalid.push(item);
      continue;
    }

    const slug = item.slug.trim();
    const destination = item.destination.trim();

    if (slug.length === 0 || destination.length === 0) {
      invalid.push(item);
      continue;
    }

    valid.push({
      ...item,
      slug,
      destination,
    });
  }

  return { valid, invalid };
}
