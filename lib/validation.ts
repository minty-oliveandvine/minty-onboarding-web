// Shape checks that were written out in several places and could drift apart, so the
// completion gate and the UI hint for the same field read ONE rule.
//
// The email rules (isEmail, EMAIL_RE, EMAIL_ASCII_HINT, the English-only strip) and the email
// field hook are @minty/shared/emailInput's (owner 2026-10-21: one shared module
// (@minty/shared/emailInput)) - the same rules this file held. What is left here is this app's
// own: the uuid check and the phone rules.

/** Canonical uuid, any case. Used to tell a stored id from a display value. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a uuid. */
export function isUuid(value: unknown): boolean {
  return UUID_RE.test(String(value ?? ""));
}

// ---- Phone numbers ------------------------------------------------------------------------
// Step 1 keeps the phone as `+<code> <national as typed>` ("+852 9123 4567"): the dial code is
// everything before the first space, so the completion gate can judge a number without the
// country list. The API is sent the compact E.164 form (`phoneForApi`) and checks it again
// with the same table (minty-onboarding-api onboarding/services/resolve.py).

/** A country the Phone Number picker offers. `code` is the dial code without its "+". */
export type DialCountry = { iso: string; name: string; code: string };

/** National-number lengths held exactly. Hong Kong only for now: it is the one market Minty
 *  sells in (the user, 2026-10-12) - add a code when its market opens, not before. Every other
 *  code gets E.164's own bounds: at least 4 national digits, at most 15 digits in all. The
 *  API's PHONE_LENGTHS is the same table -- change them together. */
export const PHONE_LENGTHS: Record<string, number> = { "852": 8 };

/** Where a leading 0 is part of the number (Italy and the Vatican, San Marino). Everywhere
 *  else it is the domestic trunk prefix, which E.164 drops. */
const KEEPS_LEADING_ZERO = new Set(["39", "378"]);

/** For a code several countries share, the one a bare "+44" means (ITU's main country). */
const MAIN_COUNTRY: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "64": "NZ",
  "212": "MA",
  "262": "RE",
  "358": "FI",
  "500": "FK",
  "590": "GP",
  "599": "CW",
  "672": "NF",
};

const WIZARD_PHONE = /^\+(\d{1,3}) (.*)$/;

/** What a phone box keeps: digits and the punctuation people type, plus a leading "+" so a
 *  pasted international number can be recognised. */
export function sanitizePhoneInput(value: string): string {
  const v = value.replace(/^\s+/, "");
  const plus = v.startsWith("+") ? "+" : "";
  return plus + v.slice(plus.length).replace(/[^0-9 ()\-.]/g, "");
}

/** The national number's digits as E.164 stores them: the domestic trunk 0 dropped. */
export function nationalDigits(code: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  return digits.startsWith("0") && !KEEPS_LEADING_ZERO.has(code) ? digits.slice(1) : digits;
}

/** The most national digits a code takes: its exact length where it has one (8 for +852),
 *  else what E.164's 15 digits leave after the code. */
export function maxNationalDigits(code: string): number {
  return PHONE_LENGTHS[code] ?? 15 - code.length;
}

/** `national` with every digit past the code's maximum dropped (punctuation kept). Counted the
 *  way `nationalDigits` counts, so a leading trunk 0 the number loses is not a digit used up. */
export function capNational(code: string, national: string): string {
  const max = maxNationalDigits(code);
  const trunk = !KEEPS_LEADING_ZERO.has(code);
  let kept = 0;
  let seenDigit = false;
  let out = "";
  for (const ch of national) {
    if (!/\d/.test(ch)) {
      out += ch;
      continue;
    }
    const isTrunkZero = trunk && !seenDigit && ch === "0";
    seenDigit = true;
    if (isTrunkZero) {
      out += ch;
    } else if (kept < max) {
      out += ch;
      kept += 1;
    }
  }
  return out;
}

/** "" when the number is acceptable, else what to tell the user. Worded by the code, not the
 *  country: the registry's names are the long official ones ("Hong Kong SAR China"), and a
 *  shared code (+1, +44) belongs to several. */
export function phoneError(code: string, national: string): string {
  const n = nationalDigits(code, national);
  const expected = PHONE_LENGTHS[code];
  if (expected !== undefined) {
    return n.length === expected ? "" : `A +${code} number has ${expected} digits.`;
  }
  return n.length >= 4 && code.length + n.length <= 15 ? "" : "Please check the phone number.";
}

/** `"+852 9123 4567"` -> `{ code: "852", national: "9123 4567" }`. Null for any other shape:
 *  empty, a stored "+85291234567" not yet split, or a digits-only number from before the
 *  picker existed. */
export function parseWizardPhone(phone: string): { code: string; national: string } | null {
  const m = WIZARD_PHONE.exec(phone);
  return m ? { code: m[1], national: m[2] } : null;
}

/** The wizard's form, or "" when there is no number to keep. */
export function composeWizardPhone(code: string, national: string): string {
  const n = national.replace(/^\s+/, "");
  return /\d/.test(n) ? `+${code} ${n}` : "";
}

/** What the API is sent: compact E.164 ("+85291234567"), or "" for no number. */
export function phoneForApi(phone: string): string {
  const p = parseWizardPhone(phone);
  if (p) return `+${p.code}${nationalDigits(p.code, p.national)}`;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return phone.trim().startsWith("+") ? `+${digits}` : digits;
}

/** Step 1's rule for the phone: empty, or acceptable. A number in another shape came from
 *  the server (already E.164, or stored before the picker) and is not re-judged here; Step 1
 *  splits it with `splitStoredPhone` once the country list is in. */
export function phoneOk(phone: string): boolean {
  const p = parseWizardPhone(phone);
  return p ? phoneError(p.code, p.national) === "" : true;
}

/**
 * A stored or pasted number -> the wizard's form, and the picker's country. Null when there
 * is nothing to split (empty, already split, or a code no country carries).
 *
 * "+<digits>": the dial code is found by prefix (E.164 codes are prefix-free), and when several
 * countries share it (+1, +44, +7...) `preferIso` -- the company's Country -- wins if it is
 * one of them, else the code's main country (`MAIN_COUNTRY`), else the first. Digits with no "+" predate the picker: they are read as a
 * national number under `preferIso`'s code, minus that code when someone typed it in front
 * ("85291234567" -> "+852 91234567"), which the old digits-only box could not tell apart.
 */
export function splitStoredPhone(
  phone: string,
  dial: DialCountry[],
  preferIso: string,
): { phone: string; iso: string } | null {
  if (parseWizardPhone(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (phone.trim().startsWith("+")) {
    for (const n of [3, 2, 1]) {
      const code = digits.slice(0, n);
      const matches = dial.filter((d) => d.code === code);
      if (matches.length) {
        const pick =
          matches.find((d) => d.iso === preferIso) ??
          matches.find((d) => d.iso === MAIN_COUNTRY[code]) ??
          matches[0];
        return { phone: composeWizardPhone(code, digits.slice(n)), iso: pick.iso };
      }
    }
    return null;
  }
  const pref = dial.find((d) => d.iso === preferIso);
  if (!pref) return null;
  const rest = digits.slice(pref.code.length);
  const national =
    digits.startsWith(pref.code) && phoneError(pref.code, digits) && !phoneError(pref.code, rest)
      ? rest
      : digits;
  return { phone: composeWizardPhone(pref.code, national), iso: pref.iso };
}
