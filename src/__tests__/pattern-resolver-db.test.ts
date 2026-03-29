// Mock @neondatabase/serverless so db.ts loads cleanly
jest.mock('@neondatabase/serverless', () => {
  const mockFn = jest.fn();
  return {
    neon: jest.fn(() => mockFn),
    __mockSql: mockFn,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSql: mockSql } = require('@neondatabase/serverless') as {
  __mockSql: jest.Mock;
};

import { resolvePatternId } from '@/lib/pattern-resolver';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolvePatternId', () => {
  const WEEK = '2026-03-23';

  it('returns the explicit assignment when one exists for the week', async () => {
    mockSql.mockResolvedValueOnce([{ pattern_id: 'pattern-abc' }]); // explicit match
    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-abc');
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('falls through to rotation when no explicit assignment exists', async () => {
    mockSql
      .mockResolvedValueOnce([]) // no explicit assignment
      .mockResolvedValueOnce([  // active rotation
        {
          pattern_ids: JSON.stringify(['pattern-A', 'pattern-B']),
          start_date: '2026-03-16', // week 0
        },
      ]);

    // WEEK = 2026-03-23 is 1 week after start → index 1 → pattern-B
    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-B');
  });

  it('returns pattern-A for week 0 of a rotation', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          pattern_ids: JSON.stringify(['pattern-A', 'pattern-B']),
          start_date: '2026-03-23', // same week as query
        },
      ]);

    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-A');
  });

  it('wraps around for weeks beyond the rotation length', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          pattern_ids: JSON.stringify(['pattern-A', 'pattern-B']),
          start_date: '2026-03-09', // 2 weeks before WEEK → weeksDiff=2 → index 0
        },
      ]);

    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-A');
  });

  it('falls through to first pattern when rotation has invalid JSON', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pattern_ids: 'NOT_VALID_JSON', start_date: '2026-01-01' }])
      .mockResolvedValueOnce([{ id: 'pattern-fallback' }]); // first pattern

    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-fallback');
  });

  it('falls through to first pattern when rotation has empty pattern list', async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pattern_ids: '[]', start_date: '2026-01-01' }])
      .mockResolvedValueOnce([{ id: 'pattern-fallback' }]);

    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-fallback');
  });

  it('falls through to first pattern when no rotation is active', async () => {
    mockSql
      .mockResolvedValueOnce([]) // no explicit assignment
      .mockResolvedValueOnce([]) // no active rotation
      .mockResolvedValueOnce([{ id: 'pattern-only' }]); // first pattern

    const result = await resolvePatternId(WEEK);
    expect(result).toBe('pattern-only');
  });

  it('returns null when no patterns exist at all', async () => {
    mockSql
      .mockResolvedValueOnce([]) // no explicit
      .mockResolvedValueOnce([]) // no rotation
      .mockResolvedValueOnce([]); // no patterns

    const result = await resolvePatternId(WEEK);
    expect(result).toBeNull();
  });
});
