// Step 4 - Accounting Setup (Xero optional, Figma 348:1007). The API is minty-onboarding-api's
// /accounting routes; fetch is mocked here, so these pin what the screens send and show.
// Owner, 2026-11-11: three screens on each path - how Minty works, the business (or Connect), the
// expense accounts. The business type brings the sales accounts and daily closing's defaults; Petty
// Cash Settings maps a Xero company's daily-closing accounts.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepAccountingSetup } from "../steps/AccountingSetup";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { AccountingForm, StepProps, WizardState } from "../../lib/types";

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let answers: Record<string, unknown>;
let expenseRows: ReturnType<typeof account>[];
let connected: boolean;
let bankAllSales: boolean;

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
  used: true,
});

/** The API leaves the cash-sale slot out for a company that banks all its sales. */
function withoutCashSale() {
  const petty = account("a1", "090", "Petty Cash", "bank");
  return {
    petty_cash: { account: petty, options: [petty] },
    bank: { account: null, options: [petty] },
    discrepancy: { account: null, options: [] },
    director: { account: null, options: [] },
  };
}

function setupAnswer() {
  const petty = account("a1", "090", "Petty Cash", "bank");
  return {
    mode: "minty",
    business_type: "retail",
    uses_sales_cash: true,
    business_answered: true,
    connected: connected,
    accounts: { sales: [], expense: expenseRows },
    slots: {
      petty_cash: { account: petty, options: [petty] },
      bank: { account: null, options: [petty] },
      cash_sale: { account: null, options: [] },
      discrepancy: { account: null, options: [] },
      director: { account: null, options: [] },
    },
    slots_ready: 1,
    ...(bankAllSales ? { slots: withoutCashSale() } : {}),
    next_code: { sales: "200", expense: "400", bank: "091" },
    types: [{ value: "bank", label: "Bank" }],
  };
}

