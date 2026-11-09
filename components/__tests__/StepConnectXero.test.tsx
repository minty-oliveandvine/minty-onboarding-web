// StepConnectXero after a Xero round-trip that connected nothing because the Xero login sees
// several organisations no company holds (Flask's `xero=choose`, owner 2026-10-27). Flask's
// flash doesn't survive the trip, so the step says it: once, then clears the flag.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepConnectXero } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import type { StepProps } from "../../lib/types";

function renderStep(
  xeroChoose: boolean,
  state: { xero: { connected: boolean; org: string }; entity: { name: string } } = {
    xero: { connected: false, org: "" },
    entity: { name: "Shop" },
  },
) {
  const clearXeroChoose = vi.fn();
  render(
    <ToastProvider>
      <StepConnectXero
        state={state as unknown as StepProps["state"]}
        next={vi.fn()}
        back={vi.fn()}
        connectXero={vi.fn()}
        disconnectXero={vi.fn()}
        xeroMismatch=""
        clearXeroMismatch={vi.fn()}
        xeroChoose={xeroChoose}
        clearXeroChoose={clearXeroChoose}
        xeroConflict={null}
        clearXeroConflict={vi.fn()}
        releaseXeroConflict={vi.fn()}
        saveAndExit={vi.fn()}
      />
    </ToastProvider>,
  );
  return { clearXeroChoose };
}

describe("StepConnectXero, several unclaimed organisations", () => {
  it("says how to narrow it down, and clears the flag", async () => {
    const { clearXeroChoose } = renderStep(true);
    expect(await screen.findByText(/more than one linked to Minty/)).toBeInTheDocument();
    expect(clearXeroChoose).toHaveBeenCalledTimes(1);
  });

  it("says nothing otherwise", () => {
    const { clearXeroChoose } = renderStep(false);
    expect(screen.queryByText(/more than one linked to Minty/)).not.toBeInTheDocument();
    expect(clearXeroChoose).not.toHaveBeenCalled();
  });
});

describe("StepConnectXero, the connected card's Xero Entity", () => {
  it("names the Xero organisation", () => {
    renderStep(false, { xero: { connected: true, org: "Xero Org" }, entity: { name: "Shop" } });
    expect(screen.getByText("Xero Org")).toBeInTheDocument();
  });

  it("falls back to the company's name", () => {
    renderStep(false, { xero: { connected: true, org: "" }, entity: { name: "Shop" } });
    expect(screen.getByText("Shop")).toBeInTheDocument();
  });

  it("with no name at all, shows a neutral placeholder, never a real company's name", () => {
    renderStep(false, { xero: { connected: true, org: "" }, entity: { name: "" } });
    expect(screen.getByText("Your company")).toBeInTheDocument();
  });
});
