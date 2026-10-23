// lib/amount -- amounts follow the company currency's decimal places (2026-10-13).
//
// The opening balance used to be typed and shown with exactly 2 decimals whatever the
// currency. A zero-decimal currency (JPY) must refuse "12.5" and show "1,200"; the
// default stays 2 so every existing caller is unchanged.

import { describe, expect, it } from "vitest";

import { acceptAmountInput, formatAmount, toAmountString } from "../amount";

describe("two decimals (the default)", () => {
  it("keeps today's behaviour", () => {
    expect(toAmountString("1200.5")).toBe("1200.50");
    expect(formatAmount("1200.5")).toBe("1,200.50");
    expect(acceptAmountInput("12.345")).toBeNull();
  });
});

describe("a zero-decimal currency", () => {
  it("normalises and shows whole amounts", () => {
    expect(toAmountString("1200", 0)).toBe("1200");
    expect(formatAmount("1200", 0)).toBe("1,200");
  });

  it("refuses a decimal point while typing", () => {
    expect(acceptAmountInput("12", 0)).toBe("12");
    expect(acceptAmountInput("12.", 0)).toBeNull();
    expect(acceptAmountInput("12.5", 0)).toBeNull();
  });
});

describe("a three-decimal currency", () => {
  it("keeps three places", () => {
    expect(toAmountString("1.5", 3)).toBe("1.500");
    expect(formatAmount("1234.5678", 3)).toBe("1,234.567");
    expect(acceptAmountInput("1.234", 3)).toBe("1.234");
    expect(acceptAmountInput("1.2345", 3)).toBeNull();
  });
});
