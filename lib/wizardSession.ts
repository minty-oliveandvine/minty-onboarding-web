// Where the wizard's in-progress state lives in the browser, and how the launch token is
// read. Extracted verbatim from OnboardingApp -- no behaviour changed.
//
// THE BROWSER IS A CACHE, NOT THE SOURCE OF TRUTH. The `entities` row is; GET /state
// reconstructs the whole picture from it, which is what makes a cold resume work in a new
// browser, incognito, or on another device. Everything here is an optimisation on top of
// that, and losing all of it costs a round trip, not the user's progress.

import type { WizardState, WizardUser } from './types';

// Scoped only to the Xero OAuth round-trip: we stash progress here right
// before leaving for Xero and restore it on return. Cleared immediately after,
// so it does NOT persist across an ordinary refresh.
export const XERO_RESUME_KEY = 'minty_onboarding_xero_resume';

/** What OnboardingApp writes under a session key. `savedAt` orders competing blobs.
 * `token` is only ever READ here, from blobs written before 2026-10-05: the token now lives
 * in this tab's sessionStorage (`TAB_TOKEN_KEY`), never in localStorage. */
export type SavedSession = {
  current?: number;
  maxReached?: number;
  state: WizardState;
  token?: string;
  user?: WizardUser;
  savedAt: number;
};

// The launch token is a bearer credential for the onboarding API. localStorage kept it for
// every tab and after the browser closed; sessionStorage keeps it to this tab only.
export const TAB_TOKEN_KEY = 'minty_onboarding_token';

export function readTabToken(): string {
  try {
    return window.sessionStorage.getItem(TAB_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Store the token for this tab. An empty token is ignored rather than clearing it: the
 * wizard's first render (and StrictMode's second effect pass) persists before the token
 * state is set. Finishing onboarding removes it explicitly. */
export function writeTabToken(token: string): void {
  if (!token) return;
  try {
    window.sessionStorage.setItem(TAB_TOKEN_KEY, token);
  } catch {
    /* storage blocked: the token lives in memory for this page only */
  }
}

// Everything a launch, resume or Xero return can put in the address bar.
const LAUNCH_PARAMS = [
  'token',
  'entity_id',
  'entity_name',
  'entity',
  'first',
  'last',
  'name',
  'fresh',
  'profile_url',
  'xero',
  'step',
  'org',
  'expected',
  'conflict',
  'conflict_entity',
];

let launchParams: URLSearchParams | null = null;

/**
 * The launch parameters, read once - and taken OUT of the address bar before anything
 * else runs, so the token never sits in history, in a bookmark, or in the URL any
 * third-party script on the page (Stripe) can see.
 */
export function takeLaunchParams(): URLSearchParams {
  // Cached: StrictMode runs the init effect twice, and the second run must see what the
  // first one took out of the address bar.
  if (launchParams) return launchParams;
  const params = new URLSearchParams(window.location.search);
  launchParams = params;
  if (LAUNCH_PARAMS.some((key) => params.has(key))) {
    const url = new URL(window.location.href);
    LAUNCH_PARAMS.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  return params;
}

export const STORAGE_KEY = 'minty_onboarding_session';

// Session storage is keyed per entity so multiple in-progress entities don't
// clobber each other. Before an entity is created it has no id yet, so its
// draft lives under the bare global key; once `submitEntity` assigns an id,
// writes move to `minty_onboarding_session:<id>` and the bare draft is cleared.
export const sessionKey = (entityId?: string | null): string =>
  entityId ? `${STORAGE_KEY}:${entityId}` : STORAGE_KEY;

// On a plain refresh the URL carries no entity_id, so we can't look up the
// per-entity session key directly. Scan localStorage for every
// `minty_onboarding_session:<id>` blob and return the most recently saved one
// (by `savedAt`). This is what makes an ordinary refresh restore progress
// instead of resetting to the empty initial state.
export const findLatestSession = (): SavedSession | null => {
  if (typeof window === 'undefined') return null;
  let best: SavedSession | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${STORAGE_KEY}:`)) continue;
      let blob: Partial<SavedSession> | null = null;
      try {
        blob = JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch {
        continue;
      }
      if (!blob || !blob.state) continue;
      const ts = typeof blob.savedAt === 'number' ? blob.savedAt : 0;
      if (!best || ts > best.savedAt) best = { ...blob, state: blob.state, savedAt: ts };
    }
  } catch {
    return null;
  }
  return best;
};

// No signature verification — client-side cache invalidation only.
export function readJwtClaims(
  token?: string | null,
): { user_id: string | null; exp: number } | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (padded.length % 4)) % 4);
    const payload = JSON.parse(atob(padded + padding));
    return { user_id: payload.user_id || null, exp: payload.exp || 0 };
  } catch {
    return null;
  }
}
