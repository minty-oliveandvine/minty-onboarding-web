"use client";

// Step 1's Phone Number: a dial-code picker beside the number. The picker follows the Country
// field until the user picks a code of their own; a pasted "+65 6123 4567" moves it to +65.
// The state's shape and every rule live in lib/validation's phone section.
import { useMemo, useState } from "react";
import MintySelect from "./MintySelect";
import {
  capNational,
  composeWizardPhone,
  maxNationalDigits,
  nationalDigits,
  parseWizardPhone,
  phoneError,
  sanitizePhoneInput,
  splitStoredPhone,
  type DialCountry,
} from "../lib/validation";

type PhoneValue = { phone: string; phoneCountry: string };

/** "" when the field can be saved as it stands, else what to tell the user. The step's Save
 *  gate and the field's message both read this, so they cannot disagree. */
export function phoneFieldError(phone: string, dial: DialCountry[]): string {
  const parsed = parseWizardPhone(phone);
  // A pasted "+999 1234" has the field's own shape, so the code itself is checked too.
  if (parsed && dial.some((d) => d.code === parsed.code))
    return phoneError(parsed.code, parsed.national);
  if (!/\d/.test(phone)) return "";
  // A stored "+85291234567" the step is about to split into the field's form.
  if (phone.startsWith("+") && splitStoredPhone(phone, dial, "")) return "";
  // Anything else carries no code to judge its length by -- a "+" no country has, or digits
  // typed while no code was picked -- and the API refuses it, so it must not reach Save.
  return phone.startsWith("+") ? "Please check the country code." : "Please choose a country code.";
}

export default function PhoneField({
  id,
  phone,
  phoneCountry,
  country,
  dial,
  onChange,
}: PhoneValue & {
  id: string;
  /** The company's Country (an ISO code once the registry is in). */
  country: string;
  dial: DialCountry[];
  onChange: (next: PhoneValue) => void;
}) {
  // The message waits for the first blur, so it does not shout while the number is typed.
  const [touched, setTouched] = useState(false);
  const iso = phoneCountry || country;
  const picked = dial.find((d) => d.iso === iso) ?? null;
  const parsed = parseWizardPhone(phone);
  const national = parsed ? parsed.national : phone;
  const error = phoneFieldError(phone, dial);
  const shown = touched && !!error;

  const options = useMemo(
    () => dial.map((d) => ({ value: d.iso, label: `${d.name} +${d.code}` })),
    [dial],
  );
  const codeOf = useMemo(() => new Map(dial.map((d) => [d.iso, d.code])), [dial]);
  // Choosing the Country's own code is no choice: the picker goes back to following it.
  const own = (pick: string) => (pick === country ? "" : pick);

  const setNational = (raw: string) => {
    let v = sanitizePhoneInput(raw);
    if (v.startsWith("+")) {
      // Compacted first: "+44 07700 900123" is already the wizard's own shape, which
      // splitStoredPhone leaves alone, but here the code in it is new and the picker must move.
      const split = splitStoredPhone(`+${v.replace(/\D/g, "")}`, dial, iso);
      const p = split ? parseWizardPhone(split.phone) : null;
      // No known code yet ("+6" on the way to "+65"): kept as typed, and flagged.
      onChange(
        split
          ? {
              phone: p ? composeWizardPhone(p.code, capNational(p.code, p.national)) : split.phone,
              phoneCountry: own(split.iso),
            }
          : { phone: v, phoneCountry },
      );
      return;
    }
    if (picked) {
      // No digit past the code's maximum (8 for +852). A keystroke on a full number is refused
      // outright, so a digit typed mid-number cannot push the last one out; a paste is cut at
      // the limit. Deleting always goes through, even on a number left too long by a code change.
      const max = maxNationalDigits(picked.code);
      const next = nationalDigits(picked.code, v).length;
      const cur = nationalDigits(picked.code, national).length;
      if (next > max && next > cur) {
        if (cur >= max) return;
        v = capNational(picked.code, v);
      }
    }
    onChange({ phone: picked ? composeWizardPhone(picked.code, v) : v, phoneCountry });
  };

  const pick = (next: string) => {
    const d = dial.find((x) => x.iso === next);
    if (!d) return;
    onChange({
      phone: composeWizardPhone(d.code, national.replace(/^\+/, "")),
      phoneCountry: own(next),
    });
  };

  return (
    <div className={"field" + (shown ? " field-error" : "")}>
      <label htmlFor={id}>
        Phone Number <span className="field-optional">(optional)</span>
      </label>
      <div className="phone-row">
        <MintySelect
          value={picked?.iso ?? ""}
          onChange={pick}
          options={options}
          searchable
          placeholder="Code"
          ariaLabel="Country code"
          valueLabel={(o) => `${o.value} +${codeOf.get(o.value) ?? ""}`}
        />
        <input
          id={id}
          type="tel"
          name="tel-national"
          autoComplete="tel-national"
          inputMode="tel"
          placeholder="Phone number"
          value={national}
          aria-invalid={shown || undefined}
          aria-describedby={shown ? `${id}-error` : undefined}
          onChange={(e) => setNational(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </div>
      {shown && (
        <div className="field-required" role="alert" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}
