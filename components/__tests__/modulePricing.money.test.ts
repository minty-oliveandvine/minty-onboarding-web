import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { formatPrice } from "@minty/shared/money";
import {
  MODULES,
  ModuleSubscriptionSummary,
  priceSelection,
  type PricedRow,
} from "../steps/modulePricing";
import type { Plan, PlanCatalog } from "../../lib/api";

// owner 2026-10-21: one money rule (@minty/shared/money). Every amount is "HKD 1,234.50" - the
// ISO code, a non-breaking space, the currency's places, never a symbol. A PRICE on this
// wizard drops a trailing ".00" (formatPrice), which is what the module's own
// money()/trimZeroCents() did before they were deleted in favour of the shared module.

describe("formatPrice, as the wizard prints a price", () => {
  it("spaces the code off the number and drops whole cents", () => {
    expect(formatPrice(560, "HKD")).toBe("HKD\u00a0560");
    expect(formatPrice(560.5, "HKD")).toBe("HKD\u00a0560.50");
    expect(formatPrice("1200", "HKD")).toBe("HKD\u00a01,200");
    expect(formatPrice(400, " hkd ")).toBe("HKD\u00a0400");
  });

  it("writes the number alone with no code, and nothing for no number", () => {
    expect(formatPrice(280, "")).toBe("280");
    expect(formatPrice(280, null)).toBe("280");
    expect(formatPrice(1000, null)).toBe("1,000");
    expect(formatPrice(null, "HKD")).toBe("");
    expect(formatPrice("abc", "HKD")).toBe("");
  });

  it("cuts a third decimal rather than rounding it", () => {
    expect(formatPrice(9.999, "HKD")).toBe("HKD\u00a09.99");
  });

  it("drops only the currency's own zero places", () => {
    expect(formatPrice(1200, "JPY", 0)).toBe("JPY\u00a01,200");
    expect(formatPrice(1.5, "KWD", 3)).toBe("KWD\u00a01.500");
    expect(formatPrice(2, "KWD", 3)).toBe("KWD\u00a02");
  });
});

describe("priceSelection", () => {
  const plan = (over: Partial<Plan>): Plan => ({
    code: "PETTY_CASH",
    name: "Petty Cash",
    amount: 280,
    formatted_amount: "280.00",
    currency_code: "HKD",
    currency_symbol: "",
    billing_interval: "month",
    ...over,
  });
  const row = (p: Plan): PricedRow => ({ module: MODULES[0], plan: p, on: true });
  const catalog = (plans: Plan[]): PlanCatalog =>
    ({
      plans,
      bundle_amount: null,
      bundle_codes: [],
      bundle_currency: null,
    }) as unknown as PlanCatalog;

  it("labels the price with the ISO code, never the symbol the API sends", () => {
    const symbolled = plan({ currency_symbol: "HK$" });
    expect(priceSelection(catalog([symbolled]), [row(symbolled)]).currencyCode).toBe("HKD");
    const coded = plan({ currency_symbol: "" });
    expect(priceSelection(catalog([coded]), [row(coded)]).currencyCode).toBe("HKD");
  });

  it("has no label at all when the plan carries no code, so the figure stands alone", () => {
    const bare = plan({ currency_code: "", currency_symbol: "HK$" });
    expect(priceSelection(catalog([bare]), [row(bare)]).currencyCode).toBe("");
  });
});

describe("ModuleSubscriptionSummary prices", () => {
  const plan = (code: Plan["code"], amount: number): Plan => ({
    code,
    name: code,
    amount,
    formatted_amount: `${amount}.00`,
    currency_code: "HKD",
    currency_symbol: "HK$",
    billing_interval: "month",
  });
  const catalog: PlanCatalog = {
    plans: [plan("PETTY_CASH", 280), plan("PAYMENT_REQUEST", 280.5)],
    bundle_amount: 480,
    bundle_codes: ["PETTY_CASH", "PAYMENT_REQUEST"],
    bundle_currency: "HKD",
    trial_period_days: 30,
  };
  const tile = (selected: Parameters<typeof ModuleSubscriptionSummary>[0]["selected"]) => {
    const { container } = render(
      createElement(ModuleSubscriptionSummary, {
        catalog,
        selected,
        card: null,
        cardLoading: false,
        onOpenBilling: () => {},
      }),
    );
    return container.querySelector<HTMLElement>(".sub-tile")!;
  };

  it("names the bundle price with the code and strikes the bare subtotal, cents kept", () => {
    const el = tile(["pettyCash", "bills"]);
    expect(el.querySelector(".sub-tile-now")).toHaveTextContent(/^HKD 480$/);
    expect(el.querySelector(".sub-tile-was")).toHaveTextContent(/^560.50$/);
    expect(el).not.toHaveTextContent("HK$");
  });

  it('drops a whole-dollar price to "HKD 280"', () => {
    const el = tile(["pettyCash"]);
    expect(el.querySelector(".sub-tile-now")).toHaveTextContent(/^HKD 280$/);
    expect(el.querySelector(".sub-tile-was")).toBeNull();
  });
});
