// The header's ≡ and initials - the packaged sidebar (@minty/shared/sidebar, through components/ui)
// in the classic look, as the other apps draw it on development. What this app decides is the
// company it reports (none until "All Set", so the modules and Settings wait for step 9) and that
// My Profile is the sidebar's second view, never a page (owner, 2026-11-03).

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../Toast";
import { NavMenu, ViewerBadge } from "../ui/NavMenu";
import { SidebarShell } from "../ui/SidebarShell";
import { setSidebarSession } from "../ui/sidebarHost";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const VIEWER = { name: "Ann Lee", initials: "AL" };
const PROFILE = {
  user: {
    first_name: "Ann",
    last_name: "Lee",
    email: "ann@example.com",
    name: "Ann Lee",
    initials: "AL",
  },
  entity: null,
};

const fetchMock = vi.fn((url: string) =>
  Promise.resolve(
    new Response(
      JSON.stringify(url.includes("/me/subscriptions") ? { entities: [], pages: 1 } : PROFILE),
      { status: 200 },
    ),
  ),
);

function renderHeader(finished: boolean) {
  setSidebarSession({
    token: "tok",
    entityId: "360812e1-9f94-46a3-aa31-347e21afde8e",
    entityName: "Olive & Vine",
    finished,
    viewer: VIEWER,
  });
  render(
    <ToastProvider>
      <SidebarShell>
        <ViewerBadge viewer={VIEWER} />
        <NavMenu modules={{ pettyCash: true, billing: true }} viewer={VIEWER} />
      </SidebarShell>
    </ToastProvider>,
  );
}

async function openMenu(finished: boolean) {
  renderHeader(finished);
  await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  return screen.getByRole("navigation", { name: "Main navigation" });
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));

afterEach(() => {
  setSidebarSession(null);
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

describe("the header's menu", () => {
  it("opens the shared menu with the person, the entity list, subscriptions and Logout", async () => {
    const nav = await openMenu(false);
    expect(within(nav).getByRole("button", { name: "Ann Lee, My Profile" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Select Entity/ })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Manage subscriptions/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Logout/ })).toBeInTheDocument();
  });

  it("shows no module or Settings while onboarding is under way", async () => {
    const nav = await openMenu(false);
    expect(within(nav).queryByRole("group", { name: "Petty Cash" })).toBeNull();
    expect(within(nav).queryByRole("group", { name: "Payment Request" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /Settings/ })).toBeNull();
  });

  it("shows the company's modules and Settings on All Set", async () => {
    const nav = await openMenu(true);
    expect(within(nav).getByRole("group", { name: "Petty Cash" })).toBeInTheDocument();
    expect(within(nav).getByRole("group", { name: "Payment Request" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Settings/ })).toBeInTheDocument();
  });
});

describe("My Profile opens in the sidebar", () => {
  it("from the menu's name", async () => {
    const nav = await openMenu(false);
    await userEvent.click(within(nav).getByRole("button", { name: "Ann Lee, My Profile" }));
    expect(await screen.findByRole("region", { name: "My Profile" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8030/api/onboarding/me/profile");
  });

  it("from the header's initials", async () => {
    renderHeader(false);
    await userEvent.click(screen.getByRole("button", { name: "Ann Lee, My Profile" }));
    expect(await screen.findByRole("region", { name: "My Profile" })).toBeInTheDocument();
  });
});
