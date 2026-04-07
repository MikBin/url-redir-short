import { describe, it, expect, vi } from 'vitest'
import { syncEvents, SYNC_EVENT_NAME, broadcaster } from '../server/utils/broadcaster'
import * as transformer from '../server/utils/transformer'

describe('Broadcaster', () => {
  it('should emit events via syncEvents', () => {
    const listener = vi.fn()
    syncEvents.on(SYNC_EVENT_NAME, listener)

    const payload = { type: 'test', data: 123 }
    syncEvents.emit(SYNC_EVENT_NAME, payload)

    expect(listener).toHaveBeenCalledWith(payload)
    expect(listener).toHaveBeenCalledTimes(1)

    syncEvents.off(SYNC_EVENT_NAME, listener)
  })

  it('should transform data and broadcast event', () => {
    const listener = vi.fn()
    syncEvents.on(SYNC_EVENT_NAME, listener)

    const mockData = { id: 'link-1', slug: 'test' }

    // Use spy to ensure transformLink is called
    const transformSpy = vi.spyOn(transformer, 'transformLink').mockReturnValue({
      id: 'link-1',
      path: '/test',
      destination: 'https://test.com',
      code: 301
    })

    broadcaster.broadcast('create', mockData)

    expect(transformSpy).toHaveBeenCalledWith(mockData)
    expect(listener).toHaveBeenCalledWith({
      event: 'create',
      data: {
        id: 'link-1',
        path: '/test',
        destination: 'https://test.com',
        code: 301
      }
    })

    transformSpy.mockRestore()
    syncEvents.off(SYNC_EVENT_NAME, listener)
  })

  it('should catch errors when transforming or broadcasting', () => {
    const listener = vi.fn()
    syncEvents.on(SYNC_EVENT_NAME, listener)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Make transformLink throw an error
    const transformSpy = vi.spyOn(transformer, 'transformLink').mockImplementation(() => {
      throw new Error('Transform Error')
    })

    broadcaster.broadcast('create', { id: 'error-link' })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error transforming or broadcasting event create:',
      expect.any(Error)
    )
    expect(listener).not.toHaveBeenCalled()

    transformSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    syncEvents.off(SYNC_EVENT_NAME, listener)
  })

  it('should handle multiple listeners', () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    syncEvents.on(SYNC_EVENT_NAME, listenerA)
    syncEvents.on(SYNC_EVENT_NAME, listenerB)

    syncEvents.emit(SYNC_EVENT_NAME, {})

    expect(listenerA).toHaveBeenCalled()
    expect(listenerB).toHaveBeenCalled()

    syncEvents.off(SYNC_EVENT_NAME, listenerA)
    syncEvents.off(SYNC_EVENT_NAME, listenerB)
  })
})
