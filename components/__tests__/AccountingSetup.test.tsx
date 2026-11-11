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
let salesRows: ReturnType<typeof account>[];
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
    accounts: { sales: salesRows, expense: [] },
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
  salesRows = [];
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
    // Mode, X1 (Connect), X2, X3 and daily closing: X1 is 2 of 5, like the screens around it.
    renderStep({ mode: "xero", businessType: null, usesSalesCash: null });
    expect(await screen.findByText("Xero Integration")).toBeInTheDocument();
    expect(screen.getByText(/Accounting setup · 2 of 5/i)).toBeInTheDocument();
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

describe("4.3 a sales row (Figma 348:1209)", () => {
  it("shows its code and description, ticked, with Edit and Remove in its menu", async () => {
    salesRows = [
      {
        ...account("s1", "201", "Product sales", "sales"),
        description: "Everything you sell over the counter.",
      },
    ];
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    expect(await screen.findByText("Product sales")).toBeInTheDocument();
    expect(
      screen.getByText(/201\s+·\s+Everything you sell over the counter\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Product sales/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Revert/ })).toBeInTheDocument();

    const more = screen.getByRole("button", { name: "More for Product sales" });
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

describe("X2 the Xero sales accounts (Figma 348:1874)", () => {
  const xeroRow = (id: string, code: string, name: string, used: boolean) => ({
    ...account(id, code, name, "revenue"),
    type_label: "Revenue",
    source: "xero",
    from_xero: true,
    used,
  });

  it("follows Connect to Xero, starts from the saved ticks and saves exactly the ticked ones", async () => {
    connected = true;
    salesRows = [
      xeroRow("x1", "200", "Sales", true),
      xeroRow("x2", "210", "Service Income", false),
    ];
    renderStep({ mode: "xero", businessType: null, usesSalesCash: null }, ["pettyCash"], {
      connected: true,
      org: "Demo",
    });
    fireEvent.click(await screen.findByRole("button", { name: /Save & Next/ }));
    expect(await screen.findByText("Which sales accounts should Minty use?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Sales/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Service Income/ })).not.toBeChecked();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Nothing ticked is refused here, with the sentence, before the API is asked.
    fireEvent.click(screen.getByRole("checkbox", { name: /Sales/ }));
    saveAndNext();
    expect(
      await screen.findByText("Tick at least one sales account to continue."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/xero-accounts"))).toBe(false);

    fireEvent.click(screen.getByRole("checkbox", { name: /Service Income/ }));
    saveAndNext();
    await waitFor(() => {
      const save = calls.find((c) => c.url.endsWith("/xero-accounts"));
      expect(save?.body).toEqual({ entity_id: "e-1", kind: "sales", account_ids: ["x2"] });
    });
    expect(await screen.findByText("Which expense accounts should Minty use?")).toBeInTheDocument();
  });

  it("searches by code or name and shows the rest behind Show more", async () => {
    connected = true;
    salesRows = Array.from({ length: 12 }, (_, i) =>
      xeroRow(`r${i}`, String(200 + i), `Income ${i}`, i === 0),
    );
    renderStep({ mode: "xero", businessType: null, usesSalesCash: null }, ["pettyCash"], {
      connected: true,
      org: "Demo",
    });
    fireEvent.click(await screen.findByRole("button", { name: /Save & Next/ }));
    await screen.findByText("Which sales accounts should Minty use?");
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: /Show more accounts \(2\)/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search accounts" }), {
      target: { value: "211" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: /Income 11/ })).toBeInTheDocument();
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

  it("Add them now opens the first missing account's list, with Create (Figma 4.5a, 4.5b)", async () => {
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: true });
    await screen.findByText("Your sales categories");
    saveAndNext();
    await screen.findByText("What do you usually spend money on?");
    saveAndNext();
    await screen.findByText(/1 of 5 accounts ready/);
    expect(screen.getByRole("button", { name: "Change petty cash" })).toBeInTheDocument();
    saveAndNext();
    fireEvent.click(await screen.findByRole("button", { name: "Add them now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const menu = screen.getByRole("menu", { name: "Bank accounts" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Create a new account/ })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("asks a company that banks all its sales for four, with no Cash sales", async () => {
    bankAllSales = true;
    renderStep({ mode: "minty", businessType: "retail", usesSalesCash: false });
    await screen.findByText("Your sales categories");
    saveAndNext();
    await screen.findByText("What do you usually spend money on?");
    saveAndNext();
    expect(await screen.findByText(/1 of 4 accounts ready/)).toBeInTheDocument();
    expect(screen.queryByText("Cash sales")).toBeNull();
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
