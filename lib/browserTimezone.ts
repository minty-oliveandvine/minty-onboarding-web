// The browser's IANA timezone, sent with step 1 with no field on screen (2026-10-13). The
// company's billing emails are dated in entities.timezone; the API validates the name and
// refuses one it does not know, so "" (unavailable) simply sends nothing.
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
