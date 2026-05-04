import { describe, it, expect, vi } from 'vitest';
import { generateAlias, generateUniqueAlias } from '../server/utils/alias-generator';

describe('Alias Generator Utility', () => {
  describe('generateAlias', () => {
    it('generates an alias with default length of 7', () => {
      const alias = generateAlias();
      expect(alias).toBeTypeOf('string');
      expect(alias.length).toBe(7);
    });

    it('generates an alias with custom length', () => {
      const alias = generateAlias(10);
      expect(alias.length).toBe(10);
    });

    it('generates an alias containing only alphanumeric characters', () => {
      const alias = generateAlias(100);
      expect(alias).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('generates different aliases on consecutive calls', () => {
      const alias1 = generateAlias();
      const alias2 = generateAlias();
      expect(alias1).not.toBe(alias2);
    });
  });

  describe('generateUniqueAlias', () => {
    it('returns the alias immediately if no collision occurs', async () => {
      const checkExists = vi.fn().mockResolvedValue(false);
      const alias = await generateUniqueAlias(checkExists);

      expect(alias).toBeTypeOf('string');
      expect(alias.length).toBe(7);
      expect(checkExists).toHaveBeenCalledTimes(1);
    });

    it('retries up to 3 times on collisions and returns the third alias', async () => {
      const checkExists = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const alias = await generateUniqueAlias(checkExists);

      expect(alias).toBeTypeOf('string');
      expect(alias.length).toBe(7);
      expect(checkExists).toHaveBeenCalledTimes(3);
    });

    it('throws an error if collision still occurs after 3 retries', async () => {
      const checkExists = vi.fn().mockResolvedValue(true);

      await expect(generateUniqueAlias(checkExists)).rejects.toThrow('Failed to generate a unique alias after 3 attempts');
      expect(checkExists).toHaveBeenCalledTimes(3);
    });
  });
});
