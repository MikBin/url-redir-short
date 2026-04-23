import { serverSupabaseClient } from '#supabase/server'
import crypto from 'crypto'
import type { QRCodeOptions } from './qr'
import type { H3Event } from 'h3'
import { generateQRCode } from './qr'

export async function getCachedOrGenerateQRCode(event: H3Event, text: string, options: QRCodeOptions): Promise<{ dataUrl: string, cached: boolean }> {
  const client = await serverSupabaseClient(event)

  // Create deterministic cache key using slug as a folder
  const url = new URL(text)
  const slug = url.pathname.replace(/^\//, '') // e.g., 'my-link'

  const cachePayload = JSON.stringify({ text, options })
  const hash = crypto.createHash('sha256').update(cachePayload).digest('hex')
  const cacheKey = `${slug}/${hash}.png`
  const bucket = 'qr-codes'

  // Try to fetch from storage
  const { data: fileData, error: fetchError } = await client.storage.from(bucket).download(cacheKey)

  if (!fetchError && fileData) {
      const arrayBuffer = await fileData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      return {
          dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
          cached: true
      }
  }

  // Generate if not cached
  const dataUrl = await generateQRCode(text, options)

  // Extract base64 part
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  // Attempt to store in cache asynchronously (fire and forget)
  client.storage.from(bucket).upload(cacheKey, buffer, {
      contentType: 'image/png',
      upsert: true
  }).catch(err => {
      console.error('Failed to cache QR code:', err)
  })

  return { dataUrl, cached: false }
}

export async function invalidateQRCache(event: H3Event, slug: string) {
  const client = await serverSupabaseClient(event)
  const bucket = 'qr-codes'

  try {
    const cleanSlug = slug.replace(/^\//, '')
    // List all files in the slug directory
    const { data: files, error: listError } = await client.storage.from(bucket).list(cleanSlug)
    if (listError) throw listError

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${cleanSlug}/${file.name}`)
      const { error: removeError } = await client.storage.from(bucket).remove(filePaths)
      if (removeError) throw removeError
    }
  } catch (err) {
    console.error('Failed to invalidate cache:', err)
  }
}
