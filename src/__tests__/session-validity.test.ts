// Mock @neondatabase/serverless so db.ts loads cleanly and all sql calls
// go through our mock, regardless of the import path used.
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

import { checkSessionValidity, clearSessionCache } from '@/lib/session-validity';

beforeEach(() => {
  jest.clearAllMocks();
  clearSessionCache();
});

describe('checkSessionValidity', () => {
  it('returns true when iat equals jwt_issued_after', async () => {
    mockSql.mockResolvedValueOnce([{ value: '1000' }]);
    expect(await checkSessionValidity(1000)).toBe(true);
  });

  it('returns true when iat is after jwt_issued_after', async () => {
    mockSql.mockResolvedValueOnce([{ value: '1000' }]);
    expect(await checkSessionValidity(1500)).toBe(true);
  });

  it('returns false when iat is before jwt_issued_after (stale token)', async () => {
    mockSql.mockResolvedValueOnce([{ value: '2000' }]);
    expect(await checkSessionValidity(1000)).toBe(false);
  });

  it('returns true when no jwt_issued_after row exists (no restriction)', async () => {
    mockSql.mockResolvedValueOnce([]); // no rows
    expect(await checkSessionValidity(0)).toBe(true);
  });

  it('returns true when jwt_issued_after value is empty string', async () => {
    mockSql.mockResolvedValueOnce([{ value: '' }]);
    expect(await checkSessionValidity(0)).toBe(true);
  });

  it('returns true when the DB throws (fail open — allow token)', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB unavailable'));
    expect(await checkSessionValidity(999)).toBe(true);
  });

  it('uses the cached value and does not query DB a second time within TTL', async () => {
    mockSql.mockResolvedValueOnce([{ value: '1000' }]);

    await checkSessionValidity(1500); // populates cache
    await checkSessionValidity(1500); // should use cache

    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('re-queries DB after cache is cleared', async () => {
    mockSql
      .mockResolvedValueOnce([{ value: '1000' }])
      .mockResolvedValueOnce([{ value: '2000' }]);

    expect(await checkSessionValidity(1500)).toBe(true);  // issued_after=1000
    clearSessionCache();
    expect(await checkSessionValidity(1500)).toBe(false); // issued_after=2000

    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

describe('clearSessionCache', () => {
  it('forces a fresh DB read on the next call', async () => {
    mockSql
      .mockResolvedValueOnce([{ value: '500' }])
      .mockResolvedValueOnce([{ value: '500' }]);

    await checkSessionValidity(1000);
    clearSessionCache();
    await checkSessionValidity(1000);

    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});
