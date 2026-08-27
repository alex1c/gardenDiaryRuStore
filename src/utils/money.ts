/**
 * Money helpers — store RUB as integer kopecks to avoid float errors.
 * 1 RUB = 100 kopecks. Display conversion is UI concern.
 */

/**
 * Converts a major-unit amount (rubles) to integer kopecks.
 * Uses round-to-nearest to absorb binary float noise (e.g. 1.005).
 */
export function rublesToKopecks(rubles: number): number {
  if (!Number.isFinite(rubles)) {
    throw new Error(`rublesToKopecks: invalid amount ${rubles}`);
  }
  return Math.round(rubles * 100);
}

/** Converts integer kopecks back to rubles (number; format in UI). */
export function kopecksToRubles(kopecks: number): number {
  if (!Number.isInteger(kopecks)) {
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
  parseFlexibleNumber: (input: string) => number | null
): number | null {
  const rubles = parseFlexibleNumber(draft);
  if (rubles === null) {
    return null;
  }
  return rublesToKopecks(rubles);
}
