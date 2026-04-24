import { describe, it, expect } from 'vitest'
import { generateQRCode } from '../server/utils/qr'

describe('QR Code Utils', () => {
  it('should generate a valid QR code data URL', async () => {
    const url = await generateQRCode('https://example.com')
    expect(url).toBeTypeOf('string')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('should throw an error if text is empty', async () => {
    await expect(generateQRCode('')).rejects.toThrow('Text is required')
  })

  it('should pass options correctly without throwing errors', async () => {
    const url = await generateQRCode('https://example.com', {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    expect(url).toBeTypeOf('string')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })
})
