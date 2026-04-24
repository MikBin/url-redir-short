import { describe, it, expect } from 'vitest';
import { validateBulkLinks } from '../server/utils/bulk';

describe('validateBulkLinks', () => {
  it('should throw an error if input is not an array', () => {
    expect(() => validateBulkLinks({} as any)).toThrow('Input must be an array of links');
    expect(() => validateBulkLinks('not an array' as any)).toThrow('Input must be an array of links');
    expect(() => validateBulkLinks(null as any)).toThrow('Input must be an array of links');
  });

  it('should return empty arrays for an empty input array', () => {
    const result = validateBulkLinks([]);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('should correctly separate valid and invalid links', () => {
    const input = [
      { slug: 'valid-slug', destination: 'https://example.com' },
      { slug: '  trimmed-slug  ', destination: '  https://trimmed.com  ' },
      { slug: '', destination: 'https://example.com' },
      { slug: 'invalid-dest', destination: '' },
      { slug: 123, destination: 'https://example.com' },
      { destination: 'https://example.com' },
      { slug: 'missing-dest' },
      null,
      'not an object',
    ];

    const result = validateBulkLinks(input);

    expect(result.valid).toHaveLength(2);
    expect(result.valid).toEqual([
      { slug: 'valid-slug', destination: 'https://example.com' },
      { slug: 'trimmed-slug', destination: 'https://trimmed.com' },
    ]);

    expect(result.invalid).toHaveLength(7);
  });

  it('should trim slug and destination in valid links', () => {
    const input = [
      { slug: '   test-slug   ', destination: '   https://test.com   ', otherProp: 'keep me' }
    ];

    const result = validateBulkLinks(input);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].slug).toBe('test-slug');
    expect(result.valid[0].destination).toBe('https://test.com');
    expect(result.valid[0].otherProp).toBe('keep me');
  });
});
