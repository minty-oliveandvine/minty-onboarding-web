/**
 * The sidebar's My Profile, for the packaged panel and card (`@minty/shared/profile`): the
 * person's profile (Flask's `GET` / `PATCH /api/me/profile`) and their Subscriptions Overview
 * (subscription-api's `GET /api/me/subscriptions`, every page walked).
 *
 * Both go through minty-onboarding-api's proxies (`/api/onboarding/me/*`), not to Flask or
 * subscription-api directly: their CORS does not admit this origin, and the browser talks to one
 * base URL, as `lib/billing.ts` does. The token is the wizard's, read from the sidebar's session
 * (components/ui/sidebarHost.ts).
 *
 * A refusal rejects with `{ status, message }` (the package's `ProfileRefusal`): the backend's
 * sentence, shown as it stands. Module-level on purpose: the panel and the card read again
 * whenever `api` / `load` change identity.
 */

import type { Profile, ProfileApi, ProfileChanges, SubscriptionsList } from "@minty/shared/profile";

import { sidebarHost } from "@/components/ui/sidebarHost";
import { HOUSE_FALLBACK } from "@/lib/errorCopy";
import { urlFor } from "@/lib/apiRoutes";

const PROFILE = "/api/onboarding/me/profile";
const SUBSCRIPTIONS = "/api/onboarding/me/subscriptions";

/** The most subscription-api answers in one page (minty-web's `MAX_PER_PAGE`). */
const PER_PAGE = 100;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(urlFor(path), {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${sidebarHost.currentToken()}`,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof body?.error === "string" ? body.error : HOUSE_FALLBACK;
    throw { status: res.status, message };
  }
  return body as T;
}

const withEntity = (entityId: string) =>
  entityId ? `${PROFILE}?${new URLSearchParams({ entity: entityId })}` : PROFILE;

export const profileApi: ProfileApi = {
  load: (entityId, signal) => call<Profile>(withEntity(entityId), { signal }),
  save: (changes: ProfileChanges, entityId) =>
    call<Profile>(withEntity(entityId), { method: "PATCH", body: JSON.stringify(changes) }),
};

type Page = SubscriptionsList & { pages: number };

const page = (n: number, signal: AbortSignal) =>
  call<Page>(
    `${SUBSCRIPTIONS}?${new URLSearchParams({ page: String(n), per_page: String(PER_PAGE) })}`,
    {
      signal,
    },
  );

export async function loadSubscriptions(signal: AbortSignal): Promise<SubscriptionsList> {
  const first = await page(1, signal);
  const entities = [...first.entities];
  for (let n = 2; n <= first.pages; n++) entities.push(...(await page(n, signal)).entities);
  return { entities };
}
