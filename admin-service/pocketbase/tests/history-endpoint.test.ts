import { describe, it, expect } from 'vitest';
import { z } from 'zod';

export const HistoryQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  perPage: z.string().regex(/^\d+$/).default('20').transform(Number),
  action: z.enum(['create', 'update', 'delete']).optional()
});

describe('History Endpoint Zod Schema Validation', () => {
  it('should use default values for empty query', () => {
    const result = HistoryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        page: 1,
        perPage: 20,
      });
    }
  });

  it('should parse valid page and perPage parameters', () => {
    const result = HistoryQuerySchema.safeParse({ page: '2', perPage: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        page: 2,
        perPage: 50,
      });
    }
  });

  it('should parse valid action parameters', () => {
    const actions = ['create', 'update', 'delete'];
    for (const action of actions) {
      const result = HistoryQuerySchema.safeParse({ action });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe(action);
      }
    }
  });

  it('should fail validation on invalid page/perPage parameters', () => {
    const resultPage = HistoryQuerySchema.safeParse({ page: 'abc' });
    expect(resultPage.success).toBe(false);

    const resultPerPage = HistoryQuerySchema.safeParse({ perPage: '-1' });
    expect(resultPerPage.success).toBe(false);
  });

  it('should fail validation on invalid action parameter', () => {
    const result = HistoryQuerySchema.safeParse({ action: 'invalid' });
    expect(result.success).toBe(false);
  });
});
