import {
  pickFields,
  buildUpdate,
  validateRequired,
  validateEnum,
  getTimezone,
  setTimezone,
} from '@/lib/api-helpers';

// Reset the timezone cache between tests
beforeEach(() => {
  setTimezone('America/Chicago');
  delete process.env.TIMEZONE;
});

describe('pickFields', () => {
  it('picks only allowed fields', () => {
    const result = pickFields({ a: 1, b: 2, c: 3 }, ['a', 'c']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('ignores fields not in the allowed list', () => {
    const result = pickFields({ secret: 'hash', name: 'Alice' }, ['name']);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('returns empty object when no allowed fields are present', () => {
    const result = pickFields({ x: 1 }, ['a', 'b']);
    expect(result).toEqual({});
  });

  it('handles empty updates object', () => {
    const result = pickFields({}, ['a', 'b']);
    expect(result).toEqual({});
  });

  it('preserves falsy values (null, 0, false, empty string)', () => {
    const result = pickFields({ a: null, b: 0, c: false, d: '' }, ['a', 'b', 'c', 'd']);
    expect(result).toEqual({ a: null, b: 0, c: false, d: '' });
  });
});

describe('buildUpdate', () => {
  it('returns null when no allowed fields are present in updates', () => {
    const result = buildUpdate({ secret: 'x' }, ['name']);
    expect(result).toBeNull();
  });

  it('returns null for empty updates', () => {
    const result = buildUpdate({}, ['name']);
    expect(result).toBeNull();
  });

  it('builds a single-field SET clause', () => {
    const result = buildUpdate({ name: 'Alice' }, ['name']);
    expect(result).not.toBeNull();
    expect(result!.fields).toBe('name = $1');
    expect(result!.values).toEqual(['Alice']);
    expect(result!.paramOffset).toBe(1);
  });

  it('builds a multi-field SET clause with sequential param indices', () => {
    const result = buildUpdate({ title: 'Test', status: 'active' }, ['title', 'status']);
    expect(result).not.toBeNull();
    expect(result!.fields).toBe('title = $1, status = $2');
    expect(result!.values).toEqual(['Test', 'active']);
    expect(result!.paramOffset).toBe(2);
  });

  it('filters out disallowed fields while building', () => {
    const result = buildUpdate({ name: 'Alice', password: 'secret' }, ['name']);
    expect(result!.fields).toBe('name = $1');
    expect(result!.values).toEqual(['Alice']);
  });
});

describe('validateRequired', () => {
  it('returns null when all required fields are present', () => {
    const result = validateRequired({ a: 'hello', b: 42 }, ['a', 'b']);
    expect(result).toBeNull();
  });

  it('returns an error message for a missing field', () => {
    const result = validateRequired({ a: 'hello' }, ['a', 'b']);
    expect(result).toContain('b');
  });

  it('returns an error for a null field', () => {
    const result = validateRequired({ a: null }, ['a']);
    expect(result).toContain('a');
  });

  it('returns an error for an empty string field', () => {
    const result = validateRequired({ a: '' }, ['a']);
    expect(result).toContain('a');
  });

  it('returns null for an empty required-fields list', () => {
    const result = validateRequired({}, []);
    expect(result).toBeNull();
  });
});

describe('validateEnum', () => {
  const allowed = ['inbox', 'active', 'someday'];

  it('returns null for a valid value', () => {
    expect(validateEnum('active', allowed, 'status')).toBeNull();
  });

  it('returns an error for an invalid value', () => {
    const result = validateEnum('unknown', allowed, 'status');
    expect(result).not.toBeNull();
    expect(result).toContain('status');
  });

  it('returns null when value is undefined (field not provided)', () => {
    expect(validateEnum(undefined, allowed, 'status')).toBeNull();
  });

  it('returns null when value is null', () => {
    expect(validateEnum(null, allowed, 'status')).toBeNull();
  });

  it('includes allowed values in the error message', () => {
    const result = validateEnum('bad', allowed, 'status');
    expect(result).toContain('inbox');
    expect(result).toContain('active');
    expect(result).toContain('someday');
  });
});

describe('getTimezone / setTimezone', () => {
  it('returns America/Chicago as default', () => {
    expect(getTimezone()).toBe('America/Chicago');
  });

  it('returns the value set by setTimezone', () => {
    setTimezone('America/New_York');
    expect(getTimezone()).toBe('America/New_York');
  });

  it('reads TIMEZONE env var when cache is cleared (falsy)', () => {
    // setTimezone('') makes the cache falsy, so the next getTimezone() call
    // falls through to read from process.env.TIMEZONE.
    process.env.TIMEZONE = 'America/Los_Angeles';
    setTimezone(''); // clear cache (empty string is falsy)
    expect(getTimezone()).toBe('America/Los_Angeles');
    delete process.env.TIMEZONE;
  });

  it('falls back to America/Chicago when no env var and cache is cleared', () => {
    delete process.env.TIMEZONE;
    setTimezone(''); // clear cache
    expect(getTimezone()).toBe('America/Chicago');
  });
});
