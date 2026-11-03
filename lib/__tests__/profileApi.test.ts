// The sidebar's My Profile reads (lib/profileApi.ts): through minty-onboarding-api's proxies,
// with the token the wizard holds - Flask's and subscription-api's CORS do not admit this origin.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setSidebarSession } from "@/components/ui/sidebarHost";
import { ONBOARDING_API_BASE } from "@/lib/apiRoutes";
import { loadSubscriptions, profileApi } from "@/lib/profileApi";

// The configured onboarding API, as urlFor reads it (CI may set ONBOARDING_API_URL).
const API = ONBOARDING_API_BASE;
const fetchMock = vi.fn();

const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setSidebarSession({
    token: "tok",
    entityId: "e1",
    entityName: "Olive & Vine",
    finished: false,
    viewer: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setSidebarSession(null);
});

describe("profileApi", () => {
  it("reads the profile through the onboarding API with the wizard's token", async () => {
    fetchMock.mockReturnValueOnce(answer(200, { user: { first_name: "Ann" }, entity: null }));
    const signal = new AbortController().signal;
    await expect(profileApi.load("", signal)).resolves.toEqual({
      user: { first_name: "Ann" },
      entity: null,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/onboarding/me/profile`);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.signal).toBe(signal);
  });

  it("names the company when there is one", async () => {
    fetchMock.mockReturnValueOnce(answer(200, { user: {}, entity: null }));
    await profileApi.load("e1", new AbortController().signal);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/onboarding/me/profile?entity=e1`);
  });

  it("saves only what changed, with PATCH", async () => {
    fetchMock.mockReturnValueOnce(answer(200, { user: { first_name: "Bo" }, entity: null }));
    await profileApi.save({ first_name: "Bo" }, "");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/onboarding/me/profile`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ first_name: "Bo" });
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("rejects a refusal as { status, message } with the backend's sentence", async () => {
    fetchMock.mockReturnValueOnce(answer(400, { error: "That email is already in use." }));
    await expect(profileApi.save({ email: "a@b.co" }, "")).rejects.toEqual({
      status: 400,
      message: "That email is already in use.",
    });
  });
});

describe("loadSubscriptions", () => {
  it("walks every page of the person's subscriptions", async () => {
    fetchMock
      .mockReturnValueOnce(answer(200, { entities: [{ modules: [] }], pages: 2 }))
      .mockReturnValueOnce(answer(200, { entities: [{ modules: [] }], pages: 2 }));
    const list = await loadSubscriptions(new AbortController().signal);
    expect(list.entities).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/api/onboarding/me/subscriptions?page=1&per_page=100`,
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${API}/api/onboarding/me/subscriptions?page=2&per_page=100`,
    );
  });
});
