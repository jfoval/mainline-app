import { compareVersions } from '@/lib/version';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
    expect(compareVersions('2.10.5', '2.10.5')).toBe(0);
  });

  it('returns 1 when first version is greater (patch)', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
  });

  it('returns -1 when first version is less (patch)', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('returns 1 when first version is greater (minor)', () => {
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
  });

  it('returns -1 when first version is less (minor)', () => {
    expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
  });

  it('returns 1 when first version is greater (major)', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('returns -1 when first version is less (major)', () => {
    expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
  });

  it('handles versions with different segment counts', () => {
    // '1.0' vs '1.0.0' — missing segment treated as 0
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.9')).toBe(1);
  });

  it('handles large version numbers', () => {
    expect(compareVersions('10.0.0', '9.99.99')).toBe(1);
    expect(compareVersions('1.0.100', '1.0.99')).toBe(1);
  });
});
