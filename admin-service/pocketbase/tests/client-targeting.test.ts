import { describe, it, expect } from 'vitest'
import { checkTarget, TargetingRule, PreviewContext } from '../app/utils/targeting'

describe('Client Targeting Utility', () => {
  describe('Language Targeting', () => {
    it('should return true for exact language match', () => {
      const rule: TargetingRule = { id: '1', target: 'language', value: 'en', destination: '/en' }
      const context: PreviewContext = { language: 'en' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return true for prefix language match', () => {
      const rule: TargetingRule = { id: '1', target: 'language', value: 'en', destination: '/en' }
      const context: PreviewContext = { language: 'en-US' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should be case-insensitive', () => {
      const rule: TargetingRule = { id: '1', target: 'language', value: 'EN', destination: '/en' }
      const context: PreviewContext = { language: 'en-GB' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return false if language is missing in context', () => {
      const rule: TargetingRule = { id: '1', target: 'language', value: 'en', destination: '/en' }
      const context: PreviewContext = {}
      expect(checkTarget(rule, context)).toBe(false)
    })

    it('should return false for mismatching language', () => {
      const rule: TargetingRule = { id: '1', target: 'language', value: 'fr', destination: '/fr' }
      const context: PreviewContext = { language: 'en-US' }
      expect(checkTarget(rule, context)).toBe(false)
    })
  })

  describe('Country Targeting', () => {
    it('should return true for exact country match', () => {
      const rule: TargetingRule = { id: '2', target: 'country', value: 'US', destination: '/us' }
      const context: PreviewContext = { country: 'US' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should be case-insensitive', () => {
      const rule: TargetingRule = { id: '2', target: 'country', value: 'us', destination: '/us' }
      const context: PreviewContext = { country: 'US' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return false for prefix match', () => {
      const rule: TargetingRule = { id: '2', target: 'country', value: 'U', destination: '/u' }
      const context: PreviewContext = { country: 'US' }
      expect(checkTarget(rule, context)).toBe(false)
    })

    it('should return false if country is missing in context', () => {
      const rule: TargetingRule = { id: '2', target: 'country', value: 'US', destination: '/us' }
      const context: PreviewContext = {}
      expect(checkTarget(rule, context)).toBe(false)
    })

    it('should return false for mismatching country', () => {
      const rule: TargetingRule = { id: '2', target: 'country', value: 'CA', destination: '/ca' }
      const context: PreviewContext = { country: 'US' }
      expect(checkTarget(rule, context)).toBe(false)
    })
  })

  describe('Device Targeting', () => {
    it('should return true for mobile match', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'mobile', destination: '/mobile' }
      const context: PreviewContext = { deviceType: 'mobile' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return true for tablet match', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'tablet', destination: '/tablet' }
      const context: PreviewContext = { deviceType: 'tablet' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return true for desktop match', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'desktop', destination: '/desktop' }
      const context: PreviewContext = { deviceType: 'desktop' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return true for iOS match', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'ios', destination: '/ios' }
      const context: PreviewContext = { os: 'iOS' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return true for Android match', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'android', destination: '/android' }
      const context: PreviewContext = { os: 'Android' }
      expect(checkTarget(rule, context)).toBe(true)
    })

    it('should return false for unrecognized device target value', () => {
      const rule: TargetingRule = { id: '3', target: 'device', value: 'smartwatch', destination: '/watch' }
      const context: PreviewContext = { deviceType: 'mobile', os: 'iOS' }
      expect(checkTarget(rule, context)).toBe(false)
    })
  })

  describe('Unknown Target Types', () => {
    it('should return false for unknown target type', () => {
      const rule = { id: '4', target: 'unknown', value: 'val', destination: '/unknown' } as unknown as TargetingRule
      const context: PreviewContext = { language: 'en', country: 'US', deviceType: 'mobile', os: 'iOS' }
      expect(checkTarget(rule, context)).toBe(false)
    })
  })
})
