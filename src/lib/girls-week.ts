/**
 * Auto-calculates whether a given date falls in a "girls week."
 *
 * Reference point: the week of Monday March 16, 2026 is a NON-girls week.
 * Weeks alternate from there — odd weeks from reference = girls week.
 * Works indefinitely into the past and future.
 */

// Reference: March 16, 2026 is a Monday, non-girls week.
// Use noon to avoid any DST edge cases when computing day differences.
const REF_YEAR = 2026;
const REF_MONTH = 2; // March (0-indexed)
const REF_DAY = 16;

export function isGirlsWeek(date: Date = new Date()): boolean {
  // Find the Monday of the given date's week
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // offset to get to Monday
  d.setDate(d.getDate() + diff);

  // Reference Monday at noon
  const ref = new Date(REF_YEAR, REF_MONTH, REF_DAY, 12, 0, 0);

  // Count days between the two Mondays, then divide by 7
  const daysDiff = Math.round((d.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
  const weeksDiff = daysDiff / 7;

  // Even weeks from reference = non-girls week, odd = girls week
  return weeksDiff % 2 !== 0;
}
