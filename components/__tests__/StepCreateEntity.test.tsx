// components/OnboardingSteps StepCreateEntity -- Step 1, Basic Information.
//
// Since 2026-10-19 (owner) a new company starts EMPTY, the way the phone's code picker does:
// no Country, no Currency. Both are required. Save & Next is never disabled for an empty
// required field; pressing it is a refused submit that marks the fields red and says what is
// missing -- one problem focuses its field, two or more put a focused summary at the top.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StepCreateEntity } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import { initialState } from "../../lib/wizardSteps";
import type { WizardState } from "../../lib/types";

vi.mock("@/lib/refData", () => ({
  fetchCountries: () =>
    Promise.resolve([
      {
        country_id: "HK",
        country_name_en: "Hong Kong SAR China",
        country_code: "HK",
        phone_code: "+852",
        currency_id: "hkd-id",
      },
      {
        country_id: "SG",
        country_name_en: "Singapore",
        country_code: "SG",
        phone_code: "+65",
        currency_id: "sgd-id",
      },
    ]),
  fetchCurrencies: () =>
    Promise.resolve([
      {
        currency_id: "hkd-id",
        currency_name: "Hong Kong Dollar",
        iso_code: "HKD",
        decimal_places: 2,
      },
      {
        currency_id: "sgd-id",
        currency_name: "Singapore Dollar",
        iso_code: "SGD",
        decimal_places: 2,
      },
    ]),
}));

const NAME_MSG = "The company name is still empty. Add the company name to continue.";
const COUNTRY_MSG = "The country is still empty. Choose the company's country to continue.";
const CURRENCY_MSG = "The currency is still empty. Choose the company's currency to continue.";

let latest: WizardState;
const remember = (s: WizardState) => {
  latest = s;
};

function Harness({
  submitEntity,
  next,
}: {
  submitEntity: () => Promise<{ ok: true }>;
  next: () => void;
}) {
  const [state, setState] = useState<WizardState>(initialState);
  useEffect(() => remember(state), [state]);
  return (
    <ToastProvider>
      <StepCreateEntity
        state={state}
        set={(patch) =>
          setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }))
        }
        next={next}
        submitEntity={submitEntity}
        saveAndExit={vi.fn()}
      />
    </ToastProvider>
  );
}

function renderStep() {
  const submitEntity = vi.fn(() => Promise.resolve({ ok: true as const }));
  const next = vi.fn();
  const view = render(<Harness submitEntity={submitEntity} next={next} />);
  const byId = (id: string) => view.container.querySelector<HTMLElement>(`#${id}`)!;
  return { ...view, submitEntity, next, byId };
}

const saveNext = () => screen.getByRole("button", { name: "Save & Next" });

