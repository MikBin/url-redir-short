<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Analytics</h1>

    <div v-if="pending" class="text-gray-500">Loading...</div>
    <div v-else-if="error" class="text-red-500">Error: {{ error.message }}</div>
    <div v-else-if="statsData && dashboardData">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-gray-500 text-sm">Total Clicks</h3>
          <p class="text-2xl font-bold">{{ dashboardData.summary.totalClicks }}</p>
        </div>
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-gray-500 text-sm">Today</h3>
          <p class="text-2xl font-bold">{{ dashboardData.summary.todayClicks }}</p>
        </div>
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-gray-500 text-sm">This Week</h3>
          <p class="text-2xl font-bold">{{ dashboardData.summary.weekClicks }}</p>
        </div>
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-gray-500 text-sm">This Month</h3>
          <p class="text-2xl font-bold">{{ dashboardData.summary.monthClicks }}</p>
        </div>
      </div>

      <!-- Charts Row 1: Trends & Geo -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Hourly Trend -->
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-lg font-semibold mb-4">Traffic Trend (Last 24h)</h3>
          <div class="h-64">
            <ClientOnly>
              <Line v-if="trendData" :data="trendData" :options="lineOptions" />
            </ClientOnly>
          </div>
        </div>

        <!-- Geo Distribution -->
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-lg font-semibold mb-4">Top Countries</h3>
          <div class="h-64">
            <ClientOnly>
              <Bar v-if="geoData" :data="geoData" :options="barOptions" />
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Charts Row 2: Device & Browser -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Device Distribution -->
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-lg font-semibold mb-4">Device Types</h3>
          <div class="h-64 flex justify-center">
            <ClientOnly>
              <Doughnut v-if="deviceData" :data="deviceData" :options="doughnutOptions" />
            </ClientOnly>
          </div>
        </div>

        <!-- Browser Distribution -->
        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-lg font-semibold mb-4">Browsers</h3>
          <div class="h-64 flex justify-center">
             <ClientOnly>
              <Doughnut v-if="browserData" :data="browserData" :options="doughnutOptions" />
             </ClientOnly>
          </div>
        </div>
      </div>

      <div class="mb-4 text-lg">
        <span class="font-semibold">Recent Events:</span>
      </div>

      <div class="bg-white shadow rounded overflow-hidden overflow-x-auto">
        <table class="min-w-full leading-normal">
          <thead>
            <tr>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Path</th>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Destination</th>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP</th>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Referrer</th>
              <th class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">UA</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in statsData.events" :key="event.id">
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">{{ event.path }}</td>
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                <div class="truncate max-w-xs" :title="event.destination">{{ event.destination }}</div>
              </td>
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                <ClientOnly>
                  {{ new Date(event.timestamp).toLocaleString() }}
                  <template #fallback>
                    {{ event.timestamp }}
                  </template>
                </ClientOnly>
              </td>
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">{{ event.ip }}</td>
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                 <div class="truncate max-w-xs" :title="event.referrer">{{ event.referrer || '-' }}</div>
              </td>
              <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                 <div class="truncate max-w-xs" :title="event.user_agent">{{ event.user_agent }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  type ChartOptions
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement)

const { data: statsData, pending: statsPending, error: statsError } = await useFetch('/api/analytics/stats')
const { data: dashboardData, pending: dashboardPending, error: dashboardError } = await useFetch('/api/analytics/dashboard')

const pending = computed(() => statsPending.value || dashboardPending.value)
const error = computed(() => statsError.value || dashboardError.value)

// Chart Data Computeds
const trendData = computed(() => {
  if (!dashboardData.value?.hourlyTrend) return null
  return {
    labels: dashboardData.value.hourlyTrend.map(d => {
      const date = new Date(d.hour)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }),
    datasets: [{
      label: 'Clicks',
      backgroundColor: '#3B82F6',
      borderColor: '#3B82F6',
      data: dashboardData.value.hourlyTrend.map(d => d.count),
      tension: 0.4
    }]
  }
})

const geoData = computed(() => {
  if (!dashboardData.value?.geoDistribution) return null
  return {
    labels: dashboardData.value.geoDistribution.map(d => d.country || 'Unknown'),
    datasets: [{
      label: 'Clicks',
      backgroundColor: '#10B981',
      data: dashboardData.value.geoDistribution.map(d => d.count)
    }]
  }
})

const deviceData = computed(() => {
  if (!dashboardData.value?.deviceDistribution) return null
  return {
    labels: dashboardData.value.deviceDistribution.map(d => d.device || 'Unknown'),
    datasets: [{
      backgroundColor: ['#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'],
      data: dashboardData.value.deviceDistribution.map(d => d.count)
    }]
  }
})

const browserData = computed(() => {
  if (!dashboardData.value?.browserDistribution) return null
  return {
    labels: dashboardData.value.browserDistribution.map(d => d.browser || 'Unknown'),
    datasets: [{
      backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      data: dashboardData.value.browserDistribution.map(d => d.count)
    }]
  }
})

// Chart Options
const lineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }
}

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }
}

const doughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
}
</script>
