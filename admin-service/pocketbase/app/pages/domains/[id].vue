<template>
  <div class="max-w-xl mx-auto mt-8">
    <div v-if="pending" class="text-center py-8 text-gray-500">
      Loading domain details...
    </div>

    <div v-else-if="fetchError" class="bg-red-50 text-red-600 p-4 rounded mb-6">
      Error loading domain: {{ fetchError.message }}
      <div class="mt-4">
        <NuxtLink to="/domains" class="text-blue-600 hover:underline">Return to Domains</NuxtLink>
      </div>
    </div>

    <div v-else-if="domain" class="bg-white p-8 rounded shadow-md w-full">
      <h1 class="text-2xl font-bold mb-6 text-gray-800">Edit Domain</h1>

      <form @submit.prevent="handleUpdate" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700">Domain Name</label>
          <input
            v-model="name"
            type="text"
            required
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div class="flex items-center">
          <input
            v-model="isActive"
            type="checkbox"
            id="isActive"
            class="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label for="isActive" class="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>

        <div v-if="actionError" class="text-sm text-red-600">
          {{ actionError }}
        </div>

        <div class="flex justify-between pt-4 border-t border-gray-200 mt-6">
          <button
            type="button"
            @click="handleDelete"
            :disabled="actionLoading"
            class="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
          >
            Delete Domain
          </button>

          <div class="space-x-4">
            <NuxtLink
              to="/domains"
              class="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors inline-block"
            >
              Cancel
            </NuxtLink>
            <button
              type="submit"
              :disabled="actionLoading"
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {{ actionLoading ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'

const route = useRoute()
const router = useRouter()
const domainId = route.params.id as string

const name = ref('')
const isActive = ref(true)

const actionLoading = ref(false)
const actionError = ref('')

// Fetch domain data
const { data: domain, pending, error: fetchError } = await useFetch(`/api/domains/${domainId}`)

// Initialize form when data is loaded
watch(domain, (newVal) => {
  if (newVal) {
    const d = newVal as any
    name.value = d.name
    isActive.value = d.is_active
  }
}, { immediate: true })

const handleUpdate = async () => {
  actionLoading.value = true
  actionError.value = ''

  try {
    await $fetch(`/api/domains/${domainId}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        is_active: isActive.value
      }
    })

    // Redirect back to domains list on success
    router.push('/domains')
  } catch (err: any) {
    actionError.value = err.data?.statusMessage || err.message || 'Failed to update domain'
  } finally {
    actionLoading.value = false
  }
}

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this domain?')) {
    return
  }

  actionLoading.value = true
  actionError.value = ''

  try {
    await $fetch(`/api/domains/${domainId}`, {
      method: 'DELETE'
    })

    router.push('/domains')
  } catch (err: any) {
    actionError.value = err.data?.statusMessage || err.message || 'Failed to delete domain'
    actionLoading.value = false
  }
}
</script>