async function chooseCountry(byId: (id: string) => HTMLElement, name: string) {
  await userEvent.click(byId("entity-country"));
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("StepCreateEntity -- empty on load", () => {
  it("shows Country and Currency empty, with their placeholders", async () => {
    const { byId } = renderStep();
    // Wait for the registries, so the empty value is not just "still loading".
    await screen.findByText("Phone Number", { exact: false });
    await waitFor(() => expect(latest.entity.country).toBe(""));
    expect(byId("entity-country")).toHaveValue("");
    expect(byId("entity-country")).toHaveAttribute("placeholder", "Select a country");
    expect(byId("entity-currency")).toHaveValue("");
    expect(byId("entity-currency")).toHaveAttribute("placeholder", "Select a currency");
    expect(screen.getByLabelText("Country code")).toHaveValue("");
  });

  it("marks the three required fields, but nothing is red before a submit", () => {
    const { byId, container } = renderStep();
    for (const id of ["entity-name", "entity-country", "entity-currency"]) {
      expect(byId(id)).toHaveAttribute("aria-required", "true");
      expect(byId(id)).not.toHaveAttribute("aria-invalid", "true");
      const label = container.querySelector(`label[for="${id}"]`)!;
      expect(label.querySelector(".req")).toHaveTextContent("*");
      expect(label.querySelector(".sr-only")).toHaveTextContent("(required)");
    }
    expect(container.querySelector(".field-error")).toBeNull();
    expect(container.querySelector(".error-summary")).toBeNull();
    expect(saveNext()).toBeEnabled();
  });

  it("keeps Save & Exit available with everything empty", () => {
    renderStep();
    expect(screen.getByRole("button", { name: "Save & Exit" })).toBeEnabled();
  });
});

describe("StepCreateEntity -- a refused Save & Next", () => {
  it("with only a name: both messages, red selects, and a focused summary linking to each", async () => {
    const { byId, submitEntity, next } = renderStep();
    await userEvent.type(byId("entity-name"), "Acme Ltd");
    await userEvent.click(saveNext());

    expect(submitEntity).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    const summary = screen.getByRole("alert");
    await waitFor(() => expect(summary).toHaveFocus());
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "#entity-country",
      "#entity-currency",
    ]);
    expect(links.map((a) => a.textContent)).toEqual([COUNTRY_MSG, CURRENCY_MSG]);
    expect(byId("entity-country-error")).toHaveTextContent(COUNTRY_MSG);
    expect(byId("entity-currency-error")).toHaveTextContent(CURRENCY_MSG);
    expect(byId("entity-country")).toHaveAttribute("aria-invalid", "true");
    expect(byId("entity-name")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(NAME_MSG)).not.toBeInTheDocument();

    // A summary link moves focus to its field.
    await userEvent.click(links[1]);
    expect(byId("entity-currency")).toHaveFocus();
  });

  it("with one field missing: no summary, and focus goes to that field", async () => {
    const { byId, container, submitEntity } = renderStep();
    await chooseCountry(byId, "Hong Kong SAR China");
    await userEvent.click(saveNext());

    expect(submitEntity).not.toHaveBeenCalled();
    expect(container.querySelector(".error-summary")).toBeNull();
    await waitFor(() => expect(byId("entity-name")).toHaveFocus());
    expect(byId("entity-name-error")).toHaveTextContent(NAME_MSG);
    expect(byId("entity-name")).toHaveAttribute("aria-describedby", "entity-name-error");
  });

  it("clears each message as soon as its field has a value", async () => {
    const { byId, container } = renderStep();
    await userEvent.click(saveNext());
    expect(screen.getAllByRole("link")).toHaveLength(3);

    await userEvent.type(byId("entity-name"), "A");
    expect(screen.queryByText(NAME_MSG, { selector: ".field-required" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);

    await chooseCountry(byId, "Singapore");
    expect(container.querySelector(".field-error")).toBeNull();
    expect(container.querySelector(".error-summary")).toBeNull();
  });
});

describe("StepCreateEntity -- choosing a country", () => {
  it("fills the currency and the phone code, and then saves", async () => {
    const { byId, submitEntity, next } = renderStep();
    await userEvent.type(byId("entity-name"), "Acme Ltd");
    await chooseCountry(byId, "Hong Kong SAR China");

    expect(latest.entity.country).toBe("HK");
    expect(latest.entity.currency).toBe("hkd-id");
    expect(byId("entity-currency")).toHaveValue("Hong Kong Dollar");
    expect(screen.getByLabelText("Country code")).toHaveValue("HK +852");

    await userEvent.click(saveNext());
    expect(submitEntity).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  });
});

const EMAIL_MSG = "That email address doesn't look right.";
const NAME_LONG_MSG = "Keep the company name to 100 characters or fewer.";
const emailInput = () => screen.getByPlaceholderText("Please enter your business email");

describe("StepCreateEntity -- a badly shaped business email", () => {
  it("waits for the field to be left, then says so and gives Save & Next's reason", async () => {
    const { container } = renderStep();
    await userEvent.type(emailInput(), "bob@acme");
    // Not finished yet: nothing said, nothing red, but the button is held.
    expect(screen.queryByText(EMAIL_MSG)).not.toBeInTheDocument();
    expect(container.querySelector(".field-error")).toBeNull();
    expect(saveNext()).toBeDisabled();

    await userEvent.tab();
    expect(screen.getByText(EMAIL_MSG)).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute("aria-invalid", "true");
    expect(saveNext()).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("Check the business email to continue.");
    expect(saveNext()).toHaveAttribute("aria-describedby", "entity-next-reason");
  });

  it("clears as soon as a valid address is typed", async () => {
    renderStep();
    await userEvent.type(emailInput(), "bob@acme");
    await userEvent.tab();
    expect(screen.getByText(EMAIL_MSG)).toBeInTheDocument();

    await userEvent.type(emailInput(), ".com");
    expect(screen.queryByText(EMAIL_MSG)).not.toBeInTheDocument();
    expect(emailInput()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(saveNext()).not.toHaveAttribute("aria-describedby");
    expect(saveNext()).toBeEnabled();
  });

  it("says nothing about an empty, optional email that was only visited", async () => {
    renderStep();
    await userEvent.click(emailInput());
    await userEvent.tab();
    expect(screen.queryByText(EMAIL_MSG)).not.toBeInTheDocument();
    expect(saveNext()).toBeEnabled();
  });
});

describe("StepCreateEntity -- the company name's length", () => {
  it("says so as it is typed past 100, holds Save & Next, and clears at 100", async () => {
    const { byId } = renderStep();
    await userEvent.click(byId("entity-name"));
    await userEvent.paste("a".repeat(100));
    expect(screen.queryByText(NAME_LONG_MSG)).not.toBeInTheDocument();
    expect(saveNext()).toBeEnabled();

    await userEvent.type(byId("entity-name"), "b");
    expect(byId("entity-name-error")).toHaveTextContent(NAME_LONG_MSG);
    expect(byId("entity-name")).toHaveAttribute("aria-invalid", "true");
    expect(byId("entity-name")).toHaveAttribute("aria-describedby", "entity-name-error");
    expect(saveNext()).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("Shorten the company name to continue.");
    expect(saveNext()).toHaveAttribute("aria-describedby", "entity-next-reason");

    await userEvent.type(byId("entity-name"), "{Backspace}");
    expect(screen.queryByText(NAME_LONG_MSG)).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(saveNext()).not.toHaveAttribute("aria-describedby");
    expect(saveNext()).toBeEnabled();
  });
});
