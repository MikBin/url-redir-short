<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>

      <!-- Date Range Selector -->
      <div class="flex space-x-2">
        <button
          v-for="range in ['7d', '30d', 'custom']"
          :key="range"
          @click="dateRange = range"
          :class="[
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            dateRange === range
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          ]"
        >
          {{ range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Custom' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-500">Loading analytics data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
      <strong class="font-bold">Error loading data: </strong>
      <span class="block sm:inline">{{ error }}</span>
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Total Redirects</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ summaryData?.totalRedirects || 0 }}</dd>
          </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Unique Visitors</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ summaryData?.uniqueVisitors || 0 }}</dd>
          </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Active Links</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ summaryData?.topLinks?.length || 0 }}</dd>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Click Trends Chart -->
        <div class="bg-white shadow rounded-lg p-6 flex flex-col">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Click Trends</h2>
          <div class="h-64 flex items-end justify-between space-x-2 pb-8 pt-6 border-b border-gray-100 relative">
            <template v-if="trendData && trendData.length > 0">
              <div
                v-for="day in trendData"
                :key="day.date"
                class="w-full h-full flex flex-col justify-end items-center group relative"
              >
                <!-- Tooltip -->
                <div class="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                  {{ day.date }}: {{ day.clicks }} clicks
                </div>
                <!-- Bar -->
                <div
                  class="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                  :style="{ height: `${getMaxHeight(day.clicks)}%`, minHeight: '4px' }"
                ></div>
                <!-- Label -->
                <div class="absolute -bottom-8 text-xs text-gray-500 rotate-45 origin-left whitespace-nowrap">
                  {{ formatDate(day.date) }}
                </div>
              </div>
            </template>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-500">
              No trend data available
            </div>
          </div>
        </div>

        <!-- Top Links Table -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Top Links</h2>
          <div v-if="summaryData?.topLinks && summaryData.topLinks.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link ID</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Short URL</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="link in summaryData.topLinks" :key="link.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ link.id }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ link.shortUrl || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{{ link.clicks }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            No top links data available
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pbAuth = useCookie('pb_auth')

// Ensure user is authenticated
if (!pbAuth.value) {
  router.push('/login')
}

const dateRange = ref('7d')
const loading = ref(true)
const error = ref('')

const summaryData = ref<any>(null)
const trendData = ref<any[]>([])

const fetchAnalyticsData = async () => {
  loading.value = true
  error.value = ''
  try {
    // In a real scenario, you'd pass dateRange as query params if supported
    // e.g. /api/analytics/summary?range=${dateRange.value}

    // As instructed by endpoints
    const [summaryRes, trendsRes] = await Promise.all([
      $fetch('/api/analytics/summary', { query: { range: dateRange.value } }),
      $fetch('/api/analytics/trends', { query: { range: dateRange.value } })
    ])

    summaryData.value = summaryRes
    trendData.value = trendsRes

  } catch (err: any) {
    console.error('Error fetching analytics:', err)
    error.value = err.message || 'Failed to load analytics data'
  } finally {
    loading.value = false
  }
}

// Watch for date range changes
watch(dateRange, () => {
  fetchAnalyticsData()
})

onMounted(() => {
  if (pbAuth.value) {
    fetchAnalyticsData()
  }
})

// Chart helpers
const maxClicks = computed(() => {
  if (!trendData.value || trendData.value.length === 0) return 0
  return Math.max(...trendData.value.map(d => d.clicks))
})

const getMaxHeight = (clicks: number) => {
  if (maxClicks.value === 0) return 0
  return (clicks / maxClicks.value) * 100
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
</script>
