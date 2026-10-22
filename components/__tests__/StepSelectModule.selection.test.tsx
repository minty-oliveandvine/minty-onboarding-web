// components/OnboardingSteps StepSelectModule -- what the 9C card redesign must NOT change:
// multi-select toggling, Save & Next gated on at least one pick, the save-then-advance order,
// and the price summary beside the cards. Written against the pre-redesign cards first
// (2026-10-19) and kept green through it; the cards' own accessibility is pinned in
// StepSelectModule.cards.test.tsx.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StepSelectModule } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import type { ModuleId, PlanCatalog } from "../../lib/api";
import type { WizardState } from "../../lib/types";

const CATALOG: PlanCatalog = {
  plans: [
    {
      code: "PETTY_CASH",
      name: "Petty Cash",
      amount: 280,
      formatted_amount: "280.00",
      currency_code: "HKD",
      currency_symbol: "HKD",
      billing_interval: "month",
    },
    {
      code: "PAYMENT_REQUEST",
      name: "Payment Request",
      amount: 280,
      formatted_amount: "280.00",
      currency_code: "HKD",
      currency_symbol: "HKD",
      billing_interval: "month",
    },
  ],
  bundle_amount: 480,
  bundle_codes: ["PETTY_CASH", "PAYMENT_REQUEST"],
  bundle_currency: "HKD",
  trial_period_days: 30,
};

function setup(modules: ModuleId[] = [], catalog: PlanCatalog | null = CATALOG) {
  const next = vi.fn();
  const submitModule = vi.fn(async () => ({ ok: true as const }));
  const seen: { modules: ModuleId[] } = { modules };
  function Harness() {
    const [state, setState] = useState({ modules, entity: {} } as unknown as WizardState);
    seen.modules = state.modules;
    return (
      <ToastProvider>
        <StepSelectModule
          state={state}
          set={(patch) =>
            setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }))
          }
          next={next}
          back={vi.fn()}
          submitModule={submitModule}
          modulePlans={catalog}
          token=""
          saveAndExit={vi.fn()}
        />
      </ToastProvider>
    );
  }
  const utils = render(<Harness />);
  const cards = () => utils.container.querySelectorAll<HTMLElement>(".module-pick");
  const saveNext = () => screen.getByRole("button", { name: /Save & Next/ });
  return { ...utils, cards, saveNext, next, submitModule, seen };
}

describe("StepSelectModule selection (unchanged by the 9C redesign)", () => {
  it("toggles each card on and off, and both can be picked together", async () => {
    const { cards, seen } = setup();
    await userEvent.click(cards()[0]);
    expect(seen.modules).toEqual(["pettyCash"]);
    await userEvent.click(cards()[1]);
    expect(seen.modules).toEqual(["pettyCash", "bills"]);
    await userEvent.click(cards()[0]);
    expect(seen.modules).toEqual(["bills"]);
  });

  it("holds Save & Next until a module is picked, and says why", async () => {
    const { cards, saveNext } = setup();
    expect(saveNext()).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("Pick a module to continue");
    await userEvent.click(cards()[0]);
    expect(saveNext()).toBeEnabled();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("saves the modules before it advances", async () => {
    const { saveNext, next, submitModule } = setup(["pettyCash"]);
    await userEvent.click(saveNext());
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(submitModule).toHaveBeenCalledTimes(1);
    expect(submitModule.mock.invocationCallOrder[0]).toBeLessThan(next.mock.invocationCallOrder[0]);
  });

  it("prices one module as itself and both as SuperMinty", async () => {
    const { cards, container } = setup();
    expect(container.querySelector(".sub-summary")).toBeNull();
    await userEvent.click(cards()[0]);
    const summary = () => container.querySelector<HTMLElement>(".sub-summary")!;
    expect(within(summary()).getByText("Petty Cash")).toBeInTheDocument();
    expect(within(summary()).getByText("only")).toBeInTheDocument();
    await userEvent.click(cards()[1]);
    expect(within(summary()).getByText("SuperMinty")).toBeInTheDocument();
    expect(within(summary()).getByText("Both modules selected")).toBeInTheDocument();
  });
});
