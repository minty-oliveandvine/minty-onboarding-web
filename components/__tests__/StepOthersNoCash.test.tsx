// Contact Setup (step 7, the Xero path) for a company that banks all its sales (4.2's "We bank all
// sales", owner's brief 2026-11-10): it records no cash sales, so no Cash Sales contact is asked for.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepOthers } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { WizardState } from "../../lib/types";

function renderStep(usesSalesCash: boolean) {
  const base = initialState();
  const state: WizardState = {
    ...base,
    accounting: { mode: "xero", businessType: "retail", usesSalesCash },
    pettyCash: { ...base.pettyCash, directorContact: "Owner", discrepancyContact: "Owner" },
  };
  const next = vi.fn();
  const submitContacts = vi.fn().mockResolvedValue({ ok: true });
  render(
    <ToastProvider>
      <StepOthers
        state={state}
        set={vi.fn()}
        next={next}
        back={vi.fn()}
        accountOptions={{ contacts: [{ label: "Owner" }] } as never}
        submitContacts={submitContacts}
        createContact={vi.fn()}
        saveAndExit={vi.fn()}
        isLastContentStep={false}
      />
    </ToastProvider>,
  );
  return { next, submitContacts };
}

describe("Contact Setup and cash sales", () => {
  it("asks a company that banks all its sales for no Cash Sales contact", async () => {
    const { submitContacts } = renderStep(false);
    expect(screen.queryByText("Cash Sales Contact")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Save & Next/ }));
    await vi.waitFor(() => expect(submitContacts).toHaveBeenCalled());
  });

  it("still asks a company with cash sales for one", () => {
    const { submitContacts } = renderStep(true);
    expect(screen.getByText("Cash Sales Contact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save & Next/ }));
    expect(submitContacts).not.toHaveBeenCalled();
  });
});
