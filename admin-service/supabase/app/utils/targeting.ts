
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
  if (rule.target === 'language') {
    if (!context.language) return false
    // Case-insensitive match for language prefix
    return context.language.toLowerCase().startsWith(rule.value.toLowerCase())
  }

  if (rule.target === 'country') {
    if (!context.country) return false
    return context.country.toLowerCase() === rule.value.toLowerCase()
  }

  if (rule.target === 'device') {
    const target = rule.value.toLowerCase()

    if (target === 'mobile') {
      return context.deviceType === 'mobile'
    }
    if (target === 'tablet') {
      return context.deviceType === 'tablet'
    }
    if (target === 'desktop') {
      return context.deviceType === 'desktop'
    }
    if (target === 'ios') {
      return context.os === 'iOS'
    }
    if (target === 'android') {
      return context.os === 'Android'
    }
  }

  return false
}
