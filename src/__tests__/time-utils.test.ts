import { formatTime, timeToMinutes, TIME_OPTIONS } from '@/lib/time-utils';

describe('formatTime', () => {
  it('converts midnight (00:00) to 12:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('converts 12:00 (noon) to 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('converts a morning hour with minutes', () => {
    expect(formatTime('09:30')).toBe('9:30 AM');
  });

  it('converts a single-digit hour without leading zero', () => {
    expect(formatTime('07:15')).toBe('7:15 AM');
  });

  it('converts 13:00 to 1:00 PM', () => {
    expect(formatTime('13:00')).toBe('1:00 PM');
  });

  it('converts 23:45 to 11:45 PM', () => {
    expect(formatTime('23:45')).toBe('11:45 PM');
  });

  it('pads single-digit minutes with a leading zero', () => {
    expect(formatTime('08:05')).toBe('8:05 AM');
  });

  it('converts 12:30 (afternoon) to 12:30 PM', () => {
    expect(formatTime('12:30')).toBe('12:30 PM');
  });
});

describe('timeToMinutes', () => {
  it('converts 00:00 to 0 minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 01:00 to 60 minutes', () => {
    expect(timeToMinutes('01:00')).toBe(60);
  });

  it('converts 01:30 to 90 minutes', () => {
    expect(timeToMinutes('01:30')).toBe(90);
  });

  it('converts 12:00 to 720 minutes', () => {
    expect(timeToMinutes('12:00')).toBe(720);
  });

  it('converts 23:59 to 1439 minutes', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('TIME_OPTIONS', () => {
  it('contains 96 entries (24 hours × 4 slots)', () => {
    expect(TIME_OPTIONS).toHaveLength(96);
  });

  it('starts at 00:00', () => {
    expect(TIME_OPTIONS[0]).toBe('00:00');
  });

  it('ends at 23:45', () => {
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1]).toBe('23:45');
  });

  it('includes 15-minute increments (00:00, 00:15, 00:30, 00:45)', () => {
    expect(TIME_OPTIONS.slice(0, 4)).toEqual(['00:00', '00:15', '00:30', '00:45']);
  });
});
