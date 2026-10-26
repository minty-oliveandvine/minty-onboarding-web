/**
 * Single source of truth for how amounts are shown and typed.
 *
 * Display: thousands grouped in 3s with commas, always exactly the currency's
 * decimal places - 2 unless a caller passes the currency's own
 * (`currency_info.decimal_places`; JPY is 0, so 12000 -> "12,000").
 *
 * Entry is @minty/shared/amountInput (owner, 2026-10-26): commas as the user
 * types, the places padded on blur, the same digit limits. What it hands back
 * is grouped text ("1,234.5"), which toAmountString reads as it is.
 *
 * Grouping and rounding are done with string operations rather than
 * parseFloat/toLocaleString, so a 12-digit amount keeps every digit instead of
 * drifting on the way through a float.
 */

/** Max digits allowed before the decimal point. Decimals are capped at 2. */
export const MAX_AMOUNT_INT_DIGITS = 11;

/** Decimal places when the caller does not pass the currency's own. */
export const MAX_AMOUNT_DECIMALS = 2;

/** Strip grouping commas so only digits and at most one dot remain. */
export function cleanAmountString(raw: string | number): string {
  return String(raw).trim().replace(/,/g, "");
}

/** Insert a comma every 3 digits, right to left. "12345" -> "12,345". */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Normalize a typed amount to an exact decimal string in `decimals` places,
 * e.g. "12,312,312.5" -> "12312312.50". Pure string work — never parseFloat —
 * so large values keep every digit. Extra decimals are truncated, not rounded
 * ("9.999" -> "9.99"); with 0 places there is no point ("1200.5" -> "1200").
 * Returns undefined when blank or not a number.
 */
export function toAmountString(
  raw: string | number,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string | undefined {
  const cleaned = cleanAmountString(raw);
  if (!cleaned || cleaned === ".") return undefined;

  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  if (!/^\d*\.?\d*$/.test(unsigned) || !/\d/.test(unsigned)) return undefined;

  const [intRaw = "", decRaw = ""] = unsigned.split(".");
  let intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  const dec = (decRaw + "0".repeat(decimals)).slice(0, decimals);

  const sign = negative && /[1-9]/.test(intPart + dec) ? "-" : "";
  return decimals > 0 ? `${sign}${intPart}.${dec}` : `${sign}${intPart}`;
}

/**
 * Format any amount for display: grouped to 3 digits, always `decimals` places.
 * Accepts a raw user string, an API decimal string, or a number.
 * Returns "" when there is no usable number.
 */
export function formatAmount(
  value: string | number | null | undefined,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? numberToPlainString(value) : value;
  const normalized = toAmountString(raw, decimals);
  if (normalized === undefined) return "";
  const [intPart, dec] = normalized.split(".");
  const negative = intPart.startsWith("-");
  const digits = negative ? intPart.slice(1) : intPart;
  return `${negative ? "-" : ""}${groupThousands(digits)}${dec !== undefined ? `.${dec}` : ""}`;
}

/**
 * Turn a number into a plain decimal string without exponent notation or
 * locale grouping, so it can go through the string formatters above. Used as
 * the bridge from computed numbers (totals, remainders) into display.
 *
 * Emits more decimals than we keep and lets toAmountString() do the truncating,
 * so numbers and strings truncate through the same code path. The intermediate
 * precision matters: a float sum like 0.1 + 0.2 is really 0.30000000000000004
 * and 3.00 - 1.00 can land on 1.9999999999999998, so truncating the raw float
 * would show 1.99. Rendering at 8dp first collapses that noise back to
 * 2.00000000, which then truncates cleanly.
 */
function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(8);
}
