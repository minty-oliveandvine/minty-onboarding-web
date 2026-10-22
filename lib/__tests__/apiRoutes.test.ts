// lib/apiRoutes -- the switch that decides which service answers each path during
// the Flask -> Django onboarding extraction.
//
// This supersedes scripts/check-routes.mjs, which was written when the repo had no
// test runner. The cases below are its 39 plus the ones a standalone script could
// not express.
//
// Two properties matter most, and neither is obvious from reading the list:
//
//   * /invite and /invite/cancel are INDEPENDENT. Prefix matching would tie them
//     together, so reverting one would silently revert the other.
//   * An UNLISTED /api/onboarding/* path falls through to Flask. Unknown means "not
//     verified here", and the safe answer is the service that has always served it.
//
// The module reads its base URLs at import time, so every case goes through
// `loadRoutes()` rather than a static import -- a top-level import would bind
// whatever the ambient environment happened to hold.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DJANGO = 'https://django.example';
const FLASK = 'https://flask.example';

async function loadRoutes() {
  vi.resetModules();
  vi.stubEnv('PETTY_CASH_URL', FLASK);
  vi.stubEnv('ONBOARDING_API_URL', DJANGO);
  return import('../apiRoutes');
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

// Every path the wizard actually calls, taken from the components.
const TO_DJANGO = [
  // Reference data
  '/api/onboarding/server-time',
  '/api/onboarding/currencies',
  '/api/onboarding/countries',
  '/api/onboarding/plans',
  // Wizard state
  '/api/onboarding/state?entity_id=abc-123',
  '/api/onboarding/saved-step',
  // The company
  '/api/onboarding/create',
  '/api/onboarding/entity/2749a5a2-5a9f-482a-97df-af2b6a5ac0e6',
  // Petty-cash config
  '/api/onboarding/sales-methods',
  '/api/onboarding/sales-methods?entity_id=abc',
  '/api/onboarding/opening-balance',
  // Invites -- GET and cancel are implemented in Django, POST /invite is a proxy
  '/api/onboarding/invite',
  '/api/onboarding/invite?entity_id=abc',
  '/api/onboarding/invite/cancel',
  '/api/onboarding/invite/resend',
  // Proxied through the Django service, but still addressed at it
  '/api/onboarding/account-codes',
  '/api/onboarding/account-codes?entity_id=abc',
  '/api/onboarding/contacts',
  '/api/onboarding/contacts/create',
  '/api/onboarding/bill-codes',
  '/api/onboarding/bill-codes?entity_id=abc',
  '/api/onboarding/modules',
  '/api/onboarding/payment-method?entity_id=abc',
  '/api/onboarding/billing/payment-methods',
  '/api/onboarding/billing/payment-methods/setup-intent',
  '/api/onboarding/billing/payment-methods/confirm',
  '/api/onboarding/billing/payment-methods/default',
  '/api/onboarding/billing/accounts',
  '/api/onboarding/billing/authorize',
  '/api/onboarding/finalize',
  '/api/onboarding/xero/disconnect',
  '/api/onboarding/xero/release',
];

// Flask pages and Flask auth -- not part of the extraction.
const TO_FLASK = [
  '/entity',
  '/logout',
  '/xero_connect?from=onboarding',
];

describe('urlFor', () => {
  it.each(TO_DJANGO)('routes %s to the onboarding service', async (path) => {
    const { urlFor } = await loadRoutes();
    expect(urlFor(path)).toBe(DJANGO + path);
  });

  it.each(TO_FLASK)('keeps %s on Flask', async (path) => {
    const { urlFor } = await loadRoutes();
    expect(urlFor(path)).toBe(FLASK + path);
  });
});

describe('the list itself', () => {
  it('has a case above for every path the module claims to answer', async () => {
    // Guards the direction a list of cases cannot: someone adds a line to
    // DJANGO_PATHS and no test notices it went unverified.
    const { baseFor } = await loadRoutes();
    // Resolved from the vitest root rather than import.meta.url: vite rewrites
    // import.meta.url to a non-file scheme, which readFile refuses.
    const source = await readFile(join(process.cwd(), 'lib', 'apiRoutes.ts'), 'utf8');
    const block = source.split('const DJANGO_PATHS = [')[1].split('];')[0];
    const declared = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(20);

    const covered = TO_DJANGO.map((p) => p.split('?')[0].split('/'));
    for (const pattern of declared) {
      const segments = pattern.split('/');
      expect(baseFor(pattern.replace(/:[^/]+/g, 'x')), pattern + ' does not route to Django').toBe(
        DJANGO,
      );
      const hit = covered.some(
        (path) =>
          path.length === segments.length &&
          segments.every((s, i) => s.startsWith(':') || s === path[i]),
      );
      expect(hit, pattern + ' is declared but no case above exercises it').toBe(true);
    }
  });
});

describe('the properties the list alone does not show', () => {
  it('matches per segment, so /invite and /invite/cancel are independent', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/invite')).toBe(DJANGO);
    expect(baseFor('/api/onboarding/invite/cancel')).toBe(DJANGO);
    // And the segment rule is what keeps them apart: a deeper path that is NOT
    // listed does not inherit /invite's decision.
    expect(baseFor('/api/onboarding/invite/not-listed')).toBe(FLASK);
  });

  it('falls through to Flask for an unlisted onboarding path', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/not-a-real-endpoint')).toBe(FLASK);
  });

  it('does not let a longer path prefix-match a shorter listed one', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/state/extra')).toBe(FLASK);
    expect(baseFor('/api/onboarding/statement')).toBe(FLASK);
  });

  it('ignores the query string and the fragment when deciding', async () => {
    const { baseFor, urlFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/state?entity_id=abc#frag')).toBe(DJANGO);
    // ...and urlFor puts them back untouched.
    expect(urlFor('/api/onboarding/state?a=1&b=2')).toBe(DJANGO + '/api/onboarding/state?a=1&b=2');
  });

  it('matches :entityId against exactly one segment', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/entity/abc')).toBe(DJANGO);
    expect(baseFor('/api/onboarding/entity/abc/def')).toBe(FLASK);
    expect(baseFor('/api/onboarding/entity')).toBe(FLASK);
  });

  it('strips a trailing slash from either base URL', async () => {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', FLASK + '/');
    vi.stubEnv('ONBOARDING_API_URL', DJANGO + '/');
    const { urlFor } = await import('../apiRoutes');
    // Without the strip these come out with a doubled slash, which some proxies 404
    // and others silently redirect -- losing the request body on a POST.
    expect(urlFor('/api/onboarding/state')).toBe(DJANGO + '/api/onboarding/state');
    expect(urlFor('/entity')).toBe(FLASK + '/entity');
  });

  it('defaults the onboarding base to localhost:8030 when unset', async () => {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', FLASK);
    vi.stubEnv('ONBOARDING_API_URL', '');
    const { ONBOARDING_API_BASE } = await import('../apiRoutes');
    // The port its docker service and `manage.py runserver` both use.
    expect(ONBOARDING_API_BASE).toBe('http://localhost:8030');
  });

  it('defaults the Petty Cash base to localhost:8000 when unset', async () => {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', '');
    vi.stubEnv('ONBOARDING_API_URL', DJANGO);
    const { urlFor } = await import('../apiRoutes');
    // Flask's local port in the owner's layout (2026-10-16, Documents\dev.ps1).
    expect(urlFor('/entity')).toBe('http://localhost:8000/entity');
  });

  it('inserts a slash for a path given without a leading one', async () => {
    const { urlFor } = await loadRoutes();
    expect(urlFor('entity')).toBe(FLASK + '/entity');
  });

  it('handles an empty or nullish path without throwing', async () => {
    const { urlFor } = await loadRoutes();
    expect(urlFor('')).toBe(FLASK + '/');
    expect(urlFor(null)).toBe(FLASK + '/');
    expect(urlFor(undefined)).toBe(FLASK + '/');
  });
});

