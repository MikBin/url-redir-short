<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Analytics</h1>

    <div v-if="pending" class="text-gray-500">Loading...</div>
    <div v-else-if="error" class="text-red-500">Error: {{ error.message }}</div>
    <div v-else-if="data">
      <div class="mb-4 text-lg">
        <span class="font-semibold">Total Clicks (All Time):</span> {{ data.totalClicks }}
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
            <tr v-for="event in data.events" :key="event.id">
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
const { data, pending, error } = await useFetch('/api/analytics/stats')
</script>
