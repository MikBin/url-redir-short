/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { publishRuleToKV, deleteRuleFromKV } from '../server/utils/cloudflare-kv'
import { logger } from '../server/utils/logger'

vi.mock('../server/utils/logger', () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
})

describe('cloudflare-kv', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks()
    originalEnv = { ...process.env }

    // Set valid environment variables
    process.env.CF_ACCOUNT_ID = 'test-account-id'
    process.env.CF_KV_NAMESPACE_ID = 'test-namespace-id'
    process.env.CF_API_TOKEN = 'test-token'

    // Mock global fetch
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('ok')
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('publishRuleToKV', () => {
    const mockRule = {
      path: '/test',
      target: 'https://example.com'
    } as any

    it('bails early if env vars are missing', async () => {
      delete process.env.CF_ACCOUNT_ID

      await publishRuleToKV(mockRule)

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('publishes rule successfully', async () => {
      await publishRuleToKV(mockRule)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/storage/kv/namespaces/test-namespace-id/values/%2Ftest',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockRule)
        })
      )

      expect(logger.debug).toHaveBeenCalledWith(
        '[CF KV] Rule published',
        { path: '/test' }
      )
    })

    it('logs warning if response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('bad request')
      })

      await publishRuleToKV(mockRule)

      expect(logger.warn).toHaveBeenCalledWith(
        '[CF KV] Failed to put rule',
        { path: '/test', status: 400, body: 'bad request' }
      )
    })

    it('catches and logs network errors', async () => {
      const error = new Error('network error')
      fetchMock.mockRejectedValueOnce(error)

      await publishRuleToKV(mockRule)

      // Should not throw, but log error
      expect(logger.error).toHaveBeenCalledWith(
        '[CF KV] Network error publishing rule',
        { path: '/test' },
        error
      )
    })
  })

  describe('deleteRuleFromKV', () => {
    it('bails early if env vars are missing', async () => {
      delete process.env.CF_API_TOKEN

      await deleteRuleFromKV('/test-del')

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('deletes rule successfully', async () => {
      await deleteRuleFromKV('/test-del')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/storage/kv/namespaces/test-namespace-id/values/%2Ftest-del',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          }
        })
      )

      expect(logger.debug).toHaveBeenCalledWith(
        '[CF KV] Rule deleted',
        { path: '/test-del' }
      )
    })

    it('logs warning if response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('not found')
      })

      await deleteRuleFromKV('/test-del')

      expect(logger.warn).toHaveBeenCalledWith(
        '[CF KV] Failed to delete rule',
        { path: '/test-del', status: 404, body: 'not found' }
      )
    })

    it('catches and logs network errors', async () => {
      const error = new Error('network timeout')
      fetchMock.mockRejectedValueOnce(error)

      await deleteRuleFromKV('/test-del')

      // Should not throw, but log error
      expect(logger.error).toHaveBeenCalledWith(
        '[CF KV] Network error deleting rule',
        { path: '/test-del' },
        error
      )
    })
  })
})
