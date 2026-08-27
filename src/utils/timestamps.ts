/**
 * UTC ISO-8601 timestamp helpers for persistence and validation.
 * Calendar days must NOT be derived by slicing these strings — use localDate utils.
 */

const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Returns the current instant as an ISO-8601 UTC string (always ends with Z). */
export function nowIsoUtc(): string {
  return new Date().toISOString();
}

/** Asserts that value is a parseable ISO-8601 timestamp string. */
export function assertIsoTimestamp(value: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected non-empty ISO timestamp string, got: ${String(value)}`);
  }

  if (!ISO_TIMESTAMP_REGEX.test(value) && Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ISO-8601 timestamp: ${value}`);
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Unparseable ISO-8601 timestamp: ${value}`);
  }
}
