// lib/amount -- amounts follow the company currency's decimal places (2026-10-13).
//
// The opening balance used to be typed and shown with exactly 2 decimals whatever the
// currency. A zero-decimal currency (JPY) must refuse "12.5" and show "1,200"; the
// default stays 2 so every existing caller is unchanged.

import { describe, expect, it } from "vitest";

import { formatAmount, toAmountString } from "../amount";

describe("two decimals (the default)", () => {
  it("keeps today's behaviour", () => {
    expect(toAmountString("1200.5")).toBe("1200.50");
    expect(formatAmount("1200.5")).toBe("1,200.50");
  });

  it("reads the grouped text the field now holds while typing", () => {
    expect(toAmountString("1,234,567.5")).toBe("1234567.50");
    expect(toAmountString("1,234.")).toBe("1234.00");
  });
});

describe("a zero-decimal currency", () => {
  it("normalises and shows whole amounts", () => {
    expect(toAmountString("1200", 0)).toBe("1200");
    expect(formatAmount("1200", 0)).toBe("1,200");
  });
});

describe("a three-decimal currency", () => {
  it("keeps three places", () => {
    expect(toAmountString("1.5", 3)).toBe("1.500");
    expect(formatAmount("1234.5678", 3)).toBe("1,234.567");
  });
});
