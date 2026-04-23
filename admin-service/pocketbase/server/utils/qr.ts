import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
}

export const generateQRCode = async (text: string, options?: QRCodeOptions): Promise<string> => {
  if (!text) {
    throw new Error('Text is required')
  }
  return QRCode.toDataURL(text, options)
}
