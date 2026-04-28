<template>
  <div class="utm-builder bg-white border border-gray-200 rounded p-4">
    <div class="flex justify-between items-center mb-4 border-b pb-2">
      <h3 class="text-sm font-bold text-gray-700">UTM Builder</h3>

      <!-- Template Dropdown -->
      <div class="flex items-center space-x-2">
        <select v-model="selectedTemplate" @change="applyTemplate" class="text-xs border border-gray-300 rounded p-1">
          <option :value="null">Templates...</option>
          <option v-for="t in templates" :key="t.name" :value="t.name">{{ t.name }}</option>
        </select>
        <button v-if="selectedTemplate" @click="handleDeleteTemplate" class="text-red-500 hover:text-red-700 text-xs" title="Delete Template">✕</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-700">Source <span class="text-red-500">*</span></label>
        <input
          v-model="params.source"
          @blur="formatField('source')"
          type="text"
          placeholder="e.g. google, newsletter"
          class="mt-1 w-full border border-gray-300 rounded p-2 text-sm"
          maxlength="100"
        />
        <p v-if="errors.source" class="text-red-500 text-xs mt-1">{{ errors.source }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700">Medium <span class="text-red-500">*</span></label>
        <input
          v-model="params.medium"
          @blur="formatField('medium')"
          type="text"
          placeholder="e.g. cpc, email"
          class="mt-1 w-full border border-gray-300 rounded p-2 text-sm"
          maxlength="100"
        />
        <p v-if="errors.medium" class="text-red-500 text-xs mt-1">{{ errors.medium }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700">Campaign <span class="text-red-500">*</span></label>
        <input
          v-model="params.campaign"
          @blur="formatField('campaign')"
          type="text"
          placeholder="e.g. spring_sale"
          class="mt-1 w-full border border-gray-300 rounded p-2 text-sm"
          maxlength="100"
        />
        <p v-if="errors.campaign" class="text-red-500 text-xs mt-1">{{ errors.campaign }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700">Term <span class="text-gray-400 font-normal">(Optional)</span></label>
        <input
          v-model="params.term"
          @blur="formatField('term')"
          type="text"
          placeholder="e.g. running_shoes"
          class="mt-1 w-full border border-gray-300 rounded p-2 text-sm"
          maxlength="100"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700">Content <span class="text-gray-400 font-normal">(Optional)</span></label>
        <input
          v-model="params.content"
          @blur="formatField('content')"
          type="text"
          placeholder="e.g. logolink, textlink"
          class="mt-1 w-full border border-gray-300 rounded p-2 text-sm"
          maxlength="100"
        />
      </div>
    </div>

    <!-- Save Template -->
    <div class="mt-4 flex items-center space-x-2">
      <input v-model="newTemplateName" type="text" placeholder="Template Name" class="text-xs border border-gray-300 rounded p-1" />
      <button @click="handleSaveTemplate" :disabled="!isTemplateValid" class="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50">Save as Template</button>
    </div>

    <!-- Preview -->
    <div class="mt-4 bg-gray-50 p-3 rounded border border-gray-200">
      <h4 class="text-xs font-medium text-gray-500 mb-1">Preview URL</h4>
      <div class="flex items-center justify-between">
        <code class="text-xs text-blue-600 break-all">{{ previewUrl }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: string // The destination URL
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { templates, saveTemplate, deleteTemplate } = useUtmTemplates()

// State
const params = ref({
  source: '',
  medium: '',
  campaign: '',
  term: '',
  content: ''
})

const errors = ref({
  source: '',
  medium: '',
  campaign: ''
})

const selectedTemplate = ref<string | null>(null)
const newTemplateName = ref('')

// Initialize params from the URL if they exist
const parseUrlParams = () => {
  if (!props.modelValue) return

  try {
    const url = new URL(props.modelValue)
    params.value.source = url.searchParams.get('utm_source') || ''
    params.value.medium = url.searchParams.get('utm_medium') || ''
    params.value.campaign = url.searchParams.get('utm_campaign') || ''
    params.value.term = url.searchParams.get('utm_term') || ''
    params.value.content = url.searchParams.get('utm_content') || ''
  } catch (e) {
    // Ignore invalid URL
  }
}

// Watch modelValue from parent to parse on changes (e.g. when editing a link)
watch(() => props.modelValue, (newVal, oldVal) => {
  // Only parse if the base url actually changed (not just query params updating via builder)
  try {
    const newUrl = new URL(newVal)
    const oldUrl = oldVal ? new URL(oldVal) : null
    if (!oldUrl || newUrl.origin + newUrl.pathname !== oldUrl.origin + oldUrl.pathname) {
      parseUrlParams()
    }
  } catch(e) {
    if (!oldVal) parseUrlParams()
  }
}, { immediate: true })


// Formatting
const formatField = (field: keyof typeof params.value) => {
  let val = params.value[field]
  if (!val) return

  // Replace spaces with underscores
  val = val.replace(/\s+/g, '_')

  // Remove non-alphanumeric/hyphen/underscore
  val = val.replace(/[^a-zA-Z0-9-_]/g, '')

  params.value[field] = val
  validateField(field)
}

// Validation
const validateField = (field: keyof typeof errors.value) => {
  if (!params.value[field]) {
    errors.value[field] = 'Required'
  } else {
    errors.value[field] = ''
  }
}

const isValid = computed(() => {
  return params.value.source && params.value.medium && params.value.campaign
})

const isTemplateValid = computed(() => {
  return newTemplateName.value && params.value.source && params.value.medium && params.value.campaign
})

// Template Actions
const applyTemplate = () => {
  if (!selectedTemplate.value) return
  const t = templates.value.find(t => t.name === selectedTemplate.value)
  if (t) {
    params.value = { ...t.params, term: t.params.term || '', content: t.params.content || '' }
  }
}

const handleSaveTemplate = () => {
  if (!isTemplateValid.value) return
  saveTemplate(newTemplateName.value, params.value)
  selectedTemplate.value = newTemplateName.value
  newTemplateName.value = ''
}

const handleDeleteTemplate = () => {
  if (!selectedTemplate.value) return
  deleteTemplate(selectedTemplate.value)
  selectedTemplate.value = null
}

// Preview and update
const previewUrl = computed(() => {
  if (!props.modelValue) return 'https://example.com'

  try {
    const url = new URL(props.modelValue)

    // Clear existing UTMs first to prevent duplicates
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
  } catch (e) {
    // If not a full URL yet, just return what they typed or placeholder
    return props.modelValue || 'https://example.com'
  }
})

// Automatically emit changes to parent when UTM params change (and are valid)
watch(params, () => {
  // We only emit the updated URL if the base URL is valid
  try {
    new URL(props.modelValue)
    if (previewUrl.value !== props.modelValue) {
       emit('update:modelValue', previewUrl.value)
    }
  } catch (e) {}
}, { deep: true })

</script>
