/**
 * Client-side date utilities that use local timezone (not UTC).
 *
 * IMPORTANT: Do NOT use `new Date().toISOString().slice(0, 10)` for date strings
 * on the client — that returns the UTC date, which is wrong after ~6 PM in US timezones.
 * Use these helpers instead.
 */

/** Today's date as YYYY-MM-DD in the user's local timezone */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** Yesterday's date as YYYY-MM-DD in the user's local timezone */
export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

/** Format a Date as YYYY-MM-DD in the user's local timezone */
export function localDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
