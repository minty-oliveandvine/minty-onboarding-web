// components/OnboardingSteps StepSalesSetting -- Step 5's opening date default.
//
// The date's limit is the SERVER's Hong Kong "today" (/api/onboarding/server-time), so its
// default comes from there too, never the browser's clock: a browser a day ahead used to
// default to a date the API then refused as "in the future". A date the user picked, or one a
// saved draft brought back, is never replaced.

import { render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StepSalesSetting } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { WizardState } from "../../lib/types";

vi.mock("@/lib/refData", () => ({
  fetchCurrencies: () => Promise.resolve([]),
}));

let latest: WizardState;
const remember = (s: WizardState) => {
  latest = s;
};

function Harness({ start }: { start: WizardState }) {
  const [state, setState] = useState<WizardState>(start);
  useEffect(() => remember(state), [state]);
  return (
    <ToastProvider>
      <StepSalesSetting
        state={state}
        set={(patch) =>
          setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }))
        }
        next={vi.fn()}
        back={vi.fn()}
        submitSalesMethods={vi.fn(() => Promise.resolve({ ok: true as const }))}
        submitOpeningBalance={vi.fn(() => Promise.resolve({ ok: true as const }))}
        saveAndExit={vi.fn()}
      />
    </ToastProvider>
  );
}

function serverToday(today: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        today === null
          ? new Response("", { status: 503 })
          : new Response(JSON.stringify({ today }), { status: 200 }),
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StepSalesSetting -- the opening date's default", () => {
  it("is the server's today, not the browser's", async () => {
    serverToday("2001-02-03");
    render(<Harness start={initialState()} />);
    await waitFor(() => expect(latest.pettyCash.openingDate).toBe("2001-02-03"));
  });

  it("never replaces a date the draft already holds", async () => {
    serverToday("2001-02-03");
    const start = initialState();
    start.pettyCash = { ...start.pettyCash, openingDate: "2000-12-25" };
    render(<Harness start={start} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // Let the server-time answer land before judging.
    await new Promise((r) => setTimeout(r, 20));
    expect(latest.pettyCash.openingDate).toBe("2000-12-25");
  });

  it("falls back to Hong Kong's today when the server cannot say", async () => {
    serverToday(null);
    const hk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
    render(<Harness start={initialState()} />);
    await waitFor(() => expect(latest.pettyCash.openingDate).toBe(hk));
  });
});
