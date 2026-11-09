// The URL security round (2026-10-05): the launch token leaves the address bar at once and
// lives in this tab's sessionStorage only. (Sign-in's own handover moved to minty-web with
// sign-in, phase 2: features/auth/lib/handover.ts there.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("takeLaunchParams", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads the launch parameters and clears them from the address bar", async () => {
    window.history.replaceState(null, "", "/?token=abc.def.ghi&entity_id=e1&fresh=1&keep=1#top");
    const { takeLaunchParams } = await import("@/lib/wizardSession");

    const params = takeLaunchParams();

    // gap 4: a token in the address is taken out and never used
    expect(params.get("token")).toBeNull();
    expect(params.get("entity_id")).toBe("e1");
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#top");
  });

  it("takes the one-time launch code out of the address bar too (gap 4)", async () => {
    window.history.replaceState(null, "", "/?code=c0de.sig&entity_id=e1");
    const { takeLaunchParams } = await import("@/lib/wizardSession");

    expect(takeLaunchParams().get("code")).toBe("c0de.sig");
    expect(window.location.search).toBe("");
  });

  it("answers the same on a second call (StrictMode runs the init effect twice)", async () => {
    window.history.replaceState(null, "", "/?token=t1&xero=connected&org=Acme");
    const { takeLaunchParams } = await import("@/lib/wizardSession");

    takeLaunchParams();
    const again = takeLaunchParams();

    expect(again.get("token")).toBeNull();
    expect(again.get("org")).toBe("Acme");
    expect(window.location.search).toBe("");
  });
});

describe("the tab token", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("is kept in sessionStorage, never localStorage", async () => {
    const { readTabToken, writeTabToken, TAB_TOKEN_KEY } = await import("@/lib/wizardSession");

    writeTabToken("tok");

    expect(readTabToken()).toBe("tok");
    expect(window.sessionStorage.getItem(TAB_TOKEN_KEY)).toBe("tok");
    expect(window.localStorage.length).toBe(0);
  });

  it("is not cleared by an empty write (the first render persists before the token is set)", async () => {
    const { readTabToken, writeTabToken } = await import("@/lib/wizardSession");

    writeTabToken("tok");
    writeTabToken("");

    expect(readTabToken()).toBe("tok");
  });
});
