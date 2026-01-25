import { describe, it, expect } from 'vitest'
import { generateQRCode } from '../server/utils/qr'

describe('QR Code Utility', () => {
  it('should generate a data URL for a given text', async () => {
    const text = 'https://example.com'
    const qrCode = await generateQRCode(text)

    expect(qrCode).toContain('data:image/png;base64,')
    expect(typeof qrCode).toBe('string')
  })

  it('should throw an error if text is empty', async () => {
    await expect(generateQRCode('')).rejects.toThrow('Text is required')
  })
})
