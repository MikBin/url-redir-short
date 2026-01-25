import { serverSupabaseUser } from '#supabase/server'
import { generateQRCode, QRCodeOptions } from '../utils/qr'

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

  const options: QRCodeOptions = {}

  if (query.width) {
    options.width = parseInt(query.width as string, 10)
  }

  if (query.margin) {
    options.margin = parseInt(query.margin as string, 10)
  }

  if (query.color || query.bgcolor) {
    options.color = {}
    if (query.color) {
      options.color.dark = query.color as string
    }
    if (query.bgcolor) {
      options.color.light = query.bgcolor as string
    }
  }

  try {
    const qrCode = await generateQRCode(text, options)
    // qrCode is a data URL (data:image/png;base64,...)
    return qrCode
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate QR code',
    })
  }
})
