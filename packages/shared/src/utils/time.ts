/**
 * Time utility helpers shared between apps/api and apps/web.
 *
 * See: docs/adr/0012-business-hours-time-storage.md
 */

/**
 * Trims a Postgres TIME string from "HH:MM:SS" to "HH:MM".
 *
 * Postgres returns TIME WITHOUT TIME ZONE columns as "HH:MM:SS" (always
 * including seconds). The API contract uses "HH:MM" for display. This helper
 * normalises both formats to the short form.
 *
 * @param time - Postgres TIME value, e.g. "09:00:00" or "09:00"
 * @returns     Trimmed string in "HH:MM" format, e.g. "09:00"
 *
 * @example
 *   trimTime("09:00:00") // "09:00"
 *   trimTime("21:30:00") // "21:30"
 *   trimTime("09:00")    // "09:00"  (already trimmed — no-op)
 */
export function trimTime(time: string): string {
  return time.substring(0, 5);
}

/**
 * Validates that a string matches the HH:MM format expected for business hours.
 *
 * Accepts values in range 00:00 – 23:59. Leading zeros required.
 *
 * @param time - String to validate
 * @returns     true if the string is a valid HH:MM time
 */
export function isValidHHMM(time: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match !== null;
}
