import { serverSupabaseUser } from '#supabase/server'
import { generateQRCode } from '../utils/qr'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const text = query.text as string

  if (!text) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Text query parameter is required',
    })
  }

  try {
    const qrCode = await generateQRCode(text)
    // qrCode is a data URL (data:image/png;base64,...), we can return it directly or stream the image.
    // For simplicity, let's return it as text so the frontend can put it in an <img src="...">
    return qrCode
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate QR code',
    })
  }
})
