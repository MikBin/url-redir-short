import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

// Mock chart.js to avoid canvas errors in happy-dom
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  Title: {},
  Tooltip: {},
  Legend: {},
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  ArcElement: {}
}))

const mockStatsData = {
  events: [
    { id: 1, path: '/foo', destination: 'https://ex.com', timestamp: new Date().toISOString() }
  ]
}
const mockDashboardData = {
  summary: {
    totalClicks: 123,
    todayClicks: 10,
    weekClicks: 50,
    monthClicks: 100
  },
  hourlyTrend: [],
  geoDistribution: [],
  deviceDistribution: [],
  browserDistribution: []
}

mockNuxtImport('useFetch', () => {
  return (url: string) => {
    if (url.includes('stats')) {
        return { data: ref(mockStatsData), pending: ref(false), error: ref(null) }
    }
    if (url.includes('dashboard')) {
        return { data: ref(mockDashboardData), pending: ref(false), error: ref(null) }
    }
    return { data: ref(null), pending: ref(false), error: ref(true) }
  }
})

// Import component AFTER mocking
import Analytics from '../../app/pages/analytics.vue'

describe('Analytics.vue', () => {
  it('renders stats correctly', async () => {
    // Stub ClientOnly to just render slot
    const ClientOnlyStub = {
      template: '<div><slot /></div>'
    }

    // Wrap in Suspense because Analytics uses top-level await
    const TestWrapper = defineComponent({
      components: { Analytics },
      template: '<Suspense><Analytics /></Suspense>'
    })

    const wrapper = mount(TestWrapper, {
      global: {
        stubs: {
          ClientOnly: ClientOnlyStub,
          Line: true,
          Bar: true,
          Doughnut: true
        }
      }
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Debug output if fails
    // console.log(wrapper.html())

    expect(wrapper.text()).toContain('Analytics')
    expect(wrapper.text()).toContain('Total Clicks')
    expect(wrapper.text()).toContain('123') // Total clicks value
    expect(wrapper.text()).toContain('/foo') // Event path
  })
})
