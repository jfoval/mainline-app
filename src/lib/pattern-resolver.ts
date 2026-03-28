import sql from '@/lib/db';

/** Get the Monday of a given week as "YYYY-MM-DD" */
export function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Resolve which pattern applies for a given week.
 *  Priority: explicit assignment → active rotation → first pattern by sort_order */
export async function resolvePatternId(weekStart: string): Promise<string | null> {
  // 1. Explicit assignment
  const explicit = await sql`SELECT pattern_id FROM week_schedule WHERE week_start = ${weekStart}`;
  if (explicit.length > 0) return explicit[0].pattern_id as string;

  // 2. Active rotation
  const rotationRows = await sql`SELECT * FROM week_pattern_rotation WHERE is_active = 1 LIMIT 1`;
  if (rotationRows.length > 0) {
    const rotation = rotationRows[0] as { pattern_ids: string; start_date: string };
    try {
      const patternIds = JSON.parse(rotation.pattern_ids) as string[];
      if (patternIds.length > 0) {
        const startDate = new Date(rotation.start_date + 'T12:00:00');
        const weekDate = new Date(weekStart + 'T12:00:00');
        const weeksDiff = Math.round((weekDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const index = ((weeksDiff % patternIds.length) + patternIds.length) % patternIds.length;
        return patternIds[index];
      }
    } catch { /* invalid JSON */ }
  }

  // 3. First pattern
  const firstPattern = await sql`SELECT id FROM week_patterns ORDER BY sort_order, name LIMIT 1`;
  return firstPattern.length > 0 ? firstPattern[0].id as string : null;
}
