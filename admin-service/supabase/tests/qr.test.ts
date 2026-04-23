import { describe, it, expect } from 'vitest'
import { generateQRCode } from '../server/utils/qr'

describe('qr', () => {
  it('generates a valid data URL', async () => {
    const text = 'https://example.com'
    const dataUrl = await generateQRCode(text)

    expect(dataUrl).toContain('data:image/png;base64,')
  })

  it('throws error if text is empty', async () => {
    await expect(generateQRCode('')).rejects.toThrow('Text is required')
  })

  it('rejects non-https logo URL', async () => {
    const text = 'https://example.com'
    const options = { logoUrl: 'http://example.com/logo.png' }

    await expect(generateQRCode(text, options)).rejects.toThrow('Invalid logo URL: must use HTTPS protocol')
  })
})
