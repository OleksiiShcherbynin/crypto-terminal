const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

/**
 * Parses a user-typed decimal: a comma counts as the decimal point, surrounding spaces are
 * ignored. Anything else (empty input, exponents, signs, several separators) yields NaN.
 */
export function parseDecimal(input: string): number {
  const s = input.trim().replace(',', '.');
  return DECIMAL.test(s) ? Number(s) : Number.NaN;
}
