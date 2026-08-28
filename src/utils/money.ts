/**
 * Money helpers — store RUB as integer kopecks to avoid float errors.
 * 1 RUB = 100 kopecks. Display conversion is UI concern.
 */

import { finalizePositiveNumber, parseFlexibleNumber } from '@/src/utils/numeric';

/**
 * Converts a major-unit amount (rubles) to integer kopecks.
 * Uses round-to-nearest to absorb binary float noise (e.g. 1.005).
 */
export function rublesToKopecks(rubles: number): number {
  if (!Number.isFinite(rubles) || rubles < 0) {
    throw new Error(`rublesToKopecks: invalid amount ${rubles}`);
  }
  const kopecks = Math.round((rubles + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(kopecks)) {
    throw new Error(`rublesToKopecks: amount exceeds safe integer range ${rubles}`);
  }
  return kopecks;
}

/** Converts integer kopecks back to rubles (number; format in UI). */
export function kopecksToRubles(kopecks: number): number {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) {
    throw new Error(`kopecksToRubles expects integer kopecks, got ${kopecks}`);
  }
  return kopecks / 100;
}

/**
 * Parses a draft money string ("123,45" / "123.45") into kopecks.
 * Incomplete drafts return null; invalid complete input throws.
 */
export function parseMoneyDraftToKopecks(
  draft: string,
  parseNumber: (input: string) => number | null = parseFlexibleNumber
): number | null {
  const rubles = parseNumber(draft);
  if (rubles === null) {
    return null;
  }
  return rublesToKopecks(rubles);
}

/**
 * Finalizes a positive money draft into integer kopecks (> 0).
 * Empty input throws; zero/negative throws.
 */
export function finalizePositiveMoneyDraft(draft: string): number {
  const rubles = finalizePositiveNumber(draft);
  if (rubles === null) {
    throw new Error('Money amount is required');
  }
  const kopecks = rublesToKopecks(rubles);
  if (kopecks <= 0) {
    throw new Error('Money amount must be greater than zero');
  }
  return kopecks;
}

/** Formats integer kopecks for Russian UI, e.g. "1 200 ₽" or "890,50 ₽". */
export function formatKopecksForDisplay(kopecks: number): string {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) {
    throw new Error(`formatKopecksForDisplay: invalid kopecks ${kopecks}`);
  }

  const wholeRubles = Math.floor(kopecks / 100);
  const remainder = kopecks % 100;
  const rublesPart = formatRublesWithThinSpaces(wholeRubles);

  if (remainder === 0) {
    return `${rublesPart} ₽`;
  }

  const kopText = String(remainder).padStart(2, '0');
  return `${rublesPart},${kopText} ₽`;
}

/** Inserts thin spaces between thousands groups. */
function formatRublesWithThinSpaces(rubles: number): string {
  const text = String(rubles);
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}
