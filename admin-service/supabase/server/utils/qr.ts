import QRCode from 'qrcode'

export const generateQRCode = async (text: string): Promise<string> => {
  if (!text) {
    throw new Error('Text is required')
  }
  return QRCode.toDataURL(text)
}
