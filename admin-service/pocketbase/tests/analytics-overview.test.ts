import { describe, it, expect } from 'vitest';
import { aggregateLinkClicks } from '../server/utils/analytics';

describe('Analytics Overview Aggregation', () => {
  it('should correctly aggregate click counts by link_id', () => {
    const records = [
      { link_id: 'a', click_count: 10 },
      { link_id: 'a', click_count: 5 },
      { link_id: 'b', click_count: 3 }
    ];

    const result = aggregateLinkClicks(records);

    expect(result).toEqual({
      a: 15,
      b: 3
    });
  });

  it('should return an empty object for an empty array', () => {
    const records: { link_id: string; click_count: number }[] = [];

    const result = aggregateLinkClicks(records);

    expect(result).toEqual({});
  });

  it('should handle zero click counts correctly', () => {
    const records = [
      { link_id: 'c', click_count: 0 },
      { link_id: 'c', click_count: 0 }
    ];

    const result = aggregateLinkClicks(records);

    expect(result).toEqual({
      c: 0
    });
  });
});
