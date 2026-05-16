import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as h3 from 'h3'

const pbMock = {
  collection: vi.fn().mockReturnThis(),
  authWithPassword: vi.fn(),
  create: vi.fn(),
  authStore: { record: { id: 'u1' }, clear: vi.fn(), token: 'mock-token' }
}

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn(() => Promise.resolve(pbMock))
}))

const readBodyMock = vi.fn()
const setCookieMock = vi.fn()
const deleteCookieMock = vi.fn()

vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
        ...actual,
        setCookie: (...args: any[]) => setCookieMock(...args),
        deleteCookie: (...args: any[]) => deleteCookieMock(...args),
        defineEventHandler: (fn: any) => fn
    }
})

;(globalThis as any).defineEventHandler = (fn: any) => fn
;(globalThis as any).createError = (e: any) => { const err = new Error(e.statusMessage); (err as any).statusCode = e.statusCode; return err }
;(globalThis as any).readBody = readBodyMock
;(globalThis as any).setCookie = setCookieMock
;(globalThis as any).deleteCookie = deleteCookieMock

import loginHandler from '../server/api/auth/login.post'
import logoutHandler from '../server/api/auth/logout.post'
import registerHandler from '../server/api/auth/register.post'

describe('auth endpoints', () => {
  let mockEvent: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockEvent = {}
  })

  describe('login.post', () => {
    it('throws 400 for invalid payload', async () => {
      readBodyMock.mockResolvedValueOnce({ email: 'not-an-email' })
      try {
        await (loginHandler as unknown as Function)(mockEvent)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
      }
    })

    it('logs in successfully and sets cookie', async () => {
      readBodyMock.mockResolvedValueOnce({ email: 'test@example.com', password: 'password123' })
      pbMock.authWithPassword.mockResolvedValueOnce({ token: 'mock-token', record: { id: 'u1' } })

      const result = await (loginHandler as unknown as Function)(mockEvent)

      expect(result).toHaveProperty('user')
      expect(result.user).toEqual({ id: 'u1' })
      expect(setCookieMock).toHaveBeenCalledWith(mockEvent, 'pb_auth', expect.any(String), expect.any(Object))
    })

    it('throws 401 if auth fails', async () => {
      readBodyMock.mockResolvedValueOnce({ email: 'test@example.com', password: 'password123' })
      pbMock.authWithPassword.mockRejectedValueOnce(new Error('Invalid credentials'))

      try {
        await (loginHandler as unknown as Function)(mockEvent)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(401)
      }
    })
  })

  describe('logout.post', () => {
    it('deletes cookie and returns success', async () => {
      const result = await (logoutHandler as unknown as Function)(mockEvent)
      expect(result).toHaveProperty('success', true)
    })
  })

  describe('register.post', () => {
    it('throws 400 for invalid payload', async () => {
      readBodyMock.mockResolvedValueOnce({ email: 'not-an-email' })
      try {
        await (registerHandler as unknown as Function)(mockEvent)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
      }
    })

    it('registers successfully', async () => {
      const payload = { email: 'test@example.com', password: 'password123', passwordConfirm: 'password123' }
      readBodyMock.mockResolvedValueOnce(payload)
      pbMock.create.mockResolvedValueOnce({ id: 'u1' })
      pbMock.authWithPassword.mockResolvedValueOnce({ token: 'mock-token', record: { id: 'u1' } })

      const result = await (registerHandler as unknown as Function)(mockEvent)

      expect(result).toHaveProperty('user')
      expect(result.user).toEqual({ id: 'u1' })
    })

    it('throws 400 if register fails', async () => {
      const payload = { email: 'test@example.com', password: 'password123', passwordConfirm: 'password123' }
      readBodyMock.mockResolvedValueOnce(payload)
      pbMock.create.mockRejectedValueOnce(new Error('Email already exists'))

      try {
        await (registerHandler as unknown as Function)(mockEvent)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
      }
    })
  })
})
