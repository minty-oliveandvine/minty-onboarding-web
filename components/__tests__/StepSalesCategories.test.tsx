// Step 5 shows step 4's sales categories (owner, 2026-11-11): for a company with a mode, its sales
// methods ARE Accounting Setup's "Your sales categories" - one read-only list, changed in step 4.
// A company that started before step 4 asked how Minty works keeps the Electronic / Delivery lists.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepSalesSetting } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { SalesCategory } from "../../lib/api";
import type { WizardState } from "../../lib/types";

vi.mock("@/lib/refData", () => ({
  fetchCurrencies: () => Promise.resolve([]),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ today: "2026-11-11" }), { status: 200 })),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderStep(mode: "minty" | "xero" | null, salesCategories: SalesCategory[] | null) {
  const base = initialState();
  const state: WizardState = {
    ...base,
    accounting: { mode, businessType: "retail", usesSalesCash: true },
  };
  const returnToStep = vi.fn();
  render(
    <ToastProvider>
      <StepSalesSetting
        state={state}
        set={vi.fn()}
        next={vi.fn()}
        back={vi.fn()}
        submitSalesMethods={vi.fn(() => Promise.resolve({ ok: true as const }))}
        submitOpeningBalance={vi.fn(() => Promise.resolve({ ok: true as const }))}
        saveAndExit={vi.fn()}
        salesCategories={salesCategories}
        returnToStep={returnToStep}
      />
    </ToastProvider>,
  );
  return { returnToStep };
}

const CATEGORIES: SalesCategory[] = [
  { account_id: "a1", code: "4001", name: "Online Sales", method: "Online Sales" },
  { account_id: "a2", code: "4004", name: "Delivery Sales", method: "Delivery Sales" },
  { account_id: "a3", code: "4010", name: "Cash Sales", method: "Cash" },
];

describe("Step 5's sales categories", () => {
  it("lists step 4's categories as one read-only list, with the way back to step 4", () => {
    const { returnToStep } = renderStep("minty", CATEGORIES);
    expect(screen.getByRole("heading", { name: "Your sales categories" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Your sales categories" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("Delivery Sales")).toBeInTheDocument();
    // read-only: no Electronic / Delivery lists, no Add New Method, no Auto Fill
    expect(screen.queryByText("Electronic")).toBeNull();
    expect(screen.queryByText(/Add New Method/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Auto fill/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change them in Accounting Setup" }));
    expect(returnToStep).toHaveBeenCalledWith(4);
  });

  it("sends a company with no sales category back to step 4", () => {
    renderStep("xero", []);
    expect(
      screen.getByText(/Add a sales category in Accounting Setup first\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change them in Accounting Setup" }),
    ).toBeInTheDocument();
  });

  it("keeps the old lists for a company with no mode", () => {
    renderStep(null, null);
    expect(
      screen.getByRole("heading", { name: "Type of sales method of your company" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Your sales categories" })).toBeNull();
  });
});
