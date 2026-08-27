/**
 * Flexible numeric parsing for form fields (quantity, dimensions, etc.).
 * Supports comma and dot as decimal separators.
 * Incomplete intermediate states return null so TextInput stays editable.
 */

/**
 * Parses a user-typed number that may use "," or "." as decimal separator.
 * Returns null for incomplete editable states; throws for complete-but-invalid input.
 */
export function parseFlexibleNumber(input: string): number | null {
  if (typeof input !== 'string') {
    throw new Error('parseFlexibleNumber expects a string');
  }

  const trimmed = input.trim();

  if (
    trimmed === '' ||
    trimmed === ',' ||
    trimmed === '.' ||
    trimmed === '-' ||
    trimmed === '-,' ||
    trimmed === '-.' ||
    /^-?\d+[.,]$/.test(trimmed)
  ) {
    return null;
  }

  const normalized = trimmed.replace(',', '.');

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    if (/^-?\d+[.,]\d*[.,]?$/.test(trimmed) || /^-?[.,]\d*$/.test(trimmed)) {
      return null;
    }
    throw new Error(`Invalid number: ${input}`);
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number: ${input}`);
  }

  return value;
}

/**
 * Finalizes a number on blur / submit.
 * Empty → null; incomplete non-empty → throws; complete → finite number.
 */
export function finalizeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }

  const parsed = parseFlexibleNumber(trimmed);
  if (parsed === null) {
    throw new Error(`Cannot finalize incomplete number: ${input}`);
  }
  return parsed;
}
