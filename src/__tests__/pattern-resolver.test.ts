import { getMonday } from '@/lib/pattern-resolver';

// resolvePatternId requires a live DB — covered by getMonday (pure) here,
// and the DB-dependent path is tested via the mock-sql tests in session-validity.

describe('getMonday', () => {
  it('returns the same Monday when given a Monday', () => {
    // 2026-03-23 is a Monday
    const monday = new Date('2026-03-23T12:00:00');
    expect(getMonday(monday)).toBe('2026-03-23');
  });

  it('returns the previous Monday when given a Wednesday', () => {
    // 2026-03-25 is a Wednesday → Monday should be 2026-03-23
    const wednesday = new Date('2026-03-25T12:00:00');
    expect(getMonday(wednesday)).toBe('2026-03-23');
  });

  it('returns the previous Monday when given a Sunday', () => {
    // 2026-03-29 is a Sunday → Monday should be 2026-03-23
    const sunday = new Date('2026-03-29T12:00:00');
    expect(getMonday(sunday)).toBe('2026-03-23');
  });

  it('returns the previous Monday when given a Saturday', () => {
    // 2026-03-28 is a Saturday → Monday should be 2026-03-23
    const saturday = new Date('2026-03-28T12:00:00');
    expect(getMonday(saturday)).toBe('2026-03-23');
  });

  it('returns the previous Monday when given a Friday', () => {
    // 2026-03-27 is a Friday → Monday should be 2026-03-23
    const friday = new Date('2026-03-27T12:00:00');
    expect(getMonday(friday)).toBe('2026-03-23');
  });

  it('pads month and day with leading zeros', () => {
    // 2026-01-06 is a Tuesday → Monday should be 2026-01-05
    const tuesday = new Date('2026-01-06T12:00:00');
    expect(getMonday(tuesday)).toBe('2026-01-05');
  });

  it('handles year rollover correctly', () => {
    // 2026-01-01 is a Thursday → Monday should be 2025-12-29
    const thursday = new Date('2026-01-01T12:00:00');
    expect(getMonday(thursday)).toBe('2025-12-29');
  });

  it('does not mutate the input Date object', () => {
    const date = new Date('2026-03-25T12:00:00');
    const originalTime = date.getTime();
    getMonday(date);
    expect(date.getTime()).toBe(originalTime);
  });
});
