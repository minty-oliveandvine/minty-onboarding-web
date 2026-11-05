// The "Talk to Minty" cat in the wizard: drawn by @minty/shared/contact inside the sidebar shell,
// it sends through minty-onboarding-api's `/api/onboarding/me/contact` proxy (Flask's CORS does
// not admit this origin) with the wizard's token, and confirms with the app's toast.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { ToastProvider } from "@/components/Toast";
import { SidebarShell } from "@/components/ui/SidebarShell";
import { setSidebarSession } from "@/components/ui/sidebarHost";
import { ONBOARDING_API_BASE } from "@/lib/apiRoutes";

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

function show() {
  render(
    <ToastProvider>
      <SidebarShell>
        <p>The wizard</p>
      </SidebarShell>
    </ToastProvider>,
  );
}

async function writeAndSend() {
  await userEvent.click(await screen.findByRole("button", { name: "Talk to Minty" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Talk to Minty" }));
  const chat = within(screen.getByRole("dialog", { name: "Talk to Minty" }));
  await userEvent.click(chat.getByRole("button", { name: "Contact Support" }));
  // the chat asks one thing at a time; each is sent as its own answer
  for (const [label, value] of [
    ["Your name", "Olive Vine"],
    ["Your email", "olive@test.com"],
    ["Your company", "Olive Tree Cafe"],
  ]) {
    await userEvent.type(chat.getByLabelText(label), value);
    await userEvent.click(chat.getByRole("button", { name: "Send answer" }));
  }
  await userEvent.click(chat.getByRole("button", { name: "Getting started" }));
  await userEvent.type(chat.getByLabelText("Your message"), "Which plan fits a café?");
  await userEvent.click(chat.getByRole("button", { name: "Send answer" }));
  await userEvent.click(chat.getByRole("button", { name: "Send" }));
  return chat;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setSidebarSession({
    token: "tok",
    entityId: "360812e1-9f94-46a3-aa31-347e21afde8e",
    entityName: "Olive & Vine",
    finished: false,
    viewer: { name: "Ann Lee", initials: "AL" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setSidebarSession(null);
});

describe("the Minty cat in onboarding", () => {
  it("sends through the onboarding API's proxy with the wizard's token, then toasts", async () => {
    fetchMock.mockImplementation(() => json({ sent: true, reply_to: "ann@example.com" }));
    show();
    const chat = await writeAndSend();

    expect(await chat.findByText(/Sent! We'll reply to ann@example.com/)).toBeInTheDocument();
    expect(await screen.findByText("Message sent. We'll reply by email.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/onboarding/me/contact"),
    )!;
    expect(String(url)).toBe(`${ONBOARDING_API_BASE}/api/onboarding/me/contact`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
    // before "All Set" the wizard names no company to the menu, nor here
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Olive Vine",
      email: "olive@test.com",
      company: "Olive Tree Cafe",
      topic: "Getting started",
      message: "Which plan fits a café?",
      app: "minty-onboarding-web",
    });
  });

  it("offers the account's email, read through the profile proxy only once Contact Support opens", async () => {
    fetchMock.mockImplementation((input) =>
      json(
        String(input).includes("/api/onboarding/me/profile")
          ? { user: { name: "Ann Lee", initials: "AL", email: "ann@example.com" } }
          : { sent: true, reply_to: "ann@example.com" },
      ),
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Talk to Minty" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Talk to Minty" }));
    const chat = within(screen.getByRole("dialog", { name: "Talk to Minty" }));
    // the wizard reads nothing for the chat until it is needed
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(chat.getByRole("button", { name: "Contact Support" }));
    await userEvent.click(chat.getByRole("button", { name: "Ann Lee" }));
    await userEvent.click(await chat.findByRole("button", { name: "ann@example.com" }));
    expect(chat.getByText("Which company is this about?")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${ONBOARDING_API_BASE}/api/onboarding/me/profile`);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("shows the backend's refusal in the chat", async () => {
    fetchMock.mockImplementation(() =>
      json({ error: "That's a lot of messages in one hour. Try again later." }, 429),
    );
    show();
    const chat = await writeAndSend();
    expect(
      await chat.findByText("That's a lot of messages in one hour. Try again later."),
    ).toBeInTheDocument();
  });
});
