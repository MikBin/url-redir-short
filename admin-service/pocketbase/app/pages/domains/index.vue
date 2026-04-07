<template>
  <div class="max-w-6xl mx-auto mt-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Domains</h1>
      <NuxtLink to="/domains/new" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Add New Domain
      </NuxtLink>
    </div>

    <!-- Filter / Search -->
    <div class="mb-6">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search domains..."
        class="w-full md:w-1/3 border border-gray-300 rounded-md shadow-sm p-2"
      />
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="text-center py-8 text-gray-500">
      Loading domains...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded mb-6">
      Error loading domains: {{ error.message }}
    </div>

    <!-- Domains Table -->
    <div v-else class="bg-white rounded shadow overflow-x-auto">
      <table class="min-w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200">
            <th class="p-4 font-semibold text-gray-700">Name</th>
            <th class="p-4 font-semibold text-gray-700">Status</th>
            <th class="p-4 font-semibold text-gray-700">Created</th>
            <th class="p-4 font-semibold text-gray-700 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredDomains.length === 0" class="border-b border-gray-200">
            <td colspan="4" class="p-4 text-center text-gray-500">
              No domains found.
            </td>
          </tr>
          <tr
            v-for="domain in filteredDomains"
            :key="domain.id"
            class="border-b border-gray-200 hover:bg-gray-50"
          >
            <td class="p-4 text-gray-800 font-medium">{{ domain.name }}</td>
            <td class="p-4">
              <span
                :class="[
                  'px-2 py-1 text-xs rounded-full font-semibold',
                  domain.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                ]"
              >
                {{ domain.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="p-4 text-gray-600">{{ new Date(domain.created).toLocaleDateString() }}</td>
            <td class="p-4 text-right space-x-2">
              <NuxtLink :to="`/domains/${domain.id}`" class="text-blue-600 hover:text-blue-800 hover:underline">Edit</NuxtLink>
              <button @click="deleteDomain(domain.id)" class="text-red-600 hover:text-red-800 hover:underline">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchQuery = ref('')

// Fetch domains data
const { data: domains, pending, error, refresh } = await useFetch('/api/domains')

// Filter domains by name
const filteredDomains = computed(() => {
  if (!domains.value) return []
  const query = searchQuery.value.toLowerCase()
  return (domains.value as any[]).filter(d => d.name.toLowerCase().includes(query))
})

const deleteDomain = async (id: string) => {
  if (!confirm('Are you sure you want to delete this domain?')) {
    return
  }

  try {
    await $fetch(`/api/domains/${id}`, {
      method: 'DELETE'
    })
    // Refresh the list after successful deletion
    refresh()
  } catch (err: any) {
    alert('Failed to delete domain: ' + (err.data?.statusMessage || err.message))
  }
}
</script>
