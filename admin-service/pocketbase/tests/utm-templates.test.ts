import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUtmTemplates } from '../app/composables/useUtmTemplates'
import { ref } from 'vue'

// Mock ref and onMounted for the composable
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: vi.fn((fn) => fn())
  }
})

describe('useUtmTemplates', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    // Clear mock storage
    for (const key in mockStorage) {
      delete mockStorage[key]
    }

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key]
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    } as unknown as Storage

    // Mock window to make typeof window !== 'undefined'
    global.window = {} as Window & typeof globalThis
  })

  it('loads templates from localStorage on mount', () => {
    mockStorage['redir_utm_templates'] = JSON.stringify([
      { name: 'Test', params: { source: 'a', medium: 'b', campaign: 'c' } }
    ])

    const { templates } = useUtmTemplates()

    expect(templates.value).toHaveLength(1)
    expect(templates.value[0].name).toBe('Test')
  })

  it('saves a template to localStorage', () => {
    const { saveTemplate, templates } = useUtmTemplates()

    saveTemplate('NewTemplate', { source: 'google', medium: 'cpc', campaign: 'summer' })

    expect(templates.value).toHaveLength(1)
    expect(templates.value[0].name).toBe('NewTemplate')
    expect(mockStorage['redir_utm_templates']).toBeDefined()
    expect(JSON.parse(mockStorage['redir_utm_templates'])).toHaveLength(1)
  })

  it('overwrites an existing template with the same name', () => {
    const { saveTemplate, templates } = useUtmTemplates()

    saveTemplate('Duplicate', { source: 's1', medium: 'm1', campaign: 'c1' })
    saveTemplate('Duplicate', { source: 's2', medium: 'm2', campaign: 'c2' })

    expect(templates.value).toHaveLength(1)
    expect(templates.value[0].params.source).toBe('s2')
  })

  it('deletes a template by name', () => {
    const { saveTemplate, deleteTemplate, templates } = useUtmTemplates()

    saveTemplate('ToKeep', { source: 's1', medium: 'm1', campaign: 'c1' })
    saveTemplate('ToDelete', { source: 's2', medium: 'm2', campaign: 'c2' })

    expect(templates.value).toHaveLength(2)

    deleteTemplate('ToDelete')

    expect(templates.value).toHaveLength(1)
    expect(templates.value[0].name).toBe('ToKeep')
    expect(JSON.parse(mockStorage['redir_utm_templates'])).toHaveLength(1)
  })

  it('caps templates at 20', () => {
    const { saveTemplate, templates } = useUtmTemplates()

    for (let i = 0; i < 25; i++) {
      saveTemplate(`Template${i}`, { source: `s${i}`, medium: 'm', campaign: 'c' })
    }

    expect(templates.value).toHaveLength(20)
    // The last 20 added should be Template5 to Template24
    expect(templates.value[0].name).toBe('Template5')
    expect(templates.value[19].name).toBe('Template24')
  })

  it('handles empty localStorage gracefully', () => {
    const { templates } = useUtmTemplates()
    expect(templates.value).toHaveLength(0)
  })

  it('is SSR safe (handles window undefined)', () => {
    // @ts-ignore
    delete global.window
    const { saveTemplate, deleteTemplate, loadTemplates } = useUtmTemplates()

    expect(() => loadTemplates()).not.toThrow()
    expect(() => saveTemplate('Test', { source: 's', medium: 'm', campaign: 'c' })).not.toThrow()
    expect(() => deleteTemplate('Test')).not.toThrow()
  })
})
