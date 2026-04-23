export interface TargetingRule {
  id: string
  target: 'language' | 'device' | 'country'
  value: string
  destination: string
}

export interface PreviewContext {
  country?: string
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  os?: 'iOS' | 'Android' | 'other'
  language?: string
}

export function checkTarget(rule: TargetingRule, context: PreviewContext): boolean {
  switch (rule.target) {
    case 'language':
      if (!context.language) return false
      return context.language.toLowerCase().startsWith(rule.value.toLowerCase())
    case 'country':
      if (!context.country) return false
      return context.country.toLowerCase() === rule.value.toLowerCase()
    case 'device': {
      const val = rule.value.toLowerCase()
      if (val === 'mobile') return context.deviceType === 'mobile'
      if (val === 'tablet') return context.deviceType === 'tablet'
      if (val === 'desktop') return context.deviceType === 'desktop'
      if (val === 'ios') return context.os === 'iOS'
      if (val === 'android') return context.os === 'Android'
      return false
    }
    default:
      return false
  }
}
