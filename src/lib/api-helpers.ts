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

/** Configured timezone. Defaults to America/Chicago (Central Time).
 *  Override via TIMEZONE env var or the 'timezone' setting in the database. */
let _cachedTimezone: string | null = null;

export function getTimezone(): string {
  if (_cachedTimezone) return _cachedTimezone;
  // Env var takes priority, then fall back to default
  _cachedTimezone = process.env.TIMEZONE || 'America/Chicago';
  return _cachedTimezone;
}

/** Set the timezone at runtime (called after reading from settings DB) */
export function setTimezone(tz: string): void {
  _cachedTimezone = tz;
}

/** Get current date/time parts in the configured timezone.
 *  Works correctly on Vercel where new Date() returns UTC. */
export function nowCentral() {
  const tz = getTimezone();
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  }).formatToParts(now);

  const get = (type: string) => {
    const part = parts.find(p => p.type === type);
    if (!part) throw new Error(`[nowCentral] Missing date part "${type}" for timezone "${tz}"`);
    return part.value;
  };

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour') === '24' ? '0' : get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const weekday = get('weekday');

  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(weekday);

  return {
    /** Date object set to the configured timezone calendar date at noon UTC (for date math only) */
    date: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
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
