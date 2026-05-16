// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getHeader: vi.fn(),
  setResponseStatus: vi.fn(),
  setHeader: vi.fn()
}))

vi.mock('../../../../server/utils/metrics', () => ({
  metrics: {
    sseClients: { inc: vi.fn(), dec: vi.fn() }
  }
}))

vi.mock('../../../../server/utils/broadcaster', () => ({
  syncEvents: { on: vi.fn(), off: vi.fn() },
  SYNC_EVENT_NAME: 'test_event'
}))

import { setResponseStatus, setHeader, getHeader } from 'h3'
import { metrics } from '../../../../server/utils/metrics'
import { syncEvents, SYNC_EVENT_NAME } from '../../../../server/utils/broadcaster'

let handler: any;

describe('stream.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getHeader = vi.fn();
     (globalThis as any).setResponseStatus = vi.fn();
     (globalThis as any).setHeader = vi.fn();

     const module = await import('../../../../server/api/sync/stream.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SYNC_API_KEY = 'test-secret';
  })

  it('returns 401 when no api key', async () => {
    vi.mocked((globalThis as any).getHeader).mockReturnValue(undefined)

    const result = await handler({} as any)
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when wrong api key', async () => {
    vi.mocked((globalThis as any).getHeader).mockReturnValue('Bearer wrong')

    const result = await handler({} as any)
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 and stream on success', async () => {
    vi.mocked((globalThis as any).getHeader).mockReturnValue('Bearer test-secret')

    const event = { node: { req: { on: vi.fn() } } }
    const result = await handler(event as any)

    expect(result).toBeInstanceOf(ReadableStream)

    // Test the stream logic
    const reader = result.getReader()
    const { value, done } = await reader.read()
    expect(done).toBe(false)
    const text = new TextDecoder().decode(value)
    expect(text).toContain('data: {"type":"connected","timestamp":')
    expect(metrics.sseClients.inc).toHaveBeenCalled()
    expect(syncEvents.on).toHaveBeenCalledWith(SYNC_EVENT_NAME, expect.any(Function))

    // We can also trigger the event manually to see if it enqueues
    const listener = vi.mocked(syncEvents.on).mock.calls[0][1] as Function
    listener({ event: 'custom', data: { id: 1 } })
    const { value: val2 } = await reader.read()
    const text2 = new TextDecoder().decode(val2)
    expect(text2).toContain('event: custom\ndata: {"id":1}\n\n')

    // Cleanup logic
    const onClose = event.node.req.on.mock.calls[0][1] as Function
    onClose()
    expect(syncEvents.off).toHaveBeenCalledWith(SYNC_EVENT_NAME, listener)
    expect(metrics.sseClients.dec).toHaveBeenCalled()
  })
})
