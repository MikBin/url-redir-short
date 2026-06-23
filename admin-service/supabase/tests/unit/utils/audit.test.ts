// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('audit.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('logs audit entry via console.log', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { logAudit } = await import('../../../server/utils/audit')

    logAudit({
       actor: { id: 'user-1' },
       action: 'create',
       resource: { type: 'link', id: 'link-1' },
       status: 'success'
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const logCallArg = consoleSpy.mock.calls[0][0]
    const parsedLog = JSON.parse(logCallArg)

    expect(parsedLog.level).toBe('info')
    expect(parsedLog.type).toBe('audit')
    expect(parsedLog.action).toBe('create')
    expect(parsedLog.actor.id).toBe('user-1')
    expect(parsedLog.resource.id).toBe('link-1')
    expect(parsedLog.status).toBe('success')
    expect(parsedLog.timestamp).toBeDefined()

    consoleSpy.mockRestore()
  })
})
