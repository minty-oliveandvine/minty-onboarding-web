// Payment Request Settings (step 8) follows Accounting Setup (owner, 2026-11-11): its list is step
// 4's expense accounts, so an empty list sends the person back to step 4, never to "Connect to Xero"
// (a Minty company on its own has no Xero at all).

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepBills } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { WizardState } from "../../lib/types";

function renderStep(bill: { code: string; name: string }[]) {
  const base = initialState();
  const state: WizardState = {
    ...base,
    accounting: { mode: "minty", businessType: "retail", usesSalesCash: false },
    bills: { ...base.bills, billCodes: { all: false, selected: { "420": true } } },
  };
  const returnToStep = vi.fn();
  const submitBills = vi.fn().mockResolvedValue({ ok: true });
  render(
    <ToastProvider>
      <StepBills
        state={state}
        set={vi.fn()}
        next={vi.fn()}
        back={vi.fn()}
        accountOptions={{ bill } as never}
        submitBills={submitBills}
        saveAndExit={vi.fn()}
        isLastContentStep={false}
        returnToStep={returnToStep}
      />
    </ToastProvider>,
  );
  return { returnToStep, submitBills };
}

describe("Payment Request Settings from Accounting Setup", () => {
  it("lists step 4's expense accounts with the ticks it was given", () => {
    renderStep([
      { code: "310", name: "Stock purchases" },
      { code: "420", name: "Rent" },
    ]);
    expect(
      screen.getByText("Choose which of your expense accounts appear in Payment Request."),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "420" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "310" })).not.toBeChecked();
    expect(screen.queryByText(/Connect to Xero/)).toBeNull();
  });

  it("sends a company with no expense account back to Accounting Setup", () => {
    const { returnToStep } = renderStep([]);
    expect(
      screen.getByText(/Add an expense account in Accounting Setup first\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Connect to Xero/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Go to Accounting Setup" }));
    expect(returnToStep).toHaveBeenCalledWith(4);
  });
});
