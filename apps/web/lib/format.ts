/**
 * Formatting utilities for the Massage Tulum web app.
 *
 * formatMxnPrice — renders integer pesos as a localized currency string.
 * formatDurationMinutes — renders integer minutes as a human-readable string.
 *
 * Ref: docs/architecture/CU-869d29f21-service-catalog.md §10d, §10e
 */

/**
 * Formats an integer peso amount as a localized MXN currency string.
 *
 * - es-MX locale → "$1,200" (symbol display)
 * - en-US locale → "MX$1,200" (symbol display disambiguates from USD)
 *
 * Uses currencyDisplay: 'symbol' (default) for Safari <14.1 compatibility.
 * Do NOT use 'narrowSymbol' — confirmed Safari compat issue per arch doc §10d.
 *
 * @param amount  Integer pesos (whole numbers only; stored as integer in DB)
 * @param locale  Locale string, e.g. 'es' or 'en'
 */
export function formatMxnPrice(amount: number, locale: string): string {
  const localeTag = locale === 'es' ? 'es-MX' : 'en-US';
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats integer minutes as a human-readable duration string.
 *
 * Rules:
 *   - < 60 min → "{n} min"            e.g. 45 → "45 min"
 *   - ≥ 60 and divisible by 60 → "{h} hr"    e.g. 60 → "1 hr", 120 → "2 hr"
 *   - ≥ 60 and not divisible by 60 → "{h} hr {m} min"  e.g. 90 → "1 hr 30 min"
 *
 * The "hr" / "min" abbreviations are locale-independent per design §10e.
 *
 * @param minutes  Positive integer minutes
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} hr`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} hr ${m} min`;
  }
  return `${minutes} min`;
}
