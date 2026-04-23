import QRCode from 'qrcode'
import sharp from 'sharp'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  logoUrl?: string
  logoSize?: number // 0.1 to 0.3 (10% to 30%)
}

export const generateQRCode = async (text: string, options?: QRCodeOptions): Promise<string> => {
  if (!text) {
    throw new Error('Text is required')
  }

  let errorCorrectionLevel = options?.errorCorrectionLevel || 'M'

  // Auto-upgrade error correction to H if logo is present
  if (options?.logoUrl) {
    errorCorrectionLevel = 'H'
  }

  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    width: options?.width,
    margin: options?.margin,
    color: options?.color,
    errorCorrectionLevel,
    type: 'image/png' // Ensure type is set explicitly
  }

  if (!options?.logoUrl) {
    return QRCode.toDataURL(text, qrOptions)
  }

  // Prevent SSRF: only allow https protocols
  if (!options.logoUrl.startsWith('https://')) {
    throw new Error('Invalid logo URL: must use HTTPS protocol')
  }

  // Generate QR as Buffer for sharp
  const qrBuffer = await QRCode.toBuffer(text, {
      ...qrOptions,
      type: 'png'
  })

  try {
    // Fetch and process logo
    const logoRes = await fetch(options.logoUrl)
    if (!logoRes.ok) throw new Error(`Failed to fetch logo: ${logoRes.statusText}`)

    const logoBuffer = await logoRes.arrayBuffer()
    const qrImage = sharp(qrBuffer)
    const metadata = await qrImage.metadata()
    const qrWidth = metadata.width || (options.width || 200)

    // Validate and calculate logo size (max 30%)
    let sizePercent = options.logoSize || 0.2
    if (sizePercent > 0.3) sizePercent = 0.3
    if (sizePercent < 0.1) sizePercent = 0.1

    const logoSize = Math.floor(qrWidth * sizePercent)

    const processedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer()

    const composited = await qrImage
      .composite([{ input: processedLogo, gravity: 'center' }])
      .png()
      .toBuffer()

    return `data:image/png;base64,${composited.toString('base64')}`
  } catch (error) {
    // Fallback to standard QR if logo processing fails
    console.error('Failed to composite QR with logo:', error)
    return QRCode.toDataURL(text, qrOptions)
  }
}
