<template>
  <div class="max-w-xl mx-auto mt-8">
    <div class="bg-white p-8 rounded shadow-md w-full">
      <h1 class="text-2xl font-bold mb-6 text-gray-800">Add New Domain</h1>

      <form @submit.prevent="handleCreate" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700">Domain Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="e.g., example.com"
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

        <div v-if="errorMsg" class="text-sm text-red-600">
          {{ errorMsg }}
        </div>

        <div class="flex justify-end space-x-4 pt-4">
          <NuxtLink
            to="/domains"
            class="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            :disabled="loading"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ loading ? 'Creating...' : 'Create Domain' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const router = useRouter()

const name = ref('')
const isActive = ref(true)
const loading = ref(false)
const errorMsg = ref('')

const handleCreate = async () => {
  loading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/domains', {
      method: 'POST',
      body: {
        name: name.value,
        is_active: isActive.value
      }
    })

    // Redirect back to domains list on success
    router.push('/domains')
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || 'Failed to create domain'
  } finally {
    loading.value = false
  }
}
</script>
