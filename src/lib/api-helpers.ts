/**
 * Shared utilities for API route safety.
 * - Field whitelisting prevents column injection in PATCH operations
 * - Validation helpers for required fields and enum values
 * - Timestamp helper for consistent updated_at format
 * - Postgres-compatible query builder
 */

/** Pick only allowed fields from an update object */
export function pickFields(
  updates: Record<string, unknown>,
  allowed: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) result[key] = updates[key];
  }
  return result;
}

/** Build a safe UPDATE SET clause from whitelisted fields (Postgres $1, $2, ... params) */
export function buildUpdate(
  updates: Record<string, unknown>,
  allowed: string[]
): { fields: string; values: unknown[]; paramOffset: number } | null {
  const picked = pickFields(updates, allowed);
  const keys = Object.keys(picked);
  if (keys.length === 0) return null;
  return {
    fields: keys.map((k, i) => `${k} = $${i + 1}`).join(', '),
    values: Object.values(picked),
    paramOffset: keys.length,
  };
}

/** Check that required fields are present and non-empty */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return `Missing required field: ${f}`;
    }
  }
  return null;
}

/** Check that a value is one of the allowed options */
export function validateEnum(
  value: unknown,
  allowed: string[],
  fieldName: string
): string | null {
  if (value !== undefined && value !== null && !allowed.includes(value as string)) {
    return `Invalid ${fieldName}: must be one of ${allowed.join(', ')}`;
  }
  return null;
}

/** Get current date/time parts in America/Chicago (Central Time).
 *  Works correctly on Vercel where new Date() returns UTC. */
export function nowCentral() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)!.value;

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour') === '24' ? '0' : get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const weekday = get('weekday');

  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(weekday);

  return {
    /** Date object set to the Central Time calendar date at noon (safe for girls-week calc) */
    date: new Date(year, month - 1, day, 12, 0, 0),
    dayOfWeek,
    weekday,
    hour,
    minute,
    /** "HH:MM" string for routine block comparison */
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    /** "YYYY-MM-DD" string for date comparisons */
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    /** "YYYY-MM-DD HH:MM:SS" for updated_at fields */
    timestamp: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

/** Consistent local timestamp for updated_at fields */
export function nowLocal(): string {
  return nowCentral().timestamp;
}
