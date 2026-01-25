<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Dashboard</h1>

    <!-- Create/Edit Link Form -->
    <div class="bg-white p-6 rounded shadow mb-8">
      <h2 class="text-xl font-semibold mb-4">{{ isEditing ? 'Edit Link' : 'Create New Link' }}</h2>
      <form @submit.prevent="saveLink" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Slug</label>
            <input v-model="newLink.slug" type="text" placeholder="e.g. twitter" class="mt-1 w-full border border-gray-300 rounded p-2" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Destination</label>
            <input v-model="newLink.destination" type="url" placeholder="https://..." class="mt-1 w-full border border-gray-300 rounded p-2" required />
          </div>
        </div>

        <!-- Expiration Section -->
        <div class="border-t pt-4">
          <h3 class="text-lg font-medium mb-3">Expiration</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Expires At</label>
              <input v-model="newLink.expires_at" type="datetime-local" class="mt-1 w-full border border-gray-300 rounded p-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Max Clicks</label>
              <input v-model.number="newLink.max_clicks" type="number" placeholder="e.g. 100" class="mt-1 w-full border border-gray-300 rounded p-2" />
            </div>
          </div>
        </div>

        <!-- Security Section -->
        <div class="border-t pt-4">
          <h3 class="text-lg font-medium mb-3">Security</h3>

          <!-- Password Protection -->
          <div class="mb-4">
            <div class="flex items-center">
               <input v-model="newLink.password_protection.enabled" id="pwd-enabled" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
               <label for="pwd-enabled" class="ml-2 block text-sm font-medium text-gray-700">Enable Password Protection</label>
            </div>
            <div v-if="newLink.password_protection.enabled" class="mt-2">
               <label class="block text-sm font-medium text-gray-700">Password</label>
               <input v-model="newLink.password_protection.password" type="password" class="mt-1 w-full border border-gray-300 rounded p-2" placeholder="Secret Password" />
            </div>
          </div>

          <!-- HSTS -->
          <div>
            <div class="flex items-center">
               <input v-model="newLink.hsts.enabled" id="hsts-enabled" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
               <label for="hsts-enabled" class="ml-2 block text-sm font-medium text-gray-700">Enable HSTS</label>
            </div>
            <div v-if="newLink.hsts.enabled" class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                  <label class="block text-sm font-medium text-gray-700">Max Age (seconds)</label>
                  <input v-model.number="newLink.hsts.maxAge" type="number" class="mt-1 w-full border border-gray-300 rounded p-2" />
               </div>
               <div class="flex items-center mt-6">
                  <input v-model="newLink.hsts.includeSubDomains" id="hsts-sub" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
                  <label for="hsts-sub" class="ml-2 block text-sm font-medium text-gray-700">Include SubDomains</label>
               </div>
               <div class="flex items-center mt-6">
                  <input v-model="newLink.hsts.preload" id="hsts-preload" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
                  <label for="hsts-preload" class="ml-2 block text-sm font-medium text-gray-700">Preload</label>
               </div>
            </div>
          </div>
        </div>

        <!-- Targeting Section -->
        <div class="border-t pt-4">
          <h3 class="text-lg font-medium mb-3">Targeting</h3>
          <div class="flex items-center mb-4">
             <input v-model="newLink.targeting.enabled" id="targeting-enabled" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
             <label for="targeting-enabled" class="ml-2 block text-sm font-medium text-gray-700">Enable Targeting</label>
          </div>
          <div v-if="newLink.targeting.enabled">
            <div v-for="(rule, index) in newLink.targeting.rules" :key="rule.id" class="flex flex-col md:flex-row gap-2 mb-2 items-end border p-2 rounded bg-gray-50">
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-500">Target</label>
                <select v-model="rule.target" class="mt-1 w-full border border-gray-300 rounded p-2 text-sm">
                  <option value="country">Country</option>
                  <option value="device">Device</option>
                  <option value="language">Language</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-500">Value</label>
                <input v-model="rule.value" type="text" placeholder="e.g. US, mobile, en" class="mt-1 w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <div class="flex-[2]">
                <label class="block text-xs font-medium text-gray-500">Destination</label>
                <input v-model="rule.destination" type="url" placeholder="https://..." class="mt-1 w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <button type="button" @click="removeTargetingRule(index)" class="text-red-600 hover:text-red-900 p-2">Remove</button>
            </div>
            <button type="button" @click="addTargetingRule" class="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Rule</button>
          </div>
        </div>

        <!-- A/B Testing Section -->
        <div class="border-t pt-4">
          <h3 class="text-lg font-medium mb-3">A/B Testing</h3>
          <div class="flex items-center mb-4">
             <input v-model="newLink.ab_testing.enabled" id="ab-enabled" type="checkbox" class="h-4 w-4 text-green-600 border-gray-300 rounded" />
             <label for="ab-enabled" class="ml-2 block text-sm font-medium text-gray-700">Enable A/B Testing</label>
          </div>
          <div v-if="newLink.ab_testing.enabled">
            <div v-for="(variation, index) in newLink.ab_testing.variations" :key="variation.id" class="flex flex-col md:flex-row gap-2 mb-2 items-end border p-2 rounded bg-gray-50">
              <div class="flex-[3]">
                <label class="block text-xs font-medium text-gray-500">Destination</label>
                <input v-model="variation.destination" type="url" placeholder="https://..." class="mt-1 w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-500">Weight (0-100)</label>
                <input v-model.number="variation.weight" type="number" class="mt-1 w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <button type="button" @click="removeABVariation(index)" class="text-red-600 hover:text-red-900 p-2">Remove</button>
            </div>
            <button type="button" @click="addABVariation" class="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Variation</button>
          </div>
        </div>

        <div class="flex gap-2">
            <button type="submit" class="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex-1">{{ isEditing ? 'Update' : 'Create' }}</button>
            <button v-if="isEditing" @click="cancelEdit" type="button" class="bg-gray-500 text-white p-2 rounded hover:bg-gray-600">Cancel</button>
        </div>
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
              <button @click="editLink(link)" class="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
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

