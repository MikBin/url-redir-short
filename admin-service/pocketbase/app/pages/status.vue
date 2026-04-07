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
      <!-- PocketBase Connection Status -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">PocketBase Connection</h3>
        <p class="text-2xl font-bold mt-2" :class="dbStatus === 'Healthy' ? 'text-green-600' : 'text-red-600'">
            {{ dbStatus }}
        </p>
        <p class="text-sm text-gray-500 mt-1">Status of API endpoint</p>
      </div>

      <!-- Sync Stream Status -->
      <div class="bg-white p-4 rounded shadow">
        <h3 class="text-lg font-semibold text-gray-700">Sync Stream (SSE)</h3>
         <p class="text-2xl font-bold mt-2" :class="streamStatus === 'Online' ? 'text-green-600' : 'text-yellow-600'">
            {{ streamStatus }}
        </p>
        <p class="text-sm text-gray-500 mt-1">Requires SYNC_API_KEY</p>
      </div>
    </div>

    <div class="mt-4">
        <NuxtLink to="/" class="text-indigo-600 hover:text-indigo-800">← Back to Dashboard</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const dbStatus = ref<string>('Loading...')
const streamStatus = ref<string>('Loading...')
const error = ref<string | null>(null)

const refresh = async () => {
  error.value = null
  dbStatus.value = 'Loading...'
  streamStatus.value = 'Loading...'

  try {
    // Check Database Health
    await $fetch('/api/links', { query: { perPage: 1 } })
    dbStatus.value = 'Healthy'
  } catch (e: any) {
    dbStatus.value = 'Error'
    error.value = 'PocketBase connection failed.'
  }

  try {
    // Check Stream Health
    // Even a 401 means the endpoint is reachable
    await $fetch('/api/sync/stream')
    streamStatus.value = 'Online'
  } catch (e: any) {
    if (e.statusCode === 401) {
      streamStatus.value = 'Online' // Expecting 401 because we are missing SYNC_API_KEY
    } else {
      streamStatus.value = 'Error'
      if (!error.value) error.value = 'Sync Stream endpoint failed.'
    }
  }
}

onMounted(() => {
    refresh()
})
</script>
