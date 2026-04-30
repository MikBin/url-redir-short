<template>
  <div class="audit-log-container">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-medium text-gray-900">Link History</h3>
      <div class="flex space-x-2">
        <button
          v-for="filter in ['All', 'create', 'update', 'delete']"
          :key="filter"
          @click="currentFilter = filter === 'All' ? null : filter"
          :class="[
            'px-3 py-1 text-xs font-medium rounded-full border',
            currentFilter === (filter === 'All' ? null : filter)
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          ]"
        >
          {{ filter === 'All' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1) }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="py-8 text-center text-gray-500">
      Loading history...
    </div>

    <div v-else-if="error" class="p-4 bg-red-50 text-red-600 rounded">
      Failed to load history: {{ error.message }}
    </div>

    <div v-else-if="entries.length === 0" class="py-8 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded">
      No history recorded yet.
    </div>

    <div v-else class="space-y-6">
      <div class="flow-root">
        <ul role="list" class="-mb-8">
          <li v-for="(entry, entryIdx) in entries" :key="entry.id">
            <div class="relative pb-8">
              <span v-if="entryIdx !== entries.length - 1" class="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
              <div class="relative flex space-x-3">
                <div>
                  <span :class="[
                    'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                    getActionColor(entry.action)
                  ]">
                    <span class="text-white text-xs font-bold">{{ entry.action.charAt(0).toUpperCase() }}</span>
                  </span>
                </div>
                <div class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p class="text-sm text-gray-500">
                      Action: <span class="font-medium text-gray-900">{{ entry.action.toUpperCase() }}</span>
                    </p>

                    <!-- Diff View for Updates -->
                    <div v-if="entry.action === 'update' && entry.changes" class="mt-2 bg-gray-50 rounded p-3 text-sm">
                      <div v-for="(change, field) in entry.changes" :key="field" class="mb-2 last:mb-0">
                        <span class="font-mono text-xs font-semibold text-gray-700">{{ field }}:</span>
                        <div class="mt-1 flex flex-col sm:flex-row sm:items-center text-xs">
                          <span class="text-red-600 line-through mr-2">{{ formatValue(change.before) }}</span>
                          <span class="hidden sm:inline text-gray-400 mr-2">→</span>
                          <span class="text-green-600 underline">{{ formatValue(change.after) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Snapshot for Create/Delete -->
                    <div v-else-if="entry.changes" class="mt-2">
                       <details class="text-xs">
                         <summary class="cursor-pointer text-blue-600 hover:text-blue-800">View Details</summary>
                         <pre class="mt-2 bg-gray-50 p-2 rounded overflow-x-auto text-gray-600 border border-gray-200">{{ JSON.stringify(entry.changes, null, 2) }}</pre>
                       </details>
                    </div>

                  </div>
                  <div class="whitespace-nowrap text-right text-sm text-gray-500">
                    <time :datetime="entry.createdAt">{{ formatDate(entry.createdAt) }}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between border-t border-gray-200 pt-4" v-if="totalPages > 1">
        <button
          @click="page > 1 && (page--)"
          :disabled="page === 1"
          class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-sm text-gray-700">Page {{ page }} of {{ totalPages }}</span>
        <button
          @click="page < totalPages && (page++)"
          :disabled="page === totalPages"
          class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  linkId: string
}>()

const page = ref(1)
const perPage = ref(10)
const currentFilter = ref<string | null>(null)

const { data, pending, error, refresh } = await useFetch<any>(() => `/api/links/${props.linkId}/history`, {
  query: {
    page,
    perPage,
    action: currentFilter
  },
  watch: [page, perPage, currentFilter]
})

const entries = computed(() => data.value?.entries || [])
const total = computed(() => data.value?.total || 0)
const totalPages = computed(() => Math.ceil(total.value / perPage.value))

const getActionColor = (action: string) => {
  switch (action) {
    case 'create': return 'bg-green-500'
    case 'update': return 'bg-yellow-500'
    case 'delete': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

const formatDate = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleString()
}

const formatValue = (val: any) => {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// Reset page when filter changes
watch(currentFilter, () => {
  page.value = 1
})
</script>
