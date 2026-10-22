// components/PhoneField -- phoneFieldError, the one rule Step 1's Save gate and the field's
// message both read. What matters most is that a number with no code to judge it by is
// BLOCKED: the API refuses it, and before 2026-10-12 it slipped through as "no error".

import { describe, expect, it } from "vitest";
import { phoneFieldError } from "../PhoneField";
import type { DialCountry } from "../../lib/validation";

const DIAL: DialCountry[] = [
  { iso: "HK", name: "Hong Kong SAR China", code: "852" },
  { iso: "SG", name: "Singapore", code: "65" },
];

describe("phoneFieldError", () => {
  it("lets an empty field through", () => {
    expect(phoneFieldError("", DIAL)).toBe("");
    expect(phoneFieldError("(  ) -", DIAL)).toBe("");
  });

  it("judges the length by the code", () => {
    expect(phoneFieldError("+852 9123 4567", DIAL)).toBe("");
    expect(phoneFieldError("+852 123", DIAL)).toBe("A +852 number has 8 digits.");
  });

  it("lets a stored E.164 number through while the step splits it", () => {
    expect(phoneFieldError("+85291234567", DIAL)).toBe("");
  });

  it("blocks a number with no code to judge it by", () => {
    expect(phoneFieldError("123", DIAL)).toBe("Please choose a country code.");
    expect(phoneFieldError("91234567", [])).toBe("Please choose a country code.");
    expect(phoneFieldError("+999 1234", DIAL)).toBe("Please check the country code.");
  });
});