// Types
interface TargetingRule {
  id: string
  target: 'language' | 'device' | 'country'
  value: string
  destination: string
}

interface ABVariation {
  id: string
  destination: string
  weight: number
}

interface LinkState {
  slug: string
  destination: string
  expires_at: string | null
  max_clicks: number | null
  password_protection: {
    enabled: boolean
    password: string
  }
  hsts: {
    enabled: boolean
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
  }
  targeting: {
    enabled: boolean
    rules: TargetingRule[]
  }
  ab_testing: {
    enabled: boolean
    variations: ABVariation[]
  }
}

const links = ref<any[]>([])
const isEditing = ref(false)
const currentLinkId = ref<string | null>(null)

const defaultLinkState: LinkState = {
  slug: '',
  destination: '',
  expires_at: null,
  max_clicks: null,
  password_protection: {
    enabled: false,
    password: ''
  },
  hsts: {
    enabled: false,
    maxAge: 31536000,
    includeSubDomains: true,
    preload: false
  },
  targeting: {
    enabled: false,
    rules: []
  },
  ab_testing: {
    enabled: false,
    variations: []
  }
}

const newLink = ref<LinkState>(JSON.parse(JSON.stringify(defaultLinkState)))

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

// Save Link (Create or Update)
const saveLink = async () => {
  if (isEditing.value) {
    await updateLink()
  } else {
    await createLink()
  }
}

// Create Link
const createLink = async () => {
  if (!user.value) return

  const payload = {
    slug: newLink.value.slug,
    destination: newLink.value.destination,
    owner_id: user.value.id,
    expires_at: newLink.value.expires_at ? new Date(newLink.value.expires_at).toISOString() : null,
    max_clicks: newLink.value.max_clicks,
    password_protection: newLink.value.password_protection,
    hsts: newLink.value.hsts,
    targeting: newLink.value.targeting,
    ab_testing: newLink.value.ab_testing
  }

  const { data, error } = await supabase
    .from('links')
    .insert(payload)
    .select()

  if (error) {
    alert('Error creating link: ' + error.message)
  } else {
    // Reset form and refresh list
    newLink.value = JSON.parse(JSON.stringify(defaultLinkState))
    fetchLinks()
  }
}

// Update Link
const updateLink = async () => {
  if (!user.value || !currentLinkId.value) return

  const payload = {
    slug: newLink.value.slug,
    destination: newLink.value.destination,
    expires_at: newLink.value.expires_at ? new Date(newLink.value.expires_at).toISOString() : null,
    max_clicks: newLink.value.max_clicks,
    password_protection: newLink.value.password_protection,
    hsts: newLink.value.hsts,
    targeting: newLink.value.targeting,
    ab_testing: newLink.value.ab_testing,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('links')
    .update(payload)
    .eq('id', currentLinkId.value)

  if (error) {
    alert('Error updating link: ' + error.message)
  } else {
    cancelEdit()
    fetchLinks()
  }
}

// Helper to format date for datetime-local input
const formatDateForInput = (isoString: string | null) => {
  if (!isoString) return null
  const date = new Date(isoString)
  const offset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offset)
  return localDate.toISOString().slice(0, 16)
}

// Edit Link
const editLink = (link: any) => {
  newLink.value = {
    slug: link.slug,
    destination: link.destination,
    expires_at: formatDateForInput(link.expires_at),
    max_clicks: link.max_clicks,
    password_protection: link.password_protection || JSON.parse(JSON.stringify(defaultLinkState.password_protection)),
    hsts: link.hsts || JSON.parse(JSON.stringify(defaultLinkState.hsts)),
    targeting: link.targeting || JSON.parse(JSON.stringify(defaultLinkState.targeting)),
    ab_testing: link.ab_testing || JSON.parse(JSON.stringify(defaultLinkState.ab_testing))
  }

  // Ensure rules/variations arrays exist
  if (!newLink.value.targeting.rules) newLink.value.targeting.rules = []
  if (!newLink.value.ab_testing.variations) newLink.value.ab_testing.variations = []

  currentLinkId.value = link.id
  isEditing.value = true

  window.scrollTo({ top: 0, behavior: 'smooth' })
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

const cancelEdit = () => {
  isEditing.value = false
  currentLinkId.value = null
  newLink.value = JSON.parse(JSON.stringify(defaultLinkState))
}

const addTargetingRule = () => {
  newLink.value.targeting.rules.push({
    id: Date.now().toString() + Math.random().toString().slice(2),
    target: 'country',
    value: '',
    destination: ''
  })
}

const removeTargetingRule = (index: number) => {
  newLink.value.targeting.rules.splice(index, 1)
}

const addABVariation = () => {
  newLink.value.ab_testing.variations.push({
    id: Date.now().toString() + Math.random().toString().slice(2),
    destination: '',
    weight: 50
  })
}

const removeABVariation = (index: number) => {
  newLink.value.ab_testing.variations.splice(index, 1)
}

// Initial Fetch
onMounted(() => {
  if (user.value) {
    fetchLinks()
  }
})
</script>