describe('the base URLs (envUrl, @minty/shared/env)', () => {
  // Pinned before the base URLs moved to @minty/shared/env's envUrl (the shared-code
  // refactor, 2026-10-21; lib/flaskBase.ts folded in here). The cases marked with the owner's
  // date are deliberate changes: both bases are now trimmed, lose EVERY trailing slash, fall
  // back when blank, and a production build throws when one is unset.

  async function load(petty: string | undefined, onboarding: string | undefined) {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', petty);
    vi.stubEnv('ONBOARDING_API_URL', onboarding);
    return import('../apiRoutes');
  }

  it('uses PETTY_CASH_URL as given', async () => {
    const { FLASK_BASE } = await load('https://accounts-api.dailyminty.com', DJANGO);
    expect(FLASK_BASE).toBe('https://accounts-api.dailyminty.com');
  });

  it('defaults the Petty Cash base to localhost:8000 when unset or empty', async () => {
    expect((await load(undefined, DJANGO)).FLASK_BASE).toBe('http://localhost:8000');
    expect((await load('', DJANGO)).FLASK_BASE).toBe('http://localhost:8000');
  });

  it('keeps a path prefix, minus its trailing slashes', async () => {
    expect((await load('https://flask.example/base//', DJANGO)).FLASK_BASE).toBe(
      'https://flask.example/base',
    );
  });

  it('strips EVERY trailing slash from the onboarding base', async () => {
    // owner 2026-10-21: one shared module (@minty/shared/env). Was: only one ("https://django.example/").
    const { ONBOARDING_API_BASE, urlFor } = await load(FLASK, DJANGO + '//');
    expect(ONBOARDING_API_BASE).toBe(DJANGO);
    expect(urlFor('/api/onboarding/state')).toBe(DJANGO + '/api/onboarding/state');
  });

  it('trims whitespace from both bases', async () => {
    // owner 2026-10-21: one shared module (@minty/shared/env). Was: neither trimmed, and a trailing space hid the slash from the strip.
    const { ONBOARDING_API_BASE, FLASK_BASE } = await load(' ' + FLASK + '/ ', ' ' + DJANGO + ' ');
    expect(ONBOARDING_API_BASE).toBe(DJANGO);
    expect(FLASK_BASE).toBe(FLASK);
  });

  it('falls back for a blank or slash-only value', async () => {
    // owner 2026-10-21: one shared module (@minty/shared/env). Was: "   " stood as the base, and "/" became "".
    expect((await load('   ', '   ')).FLASK_BASE).toBe('http://localhost:8000');
    expect((await load('/', '/')).FLASK_BASE).toBe('http://localhost:8000');
    expect((await load('/', '/')).ONBOARDING_API_BASE).toBe('http://localhost:8030');
  });

  it('throws in a production build when a base is unset', async () => {
    // owner 2026-10-21: one shared module (@minty/shared/env). Was: a silent localhost fallback.
    vi.stubEnv('NODE_ENV', 'production');
    await expect(load('', DJANGO)).rejects.toThrow('PETTY_CASH_URL is not set');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(load(FLASK, '')).rejects.toThrow('ONBOARDING_API_URL is not set');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await load(FLASK, DJANGO)).urlFor('/entity')).toBe(FLASK + '/entity');
  });

  it('strips EVERY trailing slash from the Flask base', async () => {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', FLASK + '///');
    vi.stubEnv('ONBOARDING_API_URL', DJANGO);
    const { urlFor } = await import('../apiRoutes');
    expect(urlFor('/entity')).toBe(FLASK + '/entity');
  });

  it('exports ONBOARDING_API_BASE as the stripped value', async () => {
    vi.resetModules();
    vi.stubEnv('PETTY_CASH_URL', FLASK);
    vi.stubEnv('ONBOARDING_API_URL', DJANGO + '/');
    const { ONBOARDING_API_BASE } = await import('../apiRoutes');
    expect(ONBOARDING_API_BASE).toBe(DJANGO);
  });

  it('answers a listed path on Django and anything else on Flask, nullish included', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/plans')).toBe(DJANGO);
    expect(baseFor('/legal/current')).toBe(FLASK);
    expect(baseFor('')).toBe(FLASK);
    expect(baseFor(null)).toBe(FLASK);
    expect(baseFor(undefined)).toBe(FLASK);
  });

  it('routes by exact segments: a trailing slash on a listed path goes to Flask', async () => {
    const { baseFor } = await loadRoutes();
    expect(baseFor('/api/onboarding/plans/')).toBe(FLASK);
  });

  it('does not prepend a slash to a full URL, so it is glued onto the base', async () => {
    const { urlFor } = await loadRoutes();
    expect(urlFor('https://other.example/x')).toBe(FLASK + '/https://other.example/x');
  });
});
