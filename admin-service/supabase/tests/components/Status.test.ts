import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Status from '../../app/pages/status.vue'

describe('Status.vue', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders health status correctly', async () => {
    // Mock $fetch
    const mockHealth = {
      status: 'healthy',
      uptime: 3600,
      checks: {
        database: { status: 'healthy', latencyMs: 10 }
      }
    }
    const mockMetrics = {
      memory: { heapUsed: 1024 * 1024 * 50, heapTotal: 1024 * 1024 * 100 },
      requests: { total: 100, errors: 0 }
    }

    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/health') return Promise.resolve(mockHealth)
      if (url === '/api/metrics') return Promise.resolve(mockMetrics)
      return Promise.reject(new Error('Unknown endpoint'))
    })

    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mount(Status, {
        global: {
            stubs: {
                NuxtLink: { template: '<a><slot /></a>' }
            }
        }
    })

    // Wait for async calls to finish (onMounted is async but the component is not suspended)
    // The refresh function is async
    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('System Status')
    expect(wrapper.text()).toContain('healthy')
    expect(wrapper.text()).toContain('1h 0m 0s') // Uptime format
  })

  it('renders error state correctly', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network Error'))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mount(Status, {
        global: {
            stubs: {
                NuxtLink: { template: '<a><slot /></a>' }
            }
        }
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Error!')
    expect(wrapper.text()).toContain('Network Error')
  })
})
