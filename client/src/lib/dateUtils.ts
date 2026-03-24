/**
 * Returns the current date in YYYY-MM-DD format using the user's LOCAL timezone.
 * Uses getFullYear/getMonth/getDate which return local-time values, not UTC.
 * This prevents entries from drifting into the next day for users in UTC-offset timezones.
 */
export function getLocalDateStr(): string {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

/**
 * Returns the user's IANA timezone string (e.g. "America/New_York").
 * Falls back to "UTC" if the browser doesn't support Intl.
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
