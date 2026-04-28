import { ref, onMounted } from 'vue'

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

export const useUtmTemplates = () => {
  const templates = ref<UtmTemplate[]>([])
  const storageKey = 'redir_utm_templates'

  const loadTemplates = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          templates.value = JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse UTM templates from localStorage')
          templates.value = []
        }
      }
    }
  }

  const saveTemplate = (name: string, params: UtmParams) => {
    // Remove if already exists to overwrite
    templates.value = templates.value.filter(t => t.name !== name)

    templates.value.push({ name, params: { ...params } })

    // Keep max 20 templates
    if (templates.value.length > 20) {
      templates.value = templates.value.slice(-20)
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(templates.value))
    }
  }

  const deleteTemplate = (name: string) => {
    templates.value = templates.value.filter(t => t.name !== name)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(templates.value))
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
