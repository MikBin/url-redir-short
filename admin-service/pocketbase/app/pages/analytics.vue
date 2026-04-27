<template>
  <div class="space-y-6 pb-12">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-500">Loading analytics data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
      <strong class="font-bold">Error loading data: </strong>
      <span class="block sm:inline">{{ error.message || 'Failed to load analytics data' }}</span>
    </div>

    <template v-else>
      <!-- Summary Cards (4 columns) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Total Clicks</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ dashboardData?.summary?.totalClicks || 0 }}</dd>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Today</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ dashboardData?.summary?.todayClicks || 0 }}</dd>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">This Week</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ dashboardData?.summary?.weekClicks || 0 }}</dd>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">This Month</dt>
            <dd class="mt-1 text-3xl font-semibold text-gray-900">{{ dashboardData?.summary?.monthClicks || 0 }}</dd>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Traffic Trend Chart (Last 24h) -->
        <div class="bg-white shadow rounded-lg p-6 flex flex-col col-span-1 lg:col-span-2">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Traffic Trend (Last 24h)</h2>
          <div class="h-64 flex items-end justify-between space-x-1 pb-8 pt-6 border-b border-gray-100 relative">
            <template v-if="dashboardData?.hourlyTrend && dashboardData.hourlyTrend.length > 0">
              <div
                v-for="hour in dashboardData.hourlyTrend"
                :key="hour.hour"
                class="w-full h-full flex flex-col justify-end items-center group relative"
              >
                <!-- Tooltip -->
                <div class="opacity-0 group-hover:opacity-100 absolute -top-10 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                  <ClientOnly>
                    <span>{{ formatHour(hour.hour) }}<br>{{ hour.count }} clicks</span>
                  </ClientOnly>
                </div>
                <!-- Bar -->
                <div
                  class="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                  :style="{ height: getBarPercentage(hour.count, maxHourlyClicks), minHeight: '4px' }"
                ></div>
                <!-- Label (every nth depending on density could be better, but we show all with smaller text/rotated) -->
                <div class="absolute -bottom-8 text-[10px] text-gray-500 rotate-45 origin-left whitespace-nowrap">
                  <ClientOnly>
                    <span>{{ formatHourShort(hour.hour) }}</span>
                  </ClientOnly>
                </div>
              </div>
            </template>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-500">
              No trend data available
            </div>
          </div>
        </div>

        <!-- Top Countries -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Top Countries</h2>
          <div v-if="dashboardData?.geoDistribution && dashboardData.geoDistribution.length > 0" class="space-y-3">
            <div v-for="geo in dashboardData.geoDistribution" :key="geo.country" class="relative">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium text-gray-700">{{ geo.country || 'Unknown' }}</span>
                <span class="text-gray-500">{{ geo.count }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-indigo-500 h-2 rounded-full" :style="{ width: getBarPercentage(geo.count, maxGeoCount) }"></div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-4">No country data</div>
        </div>

        <!-- Devices and Browsers -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white shadow rounded-lg p-6">
          <div>
            <h2 class="text-lg font-medium text-gray-900 mb-4">Device Types</h2>
            <div v-if="dashboardData?.deviceDistribution && dashboardData.deviceDistribution.length > 0" class="flex flex-wrap gap-2">
              <div v-for="dev in dashboardData.deviceDistribution" :key="dev.device" class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {{ dev.device || 'Unknown' }}: {{ dev.count }}
              </div>
            </div>
            <div v-else class="text-center text-gray-500 py-4">No device data</div>
          </div>

          <div>
            <h2 class="text-lg font-medium text-gray-900 mb-4">Browsers</h2>
            <ul v-if="dashboardData?.browserDistribution && dashboardData.browserDistribution.length > 0" class="divide-y divide-gray-200">
              <li v-for="browser in dashboardData.browserDistribution" :key="browser.browser" class="py-2 flex justify-between">
                <span class="text-sm text-gray-700">{{ browser.browser || 'Unknown' }}</span>
                <span class="text-sm font-semibold text-gray-900">{{ browser.count }}</span>
              </li>
            </ul>
            <div v-else class="text-center text-gray-500 py-4">No browser data</div>
          </div>
        </div>

        <!-- Top Links Table -->
        <div class="bg-white shadow rounded-lg p-6 col-span-1 lg:col-span-2">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Top Links</h2>
          <div v-if="dashboardData?.topLinks && dashboardData.topLinks.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="link in dashboardData.topLinks" :key="link.path">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{{ link.path }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{{ link.clicks }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            No top links data available
          </div>
        </div>

        <!-- Recent Events Table -->
        <div class="bg-white shadow rounded-lg p-6 col-span-1 lg:col-span-2">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Recent Events (Last 100)</h2>
          <div v-if="statsData?.events && statsData.events.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th scope="col" class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Browser</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="event in statsData.events" :key="event.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <ClientOnly>
                      <span>{{ formatDateTime(event.timestamp || event.created) }}</span>
                    </ClientOnly>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{{ event.path }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{{ event.destination || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ event.country || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ event.device_type || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ event.browser || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            No recent events available
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCookie, useFetch } from '#imports'

const router = useRouter()
const pbAuth = useCookie('pb_auth')

// Ensure user is authenticated
if (!pbAuth.value) {
  router.push('/login')
}

// Fetch data
const { data: dashboardData, pending: dashboardPending, error: dashboardError } = await useFetch<any>('/api/analytics/dashboard')
const { data: statsData, pending: statsPending, error: statsError } = await useFetch<any>('/api/analytics/stats')

const pending = computed(() => dashboardPending.value || statsPending.value)
const error = computed(() => dashboardError.value || statsError.value)

// Chart helpers
const maxHourlyClicks = computed(() => {
  if (!dashboardData.value?.hourlyTrend || dashboardData.value.hourlyTrend.length === 0) return 0
  return Math.max(...dashboardData.value.hourlyTrend.map((d: any) => d.count))
})

const maxGeoCount = computed(() => {
  if (!dashboardData.value?.geoDistribution || dashboardData.value.geoDistribution.length === 0) return 0
  return Math.max(...dashboardData.value.geoDistribution.map((d: any) => d.count))
})

const getBarPercentage = (value: number, maxValue: number) => {
  if (!maxValue || maxValue === 0) return '0%'
  return `${(value / maxValue) * 100}%`
}

// Date Formatters
const formatHour = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

const formatHourShort = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric'
  }).format(date)
}

const formatDateTime = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}
</script>