beforeEach(() => {
  calls = [];
  answers = {};
  expenseRows = [];
  connected = false;
  bankAllSales = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({
        url: path,
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      // the whole step: the read, and the Xero ticks and refresh, which answer it again
      const body = /\/accounting(\/xero-accounts|\/xero-refresh)?$/.test(path)
        ? setupAnswer()
        : (answers[path] ?? {});
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderStep(
  accounting: AccountingForm,
  modules: WizardState["modules"] = ["pettyCash"],
  xero: WizardState["xero"] = { connected: false, org: "" },
) {
  let state: WizardState = {
    ...initialState(),
    entity: { ...initialState().entity, id: "e-1", name: "Shop" },
    modules,
    accounting,
    xero,
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

  it("counts Connect to Xero as one of step 4's screens", async () => {
    // Mode, X1 (Connect), X3: X1 is 2 of 3, like the screens around it.
    renderStep({ mode: "xero", businessType: null, usesSalesCash: null });
    expect(await screen.findByText("Xero Integration")).toBeInTheDocument();
    expect(screen.getByText(/Accounting setup · 2 of 3/i)).toBeInTheDocument();
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
    // no sales screen (owner, 2026-11-11): straight on to the expense accounts
    await screen.findByText("What do you usually spend money on?");
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

describe("4.4 the expense list", () => {
  it("an empty list offers Auto Fill and adding your own", async () => {
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("What do you usually spend money on?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auto Fill/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add another category/ }));
    expect(screen.getByLabelText(/Code/)).toHaveValue("400");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      screen.getByText("The name is still empty. Add a name to continue."),
    ).toBeInTheDocument();
  });

  it("is the last screen: Save & Next leaves the step", async () => {
    const { next } = renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    await screen.findByText("What do you usually spend money on?");
    expect(screen.getByText(/Accounting setup · 3 of 3/i)).toBeInTheDocument();
    saveAndNext();
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/accounts ready/)).toBeNull();
  });
});

describe("4.4 Auto Fill and Revert (owner, 2026-11-11)", () => {
  const cashOverShort = {
    ...account("s9", "6900", "Cash Over / Short", "expense"),
    is_system: false,
    auto_filled: false,
  };

  it("a row Revert had to keep (daily closing uses it) does not count as filled", async () => {
    expenseRows = [cashOverShort];
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("Cash Over / Short")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Auto Fill/ });
    expect(button).toHaveAttribute("aria-pressed", "false");
    // and the template's other suggestions are not fetched back beside it
    expect(calls.some((c) => c.url.includes("/accounting/autofill"))).toBe(false);
  });

  it("an Auto Fill row nothing uses yet is filled: the button reads Revert", async () => {
    expenseRows = [
      cashOverShort,
      { ...account("s1", "6000", "Rent", "expense"), is_system: false, auto_filled: true },
    ];
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("Rent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revert/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("Revert leaves the list unfilled: the suggestions are not fetched back", async () => {
    const rent = {
      ...account("s1", "6000", "Rent", "expense"),
      is_system: false,
      auto_filled: true,
    };
    expenseRows = [cashOverShort, rent];
    let reverted = false;
    // the API takes Rent out and keeps Cash Over / Short (daily closing uses it)
    Object.defineProperty(answers, "/api/onboarding/accounting/autofill/revert", {
      get: () => {
        expenseRows = [cashOverShort];
        reverted = true;
        return { removed: 1, kept: [cashOverShort] };
      },
    });
    // the list's read after Revert takes a moment, as the real API's does
    const instant = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (reverted && new URL(String(url)).pathname.endsWith("/accounting"))
        await new Promise((r) => setTimeout(r, 50));
      return instant(url, init);
    });
    answers["/api/onboarding/accounting/autofill"] = {
      based_on: "retail",
      options: [
        {
          template_id: "t1",
          code: "6000",
          name: "Rent",
          type: "expense",
          ticked: true,
          added: true,
        },
      ],
    };
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    fireEvent.click(await screen.findByRole("button", { name: /Revert/ }));

    const button = await screen.findByRole("button", { name: /Auto Fill/ });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(screen.queryByText("Rent")).toBeNull();
    const revertAt = calls.findIndex((c) => c.url.endsWith("/autofill/revert"));
    expect(
      calls.slice(revertAt).some((c) => c.method === "GET" && c.url.endsWith("/autofill")),
    ).toBe(false);
  });
});

describe("4.4 an expense row", () => {
  it("shows its code and description, ticked, with Edit and Remove in its menu", async () => {
    expenseRows = [
      {
        ...account("s1", "420", "Rent", "expense"),
        description: "The shop's monthly rent.",
      },
    ];
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("Rent")).toBeInTheDocument();
    expect(screen.getByText(/The shop's monthly rent./)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Rent/ })).toBeChecked();

    const more = screen.getByRole("button", { name: "More for Rent" });
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(more);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/accounts/s1"))).toBe(true),
    );
  });
});

describe("X3 the Xero expense accounts (Figma 348:1949)", () => {
  const xeroRow = (id: string, code: string, name: string, used: boolean) => ({
    ...account(id, code, name, "expense"),
    type_label: "Expense",
    source: "xero",
    from_xero: true,
    used,
  });

  it("follows Connect to Xero, starts from the saved ticks, saves exactly the ticked ones and ends the step", async () => {
    connected = true;
    expenseRows = [xeroRow("x1", "400", "Advertising", true), xeroRow("x2", "469", "Rent", false)];
    const { next } = renderStep(
      { mode: "xero", businessType: null, usesSalesCash: null },
      ["pettyCash"],
      {
        connected: true,
        org: "Demo",
      },
    );
    fireEvent.click(await screen.findByRole("button", { name: /Save & Next/ }));
    expect(await screen.findByText("Which expense accounts should Minty use?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Advertising/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Rent/ })).not.toBeChecked();

    // Nothing ticked is refused here, with the sentence, before the API is asked.
    fireEvent.click(screen.getByRole("checkbox", { name: /Advertising/ }));
    saveAndNext();
    expect(
      await screen.findByText("Tick at least one expense account to continue."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/xero-accounts"))).toBe(false);

    fireEvent.click(screen.getByRole("checkbox", { name: /Rent/ }));
    saveAndNext();
    await waitFor(() => {
      const save = calls.find((c) => c.url.endsWith("/xero-accounts"));
      expect(save?.body).toEqual({ entity_id: "e-1", kind: "expense", account_ids: ["x2"] });
    });
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  });

  it("searches by code or name and shows the rest behind Show more", async () => {
    connected = true;
    expenseRows = Array.from({ length: 12 }, (_, i) =>
      xeroRow(`r${i}`, String(400 + i), `Cost ${i}`, i === 0),
    );
    renderStep({ mode: "xero", businessType: null, usesSalesCash: null }, ["pettyCash"], {
      connected: true,
      org: "Demo",
    });
    fireEvent.click(await screen.findByRole("button", { name: /Save & Next/ }));
    await screen.findByText("Which expense accounts should Minty use?");
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: /Show more accounts \(2\)/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search accounts" }), {
      target: { value: "411" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: /Cost 11/ })).toBeInTheDocument();
  });
});
