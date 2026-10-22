// StepInvite -- the 9E choices (owner, 2026-10-19): the step says it is Optional, and offers
// three explicit moves - add people now, "+ Add another person", or "Skip for now".
//
// "Skip for now" moves on and sends NOTHING, whatever the rows hold; a half-filled row only
// refuses the primary "Send invitations", with Part 11 messages. The primary sends only
// complete rows (empty rows are ignored) and moves on once every one of them went out.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StepInvite } from "../OnboardingSteps";
import { ToastProvider } from "../Toast";
import type { InvitePayload, InviteResult } from "../../lib/api";
import type { StepProps, WizardState } from "../../lib/types";

function setup(invites: WizardState["invites"] = []) {
  const next = vi.fn();
  const submitInvite = vi.fn(async (p: InvitePayload): Promise<InviteResult> => ({
    ok: true,
    invitation: { ...p, id: "inv-" + p.email },
    emailSent: true,
  }));
  const seen = { invites };
  function Harness() {
    const [state, setState] = useState({ invites } as unknown as StepProps["state"]);
    seen.invites = state.invites;
    return (
      <ToastProvider>
        <StepInvite
          state={state}
          set={(patch) =>
            setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }))
          }
          next={next}
          back={vi.fn()}
          submitInvite={submitInvite}
          cancelInvite={vi.fn()}
          resendInvite={vi.fn()}
          saveAndExit={vi.fn()}
        />
      </ToastProvider>
    );
  }
  render(<Harness />);
  return { next, submitInvite, seen };
}

/** Close the arrival prompt so the page underneath can be used. */
const dismissPrompt = () => userEvent.click(screen.getByRole("button", { name: "Ok" }));
const fields = (n: number) => ({
  first: screen.getAllByLabelText(/First Name/)[n],
  last: screen.getAllByLabelText(/Last Name/)[n],
  email: screen.getAllByLabelText(/Email Address/)[n],
  role: screen.getAllByLabelText(/^Role/)[n],
});
async function fillRow(
  n: number,
  v: { first?: string; last?: string; email?: string; role?: string },
) {
  const f = fields(n);
  if (v.first) await userEvent.type(f.first, v.first);
  if (v.last) await userEvent.type(f.last, v.last);
  if (v.email) await userEvent.type(f.email, v.email);
  if (v.role) {
    await userEvent.click(f.role);
    await userEvent.click(screen.getByRole("option", { name: v.role }));
  }
}
const skip = () => screen.getByRole("button", { name: "Skip for now" });
const sendBtn = () => screen.getByRole("button", { name: /Send invitations/ });

