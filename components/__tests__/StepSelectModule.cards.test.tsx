// components/OnboardingSteps StepSelectModule -- the module cards themselves (9C, 2026-10-19).
//
// Each card is a checkbox (several may be picked), keyboard operable, named by the module,
// with its benefit line in the DOM and visible without hover (it used to live in a hover-only
// overlay, which a touch screen never shows), its identity tone, and a picked state shown as a
// check plus the word "Selected" - never colour alone.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StepSelectModule } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { MODULES } from "../steps/modulePricing";
import type { ModuleId } from "../../lib/api";
import type { WizardState } from "../../lib/types";

function Harness({ modules = [] as ModuleId[] }) {
  const [state, setState] = useState({ modules, entity: {} } as unknown as WizardState);
  return (
    <ToastProvider>
      <StepSelectModule
        state={state}
        set={(patch) =>
          setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }))
        }
        next={vi.fn()}
        back={vi.fn()}
        submitModule={vi.fn()}
        modulePlans={null}
        token=""
        saveAndExit={vi.fn()}
      />
    </ToastProvider>
  );
}

const card = (name: string) => screen.getByRole("checkbox", { name });

describe("StepSelectModule cards", () => {
  it("draws each module as a named checkbox in the tab order", () => {
    render(<Harness />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(MODULES.length);
    for (const m of MODULES) {
      const c = card(m.title);
      expect(c).toHaveAttribute("aria-checked", "false");
      expect(c).toHaveAttribute("tabindex", "0");
      expect(c).toHaveClass(`is-${m.tone}`);
    }
  });

  it("shows the benefit line and the trial without any hover", () => {
    render(<Harness />);
    for (const m of MODULES) {
      const desc = screen.getByText(m.desc);
      expect(desc).toBeVisible();
      // Not inside an overlay that only appears on hover.
      expect(desc.closest(".mp-hover")).toBeNull();
      expect(card(m.title)).toHaveAccessibleDescription(`${m.desc} 30 days free trial`);
    }
  });

  it("toggles from the keyboard with Space and Enter", async () => {
    render(<Harness />);
    card("Petty Cash").focus();
    await userEvent.keyboard(" ");
    expect(card("Petty Cash")).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Enter}");
    expect(card("Petty Cash")).toHaveAttribute("aria-checked", "false");
    await userEvent.tab();
    expect(card("Payment Request")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(card("Payment Request")).toHaveAttribute("aria-checked", "true");
  });

  it('says "Selected" with a check when picked, not colour alone', async () => {
    render(<Harness />);
    const c = card("Petty Cash");
    expect(c).toHaveTextContent("Select");
    expect(c).not.toHaveTextContent("Selected");
    expect(c.querySelector(".mp-check svg")).toBeNull();
    await userEvent.click(c);
    expect(c).toHaveClass("selected");
    expect(c).toHaveTextContent("Selected");
    expect(c.querySelector(".mp-check svg")).not.toBeNull();
  });
});
