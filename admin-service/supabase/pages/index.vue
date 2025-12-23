<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Dashboard</h1>

    <!-- Create Link Form -->
    <div class="bg-white p-6 rounded shadow mb-8">
      <h2 class="text-xl font-semibold mb-4">Create New Link</h2>
      <form @submit.prevent="createLink" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-700">Slug</label>
          <input v-model="newLink.slug" type="text" placeholder="e.g. twitter" class="mt-1 w-full border border-gray-300 rounded p-2" required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Destination</label>
          <input v-model="newLink.destination" type="url" placeholder="https://..." class="mt-1 w-full border border-gray-300 rounded p-2" required />
        </div>
        <button type="submit" class="bg-green-600 text-white p-2 rounded hover:bg-green-700">Create</button>
      </form>
    </div>

    <!-- Link List -->
    <div class="bg-white rounded shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="link in links" :key="link.id">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">/{{ link.slug }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{{ link.destination }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button @click="deleteLink(link.id)" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
          </tr>
          <tr v-if="links.length === 0">
            <td colspan="3" class="px-6 py-4 text-center text-gray-500">No links found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const links = ref<any[]>([])
const newLink = ref({ slug: '', destination: '' })

// Fetch Links
const fetchLinks = async () => {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching links:', error)
  } else {
    links.value = data || []
  }
}

// Create Link
const createLink = async () => {
  if (!user.value) return

  const { data, error } = await supabase
    .from('links')
    .insert({
      slug: newLink.value.slug,
      destination: newLink.value.destination,
      owner_id: user.value.id
    })
    .select()

  if (error) {
    alert('Error creating link: ' + error.message)
  } else {
    // Reset form and refresh list
    newLink.value = { slug: '', destination: '' }
    fetchLinks() // Or manually push to list
  }
}

// Delete Link
const deleteLink = async (id: string) => {
  if (!confirm('Are you sure?')) return

  const { error } = await supabase
    .from('links')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Error deleting link: ' + error.message)
  } else {
    fetchLinks() // Or manually remove from list
  }
}

// Initial Fetch
onMounted(() => {
  if (user.value) {
    fetchLinks()
  }
})

// Realtime subscription for UI updates (optional but good)
// For now, we rely on manual refresh or post-action fetch
</script>
