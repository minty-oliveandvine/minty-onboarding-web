// StepConnectXero after a Xero round-trip that connected nothing because the Xero login sees
// several organisations no company holds (Flask's `xero=choose`, owner 2026-10-27). Flask's
// flash doesn't survive the trip, so the step says it: once, then clears the flag.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepConnectXero } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import type { StepProps } from "../../lib/types";

function renderStep(xeroChoose: boolean) {
  const clearXeroChoose = vi.fn();
  render(
    <ToastProvider>
      <StepConnectXero
        state={
          {
            xero: { connected: false, org: "" },
            entity: { name: "Shop" },
          } as unknown as StepProps["state"]
        }
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
