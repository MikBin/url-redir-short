import { describe, it, expect, vi } from 'vitest'
import { generateAlias, generateUniqueAlias } from '../server/utils/alias-generator'

describe('alias-generator', () => {
  describe('generateAlias', () => {
    it('generates an alias of default length 7', () => {
      const alias = generateAlias()
      expect(alias).toHaveLength(7)
    })

    it('generates an alias of specified length', () => {
      const alias = generateAlias(10)
      expect(alias).toHaveLength(10)
    })

    it('generates only allowed characters', () => {
      const alias = generateAlias(100)
      expect(/^[a-zA-Z0-9]+$/.test(alias)).toBe(true)
    })
  })

  describe('generateUniqueAlias', () => {
    it('returns first generated alias if it does not exist', async () => {
      const checkExists = vi.fn().mockResolvedValue(false)
      const alias = await generateUniqueAlias(checkExists)
      expect(alias).toHaveLength(7)
      expect(checkExists).toHaveBeenCalledTimes(1)
    })

    it('retries when there is a collision and returns the next unique alias', async () => {
      const checkExists = vi.fn()
        .mockResolvedValueOnce(true) // 1st collision
        .mockResolvedValueOnce(false) // 2nd unique

      const alias = await generateUniqueAlias(checkExists)
      expect(alias).toHaveLength(7)
      expect(checkExists).toHaveBeenCalledTimes(2)
    })

    it('throws error after 3 retries (4 total attempts)', async () => {
      const checkExists = vi.fn().mockResolvedValue(true)

      await expect(generateUniqueAlias(checkExists)).rejects.toThrow('Failed to generate a unique alias after maximum retries')
      expect(checkExists).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    })
  })
})
