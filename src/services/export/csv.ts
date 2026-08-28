/**
 * CSV escaping and serialization for Russian Excel compatibility.
 */

const SEPARATOR = ';';
const BOM = '\uFEFF';

/** Escapes one CSV field (RFC-style quoting for semicolon-separated output). */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  // Prevent spreadsheet applications from evaluating user-authored text as a
  // formula. Numeric values arrive as numbers and are intentionally unchanged.
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (
    text.includes('"') ||
    text.includes(SEPARATOR) ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds one CSV row from values. */
export function buildCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((value) => escapeCsvField(value)).join(SEPARATOR);
}

/** Prefixes UTF-8 BOM so Excel opens Cyrillic correctly. */
export function withUtf8Bom(content: string): string {
  return `${BOM}${content}`;
}

/** Formats kopecks as rubles with decimal comma for human CSV export. */
export function formatRublesForCsv(kopecks: number): string {
  const rubles = kopecks / 100;
  return rubles.toFixed(2).replace('.', ',');
}

export { SEPARATOR as CSV_SEPARATOR };
