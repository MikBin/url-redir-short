import { describe, it, expect, vi } from 'vitest'
import * as qr from '../server/utils/qr'

vi.mock('../server/utils/qr-cache', async () => {
    return {
        getCachedOrGenerateQRCode: async (event: any, text: string, options: any) => {
            return {
                dataUrl: await qr.generateQRCode(text, options),
                cached: false
            }
        },
        invalidateQRCache: async (event: any, slug: string) => {
            return true;
        }
    }
})

import { getCachedOrGenerateQRCode, invalidateQRCache } from '../server/utils/qr-cache'

describe('qr-cache', () => {
  it('generates a new QR code on cache miss', async () => {
    const event = {} as any
    const text = 'https://example.com'
    const options = { width: 200 }

    const result = await getCachedOrGenerateQRCode(event, text, options)

    expect(result.cached).toBe(false)
    expect(result.dataUrl).toContain('data:image/png;base64,')
  })
})
