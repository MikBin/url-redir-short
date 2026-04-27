<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { templates, saveTemplate, deleteTemplate } = useUtmTemplates()

const params = ref<UtmParams>({
  source: '',
  medium: '',
  campaign: '',
  term: '',
  content: ''
})

const errors = ref({
  source: false,
  medium: false,
  campaign: false
})

const templateName = ref('')
const selectedTemplate = ref('')

const parseUrlParams = () => {
  try {
    const url = new URL(props.modelValue)
    params.value.source = url.searchParams.get('utm_source') || ''
    params.value.medium = url.searchParams.get('utm_medium') || ''
    params.value.campaign = url.searchParams.get('utm_campaign') || ''
    params.value.term = url.searchParams.get('utm_term') || ''
    params.value.content = url.searchParams.get('utm_content') || ''
  } catch {
    // Invalid URL, do nothing
  }
}

const formatField = (field: keyof UtmParams) => {
  let val = params.value[field] || ''
  val = val.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\-_]/g, '')
  params.value[field] = val
  if (['source', 'medium', 'campaign'].includes(field)) {
    validateField(field as 'source' | 'medium' | 'campaign')
  }
}

const validateField = (field: 'source' | 'medium' | 'campaign') => {
  errors.value[field] = !params.value[field]
}

const isFormValid = computed(() => {
  return params.value.source && params.value.medium && params.value.campaign
})

const previewUrl = computed(() => {
  try {
    const url = new URL(props.modelValue)
    // Clear existing
    url.searchParams.delete('utm_source')
    url.searchParams.delete('utm_medium')
    url.searchParams.delete('utm_campaign')
    url.searchParams.delete('utm_term')
    url.searchParams.delete('utm_content')

    if (params.value.source) url.searchParams.set('utm_source', params.value.source)
    if (params.value.medium) url.searchParams.set('utm_medium', params.value.medium)
    if (params.value.campaign) url.searchParams.set('utm_campaign', params.value.campaign)
    if (params.value.term) url.searchParams.set('utm_term', params.value.term)
    if (params.value.content) url.searchParams.set('utm_content', params.value.content)

    return url.toString()
  } catch {
    return props.modelValue
  }
})

// Watch params deep to update URL
watch(params, () => {
  if (previewUrl.value !== props.modelValue) {
    try {
      new URL(props.modelValue) // Ensure base URL is valid
      emit('update:modelValue', previewUrl.value)
    } catch {
      // Base URL not valid, skip emitting
    }
  }
}, { deep: true })

// Watch modelValue to re-parse when base URL changes
watch(() => props.modelValue, (newVal, oldVal) => {
  if (newVal === previewUrl.value) return // Ignore updates that come from our own emitting
  try {
    const newUrl = new URL(newVal)
    const oldUrl = oldVal ? new URL(oldVal) : null

    // Only re-parse if the base origin/pathname changed
    if (!oldUrl || newUrl.origin !== oldUrl.origin || newUrl.pathname !== oldUrl.pathname) {
      parseUrlParams()
    }
  } catch {
    // ignore
  }
})

const applyTemplate = () => {
  if (!selectedTemplate.value) return
  const t = templates.value.find(x => x.name === selectedTemplate.value)
  if (t) {
    params.value = { ...t.params }
    errors.value = { source: false, medium: false, campaign: false }
  }
}

const handleSaveTemplate = () => {
  if (!isFormValid.value || !templateName.value.trim()) return
  saveTemplate(templateName.value.trim(), { ...params.value })
  selectedTemplate.value = templateName.value.trim()
  templateName.value = ''
}

const handleDeleteTemplate = () => {
  if (!selectedTemplate.value) return
  deleteTemplate(selectedTemplate.value)
  selectedTemplate.value = ''
}

onMounted(() => {
  parseUrlParams()
})
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h3 class="text-lg font-medium text-gray-900">UTM Builder</h3>

      <div v-if="templates.length > 0" class="flex items-center gap-2">
        <select
          v-model="selectedTemplate"
          @change="applyTemplate"
          class="block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Load template...</option>
          <option v-for="t in templates" :key="t.name" :value="t.name">
            {{ t.name }}
          </option>
        </select>
        <button
          v-if="selectedTemplate"
          @click="handleDeleteTemplate"
          type="button"
          class="inline-flex items-center p-1.5 border border-transparent rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          title="Delete Template"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="utm_source" class="block text-sm font-medium text-gray-700">
          Source <span class="text-red-500">*</span>
        </label>
        <div class="mt-1">
          <input
            type="text"
            id="utm_source"
            v-model="params.source"
            @blur="formatField('source')"
            maxlength="100"
            placeholder="google, newsletter, etc."
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-300': errors.source }"
          />
          <p v-if="errors.source" class="mt-1 text-sm text-red-600">Source is required</p>
        </div>
      </div>

      <div>
        <label for="utm_medium" class="block text-sm font-medium text-gray-700">
          Medium <span class="text-red-500">*</span>
        </label>
        <div class="mt-1">
          <input
            type="text"
            id="utm_medium"
            v-model="params.medium"
            @blur="formatField('medium')"
            maxlength="100"
            placeholder="cpc, email, etc."
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-300': errors.medium }"
          />
          <p v-if="errors.medium" class="mt-1 text-sm text-red-600">Medium is required</p>
        </div>
      </div>

      <div>
        <label for="utm_campaign" class="block text-sm font-medium text-gray-700">
          Campaign <span class="text-red-500">*</span>
        </label>
        <div class="mt-1">
          <input
            type="text"
            id="utm_campaign"
            v-model="params.campaign"
            @blur="formatField('campaign')"
            maxlength="100"
            placeholder="spring_sale, etc."
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-300': errors.campaign }"
          />
          <p v-if="errors.campaign" class="mt-1 text-sm text-red-600">Campaign is required</p>
        </div>
      </div>

      <div>
        <label for="utm_term" class="block text-sm font-medium text-gray-700">
          Term <span class="text-gray-400 text-xs font-normal">(optional)</span>
        </label>
        <div class="mt-1">
          <input
            type="text"
            id="utm_term"
            v-model="params.term"
            @blur="formatField('term')"
            maxlength="100"
            placeholder="running_shoes"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div class="sm:col-span-2">
        <label for="utm_content" class="block text-sm font-medium text-gray-700">
          Content <span class="text-gray-400 text-xs font-normal">(optional)</span>
        </label>
        <div class="mt-1">
          <input
            type="text"
            id="utm_content"
            v-model="params.content"
            @blur="formatField('content')"
            maxlength="100"
            placeholder="logolink, textlink"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </div>

    <div class="pt-4 border-t border-gray-200">
      <label class="block text-sm font-medium text-gray-700 mb-2">Save Template</label>
      <div class="flex gap-2">
        <input
          type="text"
          v-model="templateName"
          placeholder="Template Name"
          class="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <button
          type="button"
          @click="handleSaveTemplate"
          :disabled="!isFormValid || !templateName.trim()"
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>

    <div class="pt-4 border-t border-gray-200">
      <label class="block text-sm font-medium text-gray-700 mb-2">Preview URL</label>
      <div class="bg-gray-50 rounded-md p-3 break-all">
        <code class="text-sm text-gray-800">{{ previewUrl }}</code>
      </div>
    </div>
  </div>
</template>
