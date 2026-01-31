import { describe, it, expect } from 'vitest'
import { checkTarget, TargetingRule, PreviewContext } from '../app/utils/targeting'

describe('checkTarget', () => {
  it('should match country correctly', () => {
    const rule: TargetingRule = { id: '1', target: 'country', value: 'US', destination: 'https://us.com' }

    expect(checkTarget(rule, { country: 'US' })).toBe(true)

    // Case insensitive
    expect(checkTarget(rule, { country: 'us' })).toBe(true)

    // Mismatch
    expect(checkTarget(rule, { country: 'CA' })).toBe(false)
  })

  it('should match language correctly', () => {
    const rule: TargetingRule = { id: '2', target: 'language', value: 'en', destination: 'https://en.com' }
    expect(checkTarget(rule, { language: 'en-US' })).toBe(true)
    expect(checkTarget(rule, { language: 'en-GB' })).toBe(true)
    expect(checkTarget(rule, { language: 'fr-FR' })).toBe(false)
  })

  it('should match device correctly', () => {
    const ruleMobile: TargetingRule = { id: '3', target: 'device', value: 'mobile', destination: 'https://m.com' }
    expect(checkTarget(ruleMobile, { deviceType: 'mobile' })).toBe(true)
    expect(checkTarget(ruleMobile, { deviceType: 'desktop' })).toBe(false)

    const ruleIOS: TargetingRule = { id: '4', target: 'device', value: 'ios', destination: 'https://ios.com' }
    expect(checkTarget(ruleIOS, { os: 'iOS' })).toBe(true)
    expect(checkTarget(ruleIOS, { os: 'Android' })).toBe(false)

    const ruleDesktop: TargetingRule = { id: '5', target: 'device', value: 'desktop', destination: 'https://d.com' }
    expect(checkTarget(ruleDesktop, { deviceType: 'desktop' })).toBe(true)
    expect(checkTarget(ruleDesktop, { deviceType: 'mobile' })).toBe(false)

    // Overlap: iPhone is mobile and iOS
    // checkTarget only checks one rule against context.
    // Logic for precedence happens in the caller (looping through rules).
    expect(checkTarget(ruleMobile, { deviceType: 'mobile', os: 'iOS' })).toBe(true)
    expect(checkTarget(ruleIOS, { deviceType: 'mobile', os: 'iOS' })).toBe(true)
  })
})
