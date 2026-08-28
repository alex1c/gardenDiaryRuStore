/**
 * Flexible decimal parsing for future form fields (3,4 and 3.4).
 */

import { finalizeNumber, finalizePositiveNumber, parseFlexibleNumber } from '@/src/utils/numeric';
import { kopecksToRubles, rublesToKopecks } from '@/src/utils/money';

describe('numeric', () => {
  test('parses comma and dot decimals', () => {
    expect(parseFlexibleNumber('3,4')).toBeCloseTo(3.4);
    expect(parseFlexibleNumber('3.4')).toBeCloseTo(3.4);
  });

  test('incomplete drafts return null', () => {
    expect(parseFlexibleNumber('')).toBeNull();
    expect(parseFlexibleNumber('1,')).toBeNull();
    expect(parseFlexibleNumber('.')).toBeNull();
  });

  test('finalizeNumber rejects incomplete input', () => {
    expect(finalizeNumber('')).toBeNull();
    expect(() => finalizeNumber('1,')).toThrow();
    expect(finalizeNumber('2.5')).toBeCloseTo(2.5);
  });
});

describe('positive numeric finalize', () => {
  test('accepts positive values and rejects zero/negative', () => {
    expect(finalizePositiveNumber('3,5')).toBeCloseTo(3.5);
    expect(() => finalizePositiveNumber('0')).toThrow(/greater than zero/i);
    expect(() => finalizePositiveNumber('-2')).toThrow();
  });
});

describe('money kopecks', () => {
  test('round-trips rubles through integer kopecks', () => {
    expect(rublesToKopecks(123.45)).toBe(12345);
    expect(kopecksToRubles(12345)).toBeCloseTo(123.45);
  });

  test('rejects non-finite and non-integer storage values', () => {
    expect(() => rublesToKopecks(Infinity)).toThrow();
    expect(() => rublesToKopecks(-1)).toThrow();
    expect(() => kopecksToRubles(1.5)).toThrow();
  });
});
