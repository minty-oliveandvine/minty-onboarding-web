// This app's sidebar host (../sidebarHost.ts): where the menu leads FROM onboarding, and the
// company it reports - none until "All Set", so the menu shows no module or Settings before then.

import { afterEach, describe, expect, it, vi } from "vitest";

import { _setNavigateForTests, setSidebarSession, sidebarHost } from "@/components/ui/sidebarHost";
import { FLASK_BASE } from "@/lib/flaskBase";

const ENTITY = "360812e1-9f94-46a3-aa31-347e21afde8e";
// The configured Flask, as the host reads it (CI sets PETTY_CASH_URL to its stack layout).
const FLASK = FLASK_BASE;
const HANDOFF = `${FLASK}/handoff/minty-web`;

const session = (finished: boolean) =>
  setSidebarSession({
    token: "tok",
    entityId: ENTITY,
    entityName: "Olive & Vine",
    finished,
    viewer: { name: "Ann Lee", initials: "AL" },
  });

afterEach(() => {
  setSidebarSession(null);
  _setNavigateForTests(null);
});

describe("the company the menu sees", () => {
  it("is none while onboarding is under way", () => {
    session(false);
    expect(sidebarHost.entityId()).toBe("");
    expect(sidebarHost.entityName()).toBe("");
  });

  it("is the new company once onboarding is finished", () => {
    session(true);
    expect(sidebarHost.entityId()).toBe(ENTITY);
    expect(sidebarHost.entityName()).toBe("Olive & Vine");
  });

  it("is none with no session at all", () => {
    expect(sidebarHost.entityId()).toBe("");
    expect(sidebarHost.currentToken()).toBe("");
  });
});

describe("the menu's links", () => {
  it("reaches the entity list and subscriptions through Flask, and has no profile link", () => {
    session(false);
    expect(sidebarHost.links.entities()).toBe(`${FLASK}/entity`);
    const subscriptions = new URL(sidebarHost.links.subscriptions());
    expect(subscriptions.origin + subscriptions.pathname).toBe(HANDOFF);
    expect(subscriptions.searchParams.get("next")).toBe("/subscription");
    // Before "All Set" no company is named.
    expect(subscriptions.searchParams.get("entity_id")).toBeNull();
    // My Profile opens only in the sidebar (@minty/shared v0.12)
    expect("profile" in sidebarHost.links).toBe(false);
  });

  it("enters the finished company's modules with the token it holds", () => {
    session(true);
    const dashboard = new URL(sidebarHost.links.pettyCashDashboard());
    expect(dashboard.pathname).toBe(`/entity/${ENTITY}/enter`);
    expect(dashboard.searchParams.get("token")).toBe("tok");
    expect(dashboard.searchParams.get("next")).toBeNull();
    const reports = new URL(sidebarHost.links.pettyCashReports(ENTITY));
    expect(reports.pathname).toBe(`/entity/${ENTITY}/enter`);
    expect(reports.searchParams.get("next")).toBe(`/entity/${ENTITY}/petty-cash/reports`);
    expect(new URL(sidebarHost.links.bills()).pathname).toBe(`/entity/${ENTITY}/payment-request`);
    const settings = new URL(sidebarHost.links.settings());
    expect(settings.origin + settings.pathname).toBe(HANDOFF);
    expect(settings.searchParams.get("next")).toBe(
      "/entity/360812e1/olive-and-vine/settings/modules",
    );
    expect(settings.searchParams.get("entity_id")).toBe(ENTITY);
  });

  it("has no page of its own to mark as current", () => {
    expect(sidebarHost.currentOf("/")).toBeNull();
  });
});

describe("the person", () => {
  it("is the one the wizard already knows - no read of its own", async () => {
    session(false);
    await expect(sidebarHost.loadViewer()).resolves.toEqual({ name: "Ann Lee", initials: "AL" });
  });
});

describe("logging out", () => {
  it("closes the menu, forgets the session and ends it at Flask", () => {
    session(true);
    const go = vi.fn();
    const leaving = vi.fn();
    _setNavigateForTests(go);
    sidebarHost.logOut(leaving);
    expect(leaving).toHaveBeenCalledOnce();
    expect(sidebarHost.currentToken()).toBe("");
    expect(go).toHaveBeenCalledWith(`${FLASK}/logout`);
  });
});
