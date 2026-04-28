export interface UtmParams {
  source: string
  medium: string
  campaign: string
  term?: string
  content?: string
}

export interface UtmTemplate {
  name: string
  params: UtmParams
}

import { ref, onMounted } from 'vue'

export function useUtmTemplates() {
  const templates = ref<UtmTemplate[]>([])
  const STORAGE_KEY = 'redir_utm_templates'

  const loadTemplates = () => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        templates.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load UTM templates', e)
    }
  }

  const saveTemplate = (name: string, params: UtmParams) => {
    if (typeof window === 'undefined') return

    // Remove existing template with the same name
    templates.value = templates.value.filter(t => t.name !== name)

    // Add new template
    templates.value.push({ name, params })

    // Cap at 20 templates
    if (templates.value.length > 20) {
      // remove the oldest ones to keep the length at 20 (or we could just take the last 20)
      templates.value = templates.value.slice(-20)
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.value))
    } catch (e) {
      console.error('Failed to save UTM template', e)
    }
  }

  const deleteTemplate = (name: string) => {
    if (typeof window === 'undefined') return

    templates.value = templates.value.filter(t => t.name !== name)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.value))
    } catch (e) {
      console.error('Failed to save UTM templates after deletion', e)
    }
  }

  onMounted(() => {
    loadTemplates()
  })

  return {
    templates,
    loadTemplates,
    saveTemplate,
    deleteTemplate
  }
}
