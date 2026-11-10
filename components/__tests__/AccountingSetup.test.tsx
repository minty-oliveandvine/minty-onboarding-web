// Step 4 - Accounting Setup (Xero optional, Figma 348:1007). The API is minty-onboarding-api's
// /accounting routes; fetch is mocked here, so these pin what the screens send and show.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepAccountingSetup } from "../steps/AccountingSetup";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { AccountingForm, StepProps, WizardState } from "../../lib/types";

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let answers: Record<string, unknown>;

const account = (id: string, code: string, name: string, type: string) => ({
  id,
  code,
  name,
  type,
  type_label: type,
  description: "",
  kind: null,
  group: null,
  source: "template",
  is_system: true,
  from_xero: false,
});

function setupAnswer() {
  const petty = account("a1", "090", "Petty Cash", "bank");
  return {
    mode: "minty",
    business_type: "retail",
    uses_sales_cash: true,
    business_answered: true,
    connected: false,
    accounts: { sales: [], expense: [] },
    slots: {
      petty_cash: { account: petty, options: [petty] },
      bank: { account: null, options: [petty] },
      cash_sale: { account: null, options: [] },
      discrepancy: { account: null, options: [] },
      director: { account: null, options: [] },
    },
    slots_ready: 1,
    next_code: { sales: "200", expense: "400", bank: "091" },
    types: [{ value: "bank", label: "Bank" }],
  };
}

beforeEach(() => {
  calls = [];
  answers = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({
        url: path,
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const body = path.endsWith("/accounting") ? setupAnswer() : (answers[path] ?? {});
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderStep(accounting: AccountingForm, modules: WizardState["modules"] = ["pettyCash"]) {
  let state: WizardState = {
    ...initialState(),
    entity: { ...initialState().entity, id: "e-1", name: "Shop" },
    modules,
    accounting,
  };
  const next = vi.fn();
  const set: StepProps["set"] = (patch) => {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  };
  const view = render(
    <ToastProvider>
      <StepAccountingSetup
        state={state}
        set={set}
        next={next}
        back={vi.fn()}
        token="t"
        saveAndExit={vi.fn()}
        connectXero={vi.fn()}
        disconnectXero={vi.fn()}
        xeroMismatch=""
        clearXeroMismatch={vi.fn()}
        xeroChoose={false}
        clearXeroChoose={vi.fn()}
        xeroConflict={null}
        clearXeroConflict={vi.fn()}
        releaseXeroConflict={vi.fn()}
      />
    </ToastProvider>,
  );
  return { next, view, getState: () => state };
}

const saveAndNext = () => fireEvent.click(screen.getByRole("button", { name: /Save & Next/ }));

describe("4.1 How would you like Minty to work?", () => {
  it("asks for a choice before moving on", () => {
    renderStep({ mode: null, businessType: null, usesSalesCash: null });
    saveAndNext();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose how Minty should work to continue.",
    );
    expect(calls).toEqual([]);
  });

  it("Connect with Xero saves the choice and opens Connect to Xero", async () => {
    const { getState } = renderStep({ mode: null, businessType: null, usesSalesCash: null });
    fireEvent.click(screen.getByRole("radio", { name: /Connect with Xero/ }));
    saveAndNext();
    expect(await screen.findByText("Xero Integration")).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      url: "/api/onboarding/accounting/mode",
      body: { entity_id: "e-1", mode: "xero" },
    });
    expect(getState().accounting?.mode).toBe("xero");
  });

  it("Use Minty independently goes on to the business questions", async () => {
    renderStep({ mode: null, businessType: null, usesSalesCash: null });
    fireEvent.click(screen.getByRole("radio", { name: /Use Minty independently/ }));
    saveAndNext();
    expect(await screen.findByText("What best describes your business?")).toBeInTheDocument();
  });
});

describe("4.2 What best describes your business?", () => {
  it("a refused save names both questions", () => {
    renderStep({ mode: "minty", businessType: null, usesSalesCash: null });
    saveAndNext();
    expect(screen.getByText("2 details need a look before this can be saved.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("'None of these' and 'Not sure' are saved as an empty type with cash sales", async () => {
    renderStep({ mode: "minty", businessType: null, usesSalesCash: null });
    fireEvent.click(screen.getByRole("radio", { name: /None of these/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Not sure/ }));
    saveAndNext();
    await screen.findByText("Your sales categories");
    expect(calls[0]).toMatchObject({
      url: "/api/onboarding/accounting/business",
      body: { entity_id: "e-1", business_type: null, uses_sales_cash: true },
    });
  });

  it("'We bank all sales' is without cash sales", async () => {
    renderStep({ mode: "minty", businessType: null, usesSalesCash: null });
    fireEvent.click(screen.getByRole("radio", { name: /Retail shop/ }));
    fireEvent.click(screen.getByRole("radio", { name: /We bank all sales/ }));
    saveAndNext();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0].body).toMatchObject({ business_type: "retail", uses_sales_cash: false });
  });
});

describe("4.3 the sales list", () => {
  it("an empty list offers Auto Fill and adding your own", async () => {
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("No sales categories yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auto Fill/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add another sales category/ }));
    expect(screen.getByLabelText(/Code/)).toHaveValue("200");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      screen.getByText("The name is still empty. Add a name to continue."),
    ).toBeInTheDocument();
  });
});

describe("4.5 the accounts daily closing needs", () => {
  it("warns about the missing ones and lets you continue", async () => {
    const { next } = renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    await screen.findByText("Your sales categories");
    saveAndNext(); // to 4.4
    await screen.findByText("What do you usually spend money on?");
    saveAndNext(); // to 4.5
    expect(await screen.findByText(/1 of 5 accounts ready/)).toBeInTheDocument();
    saveAndNext();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue anyway" }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("is left out when Petty Cash is off", async () => {
    const { next } = renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true }, [
      "bills",
    ]);
    await screen.findByText("Your sales categories");
    expect(screen.getByText(/Accounting setup · 3 of 4/i)).toBeInTheDocument();
    saveAndNext();
    await screen.findByText("What do you usually spend money on?");
    saveAndNext();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
