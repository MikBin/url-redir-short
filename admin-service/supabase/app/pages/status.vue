<template>
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">System Status</h1>
      <button @click="refresh" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
    </div>

    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> {{ error }}</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <!-- Health Status -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">Health</h3>
        <p class="text-2xl font-bold mt-2" :class="health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'">
            {{ health?.status || 'Loading...' }}
        </p>
        <p class="text-sm text-gray-500 mt-1">Uptime: {{ formatUptime(health?.uptime) }}</p>
      </div>

      <!-- Database Status -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">Database</h3>
         <p class="text-2xl font-bold mt-2" :class="health?.checks?.database?.status === 'healthy' ? 'text-green-600' : 'text-red-600'">
            {{ health?.checks?.database?.status || 'Unknown' }}
        </p>
        <p class="text-sm text-gray-500 mt-1">Latency: {{ health?.checks?.database?.latencyMs }}ms</p>
      </div>

      <!-- Memory Usage -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">Memory (Heap)</h3>
        <p class="text-2xl font-bold mt-2 text-indigo-600">
            {{ formatBytes(metrics?.memory?.heapUsed) }}
        </p>
         <p class="text-sm text-gray-500 mt-1">Total: {{ formatBytes(metrics?.memory?.heapTotal) }}</p>
      </div>

      <!-- Total Requests -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">Total Requests</h3>
        <p class="text-2xl font-bold mt-2 text-purple-600">
            {{ metrics?.requests?.total || 0 }}
        </p>
        <p class="text-sm text-gray-500 mt-1">Errors: {{ metrics?.requests?.errors || 0 }}</p>
      </div>
    </div>

    <div class="mt-4">
        <NuxtLink to="/" class="text-indigo-600 hover:text-indigo-800">← Back to Dashboard</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const health = ref<any>(null)
const metrics = ref<any>(null)
const error = ref<string | null>(null)

const refresh = async () => {
  error.value = null
  try {
    const [h, m] = await Promise.all([
      $fetch('/api/health'),
      $fetch('/api/metrics')
    ])
    health.value = h
    metrics.value = m
  } catch (e: any) {
    console.error('Failed to fetch status', e)
    error.value = e.message || 'Failed to load system status. The API endpoints might be unavailable.'
  }
}

const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatUptime = (seconds: number) => {
    if (!seconds) return '-'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h}h ${m}m ${s}s`
}

onMounted(() => {
    refresh()
})
</script>
