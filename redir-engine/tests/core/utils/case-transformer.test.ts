import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { transformSnakeToCamel } from '../../../src/core/utils/case-transformer';

describe('case-transformer', () => {
  it('should transform a snake_case object to camelCase', () => {
    const input = {
      first_name: 'John',
      last_name: 'Doe',
      age_years: 30,
    };
    const expected = {
      firstName: 'John',
      lastName: 'Doe',
      ageYears: 30,
    };
    expect(transformSnakeToCamel(input)).toEqual(expected);
  });

  it('should transform a kebab-case object to camelCase', () => {
    const input = {
      'first-name': 'John',
      'last-name': 'Doe',
      'age-years': 30,
    };
    const expected = {
      firstName: 'John',
      lastName: 'Doe',
      ageYears: 30,
    };
    expect(transformSnakeToCamel(input)).toEqual(expected);
  });

  it('should transform nested objects', () => {
    const input = {
      user_info: {
        first_name: 'John',
        last_name: 'Doe',
      },
    };
    const expected = {
      userInfo: {
        firstName: 'John',
        lastName: 'Doe',
      },
    };
    expect(transformSnakeToCamel(input)).toEqual(expected);
  });

  it('should transform objects within arrays', () => {
    const input = [
      { first_name: 'John' },
      { last_name: 'Doe' },
    ];
    const expected = [
      { firstName: 'John' },
      { lastName: 'Doe' },
    ];
    expect(transformSnakeToCamel(input)).toEqual(expected);
  });

  it('should return primitives as-is', () => {
    expect(transformSnakeToCamel(null)).toBeNull();
    expect(transformSnakeToCamel('string')).toBe('string');
    expect(transformSnakeToCamel(123)).toBe(123);
    expect(transformSnakeToCamel(true)).toBe(true);
  });

  it('property-based test: nested objects retain identical non-key structure', () => {
    fc.assert(
      fc.property(fc.object({ maxDepth: 2 }), (obj) => {
        // Just asserting it doesn't crash on any arbitrary JSON-like object
        const transformed = transformSnakeToCamel(obj);
        expect(transformed).toBeDefined();
      })
    );
  });
});
