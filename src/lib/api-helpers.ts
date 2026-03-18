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

/** Consistent local timestamp for updated_at fields */
export function nowLocal(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
