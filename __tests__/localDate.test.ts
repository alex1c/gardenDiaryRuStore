/**
 * Local calendar date utilities — must not shift days via UTC ISO slicing.
 */

import {
  addDaysToLocalDate,
  isValidLocalDateString,
  parseLocalDate,
  toLocalDateString,
} from '@/src/utils/localDate';

describe('localDate', () => {
  test('toLocalDateString uses local calendar components', () => {
    // Construct explicitly at local noon to avoid DST edge ambiguity.
    const date = new Date(2026, 4, 10, 12, 0, 0, 0);
    expect(toLocalDateString(date)).toBe('2026-05-10');
  });

  test('parseLocalDate round-trips without neighbor-day shift', () => {
    const parsed = parseLocalDate('2026-05-10');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(4);
    expect(parsed.getDate()).toBe(10);
    expect(toLocalDateString(parsed)).toBe('2026-05-10');
  });

  test('rejects invalid calendar dates', () => {
    expect(isValidLocalDateString('2026-02-30')).toBe(false);
    expect(isValidLocalDateString('2027-02-29')).toBe(false);
    expect(isValidLocalDateString('2028-02-29')).toBe(true);
    expect(() => parseLocalDate('2026-02-30')).toThrow();
  });

  test('addDaysToLocalDate stays on calendar axis', () => {
    expect(addDaysToLocalDate('2026-05-10', 1)).toBe('2026-05-11');
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('naive Date.parse of date-only is NOT used as local calendar source', () => {
    // Documenting the hazard: UTC midnight parse can become previous local day.
    // Our utilities must not rely on that path.
    const hazardous = new Date('2026-05-10');
    const localSafe = parseLocalDate('2026-05-10');
    // In timezones west of UTC, hazardous may be May 9 locally.
    // We only assert our parser is stable.
    expect(toLocalDateString(localSafe)).toBe('2026-05-10');
    expect(Number.isNaN(hazardous.getTime())).toBe(false);
  });
});