describe("StepInvite choices (9E)", () => {
  it("says the step is optional beside the title", async () => {
    setup();
    await dismissPrompt();
    const title = screen.getByRole("heading", { name: "User Invite" });
    expect(title.parentElement).toHaveTextContent("Optional");
    expect(screen.getByText("Optional")).toHaveClass("pill-status");
  });

  it("offers Skip for now as a button, beside Save & Exit and the primary", async () => {
    setup();
    await dismissPrompt();
    expect(skip()).toHaveClass("btn");
    expect(skip()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save & Exit" })).toBeInTheDocument();
    // With nothing typed and nobody invited, the primary is held and says why.
    expect(sendBtn()).toBeDisabled();
    expect(sendBtn()).toHaveAccessibleDescription(/Add someone's details to send an invitation/);
  });

  it("Skip for now moves on and sends nothing, even with a half-filled row", async () => {
    const { next, submitInvite } = setup();
    await dismissPrompt();
    await fillRow(0, { first: "Ada", email: "ada@" });
    await userEvent.click(skip());
    expect(next).toHaveBeenCalledTimes(1);
    expect(submitInvite).not.toHaveBeenCalled();
  });

  it("+ Add another person adds a row, and a removed row goes away", async () => {
    setup();
    await dismissPrompt();
    expect(screen.getAllByLabelText(/First Name/)).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Add another person/ }));
    expect(screen.getAllByLabelText(/First Name/)).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Person 2" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove person 2" }));
    expect(screen.getAllByLabelText(/First Name/)).toHaveLength(1);
  });

  it("sends only the complete rows, ignores empty ones, then moves on", async () => {
    const { next, submitInvite, seen } = setup();
    await dismissPrompt();
    await fillRow(0, {
      first: "Ada",
      last: "Lovelace",
      email: "ada@example.com",
      role: "Accountant",
    });
    await userEvent.click(screen.getByRole("button", { name: /Add another person/ })); // left empty
    await userEvent.click(screen.getByRole("button", { name: /Add another person/ }));
    await fillRow(2, {
      first: "Alan",
      last: "Turing",
      email: "alan@example.com",
      role: "Shop Manager",
    });
    await userEvent.click(sendBtn());
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(submitInvite.mock.calls.map((c) => c[0])).toEqual([
      { email: "ada@example.com", role: "accountant", first_name: "Ada", last_name: "Lovelace" },
      { email: "alan@example.com", role: "shop_manager", first_name: "Alan", last_name: "Turing" },
    ]);
    expect(seen.invites.map((i) => i.email)).toEqual(["ada@example.com", "alan@example.com"]);
  });

  it("a half-filled row refuses the send, says what is missing, and sends nothing", async () => {
    const { next, submitInvite } = setup();
    await dismissPrompt();
    await fillRow(0, { first: "Ada", last: "Lovelace", email: "ada@example.com" });
    // Untouched, the empty Role is not painted red while typing.
    expect(screen.queryByText(/The role is still empty/)).not.toBeInTheDocument();
    await userEvent.click(sendBtn());
    expect(submitInvite).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(
      screen.getByText("The role is still empty. Choose their role to send this invitation."),
    ).toBeInTheDocument();
    // One problem: focus goes to that field.
    await waitFor(() => expect(fields(0).role).toHaveFocus());
    // The message clears the moment the field has a value.
    await userEvent.click(fields(0).role);
    await userEvent.click(screen.getByRole("option", { name: "Admin" }));
    expect(screen.queryByText(/The role is still empty/)).not.toBeInTheDocument();
  });

  it("two or more problems raise the error summary", async () => {
    setup();
    await dismissPrompt();
    await fillRow(0, { first: "Ada" });
    await userEvent.click(sendBtn());
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("3 details need a look");
    expect(summary).toHaveTextContent("The last name is still empty.");
    expect(summary).toHaveTextContent("The email address is still empty.");
  });

  it("checks the email format once the field is left, then as it is typed", async () => {
    setup();
    await dismissPrompt();
    await userEvent.type(fields(0).email, "ada@exa");
    expect(screen.queryByText(/isn't complete yet/)).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText(/This email address isn't complete yet/)).toBeInTheDocument();
    await userEvent.type(fields(0).email, "mple.com");
    expect(screen.queryByText(/isn't complete yet/)).not.toBeInTheDocument();
  });

  it("with people already invited and nothing typed, the primary is Continue", async () => {
    const { next, submitInvite } = setup([
      { id: "i1", first: "Ada", last: "Lovelace", email: "ada@example.com", role: "accountant" },
    ]);
    await dismissPrompt();
    expect(screen.queryByRole("button", { name: "Skip for now" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(next).toHaveBeenCalledTimes(1);
    expect(submitInvite).not.toHaveBeenCalled();
  });

  it("keeps a row that failed to send, and stays on the step", async () => {
    const { next, submitInvite } = setup();
    submitInvite.mockResolvedValueOnce({ ok: true, invitation: undefined, emailSent: false });
    await dismissPrompt();
    await fillRow(0, { first: "Ada", last: "Lovelace", email: "ada@example.com", role: "Admin" });
    await userEvent.click(sendBtn());
    await waitFor(() => expect(submitInvite).toHaveBeenCalledTimes(1));
    expect(next).not.toHaveBeenCalled();
    expect(fields(0).email).toHaveValue("ada@example.com");
  });
});
