import { describe, it, expect, vi } from 'vitest'
import { syncEvents, SYNC_EVENT_NAME } from '../server/utils/broadcaster'

describe('Broadcaster', () => {
  it('should emit events', () => {
    const listener = vi.fn()
    syncEvents.on(SYNC_EVENT_NAME, listener)

    const payload = { type: 'test', data: 123 }
    syncEvents.emit(SYNC_EVENT_NAME, payload)

    expect(listener).toHaveBeenCalledWith(payload)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple listeners', () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    syncEvents.on(SYNC_EVENT_NAME, listenerA)
    syncEvents.on(SYNC_EVENT_NAME, listenerB)

    syncEvents.emit(SYNC_EVENT_NAME, {})

    expect(listenerA).toHaveBeenCalled()
    expect(listenerB).toHaveBeenCalled()
  })
})
