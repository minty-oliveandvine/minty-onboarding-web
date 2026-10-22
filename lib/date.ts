// The day-display helpers ("12 Sep 2026", today in Hong Kong) come from @minty/shared/dates
// (owner 2026-10-21: one shared module (@minty/shared/dates)). Only this app's own helper is
// left here.

/** A Date -> `YYYY-MM-DD` in the LOCAL timezone.
 *
 * Not `toISOString().slice(0, 10)`: that converts to UTC first, so an evening date east of
 * Greenwich comes back as the day before. The wizard's dates are calendar days the user
 * picked, not instants, so they must be read in the user's own timezone.
 *
 * This was written out four separate times across three components -- twice inside the same
 * function, 71 lines apart.
 */
export function toIsoDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
