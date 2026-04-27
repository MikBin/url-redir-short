<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">System Status</h1>
      <button
        @click="refresh"
        :disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
      <strong class="font-bold">Error loading status: </strong>
      <span class="block sm:inline">{{ error }}</span>
    </div>

    <div v-else-if="loading && !health && !metrics" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-500">Loading system status...</p>
    </div>

    <template v-else>
      <!-- Summary Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Health Card -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Health</dt>
            <dd class="mt-1 flex items-baseline justify-between">
              <span
                class="text-2xl font-semibold capitalize"
                :class="health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'"
              >
                {{ health?.status || 'Unknown' }}
              </span>
            </dd>
            <div class="mt-4 text-sm text-gray-500">
              Uptime: {{ formatUptime(health?.uptime || 0) }}
            </div>
          </div>
        </div>

        <!-- Database Card -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Database</dt>
            <dd class="mt-1 flex items-baseline justify-between">
              <span
                class="text-2xl font-semibold capitalize"
                :class="health?.checks?.database?.status === 'healthy' ? 'text-green-600' : (health?.checks?.database?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600')"
              >
                {{ health?.checks?.database?.status || 'Unknown' }}
              </span>
            </dd>
            <div class="mt-4 text-sm text-gray-500">
              Latency: {{ health?.checks?.database?.latencyMs !== undefined ? `${health.checks.database.latencyMs} ms` : 'N/A' }}
            </div>
          </div>
        </div>

        <!-- Memory Card -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Memory (Heap)</dt>
            <dd class="mt-1 text-2xl font-semibold text-gray-900">
              {{ metrics?.memory?.heapUsed ? formatBytes(metrics.memory.heapUsed) : '0 B' }}
            </dd>
            <div class="mt-4 text-sm text-gray-500">
              Total Heap: {{ metrics?.memory?.heapTotal ? formatBytes(metrics.memory.heapTotal) : '0 B' }}
            </div>
          </div>
        </div>

        <!-- Requests Card -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <dt class="text-sm font-medium text-gray-500 truncate">Total Requests</dt>
            <dd class="mt-1 text-2xl font-semibold text-gray-900">
              {{ metrics?.requests?.total || 0 }}
            </dd>
            <div class="mt-4 text-sm text-gray-500">
              Errors: <span :class="metrics?.requests?.errors > 0 ? 'text-red-600' : ''">{{ metrics?.requests?.errors || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="pt-4">
      <NuxtLink to="/" class="text-blue-600 hover:underline">← Back to Dashboard</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pbAuth = useCookie('pb_auth')

// Ensure user is authenticated
if (!pbAuth.value) {
  router.push('/login')
}

const health = ref<any>(null)
const metrics = ref<any>(null)
const loading = ref(false)
const error = ref('')

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    const [healthRes, metricsRes] = await Promise.all([
      $fetch('/api/health'),
      $fetch('/api/metrics')
    ])
    health.value = healthRes
    metrics.value = metricsRes
  } catch (err: any) {
    console.error('Error fetching system status:', err)
    error.value = err.message || 'Failed to load system status'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (pbAuth.value) {
    refresh()
  }
})

// Helpers
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || h > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)

  return parts.join(' ')
}
</script>
