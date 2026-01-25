export interface BulkLinkImport {
  slug: string
  destination: string
  [key: string]: any
}

export const validateBulkLinks = (links: any[]): { valid: BulkLinkImport[], invalid: any[] } => {
  const valid: BulkLinkImport[] = []
  const invalid: any[] = []

  if (!Array.isArray(links)) {
      throw new Error('Input must be an array')
  }

  for (const link of links) {
    if (link && typeof link.slug === 'string' && typeof link.destination === 'string' && link.slug.trim() !== '' && link.destination.trim() !== '') {
       valid.push({
           ...link,
           slug: link.slug.trim(),
           destination: link.destination.trim()
       })
    } else {
       invalid.push(link)
    }
  }

  return { valid, invalid }
}
