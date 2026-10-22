// Which service answers each path.
//
// The onboarding API is being extracted from the Flask app into a separate Django
// service (../minty-onboarding-api). Both speak the SAME paths — `/api/onboarding/*`,
// byte for byte — so moving an endpoint between them is a change of base URL and
// nothing else. This module is that switch, and it is the only place the decision
// lives.
//
// TO MOVE AN ENDPOINT BACK TO FLASK: delete its line from DJANGO_PATHS. To move it
// across: add one. There is nothing else to change, in this file or anywhere else.
//
// WHY A LIST RATHER THAN "EVERYTHING UNDER /api/onboarding"
//
// Because the list is the record of what has actually been verified. The Django
// service answers every onboarding path today, but roughly two-thirds of them are
// thin proxies that hand the request straight back to Flask (Stripe, Xero tokens,
// subscription writes — things only one service may do). Those are safe, and they
// are also the ones most likely to need reverting in a hurry. An explicit list lets
// that be one deleted line at 2am rather than a code change under pressure.
//
// NOT EVERYTHING GOES THROUGH THE NEW SERVICE. `/xero_connect`, `/logout` and `/entity`
// are Flask pages - not part of this extraction and not listed here, so they fall
// through to FLASK_BASE. (Sign-in - `/auth/email/*`, `/xero_auth` - left this app for
// minty-web in phase 2, and the legal DOCUMENTS left Flask altogether on 2026-10-12: they
// are minty-web's pages, `/terms` and `/privacy`. Only `/legal/current` is still Flask's.)

import { envUrl } from '@minty/shared/env';

// Both base URLs are read through @minty/shared/env's envUrl (owner 2026-10-21: one shared
// module (@minty/shared/env)): trimmed, every trailing slash stripped, the local port in
// development and tests, and a THROW in a production build when the variable is unset - CI and
// every Vercel environment set both. next.config.ts lists them under `env`, so these literal
// `process.env.X` reads are inlined at build time.

// Base URL of Petty Cash (the Minty Flask app) — PETTY_CASH_URL. The live Terms VERSION
// (/legal/current) and the Xero OAuth entry point (/xero_auth) live there, and every
// /api/onboarding/* path not listed below falls through to it. The legal documents themselves
// are minty-web's (my.dailyminty.com/terms and /privacy); Flask's /legal/terms and
// /legal/privacy 404. The fallback is Flask's local port in the owner's layout (2026-10-16).
export const FLASK_BASE = envUrl(
  'PETTY_CASH_URL',
  process.env.PETTY_CASH_URL,
  'http://localhost:8000',
);

// Where the extracted onboarding API lives — ONBOARDING_API_URL. The fallback is the port its
// docker service and `manage.py runserver` both use.
export const ONBOARDING_API_BASE = envUrl(
  'ONBOARDING_API_URL',
  process.env.ONBOARDING_API_URL,
  'http://localhost:8030',
);

// Paths the Django service answers. A `:name` segment matches exactly one segment.
//
// Matching is per SEGMENT, not by string prefix. That matters: `/invite` would
// prefix-match `/invite/cancel`, so reverting the invite list to Flask would
// silently revert cancelling too — a one-line edit with a consequence nobody asked
// for. Segment matching makes the two independent.
const DJANGO_PATHS = [
  // Reference data — implemented in Django
  '/api/onboarding/server-time',
  '/api/onboarding/currencies',
  '/api/onboarding/countries',
  '/api/onboarding/plans',
  // Wizard state — implemented in Django
  '/api/onboarding/state',
  '/api/onboarding/saved-step',
  // The company — implemented in Django
  '/api/onboarding/create',
  '/api/onboarding/entity/:entityId',
  // Petty-cash config — implemented in Django
  '/api/onboarding/sales-methods',
  '/api/onboarding/opening-balance',
  // Invites — GET and cancel implemented in Django; POST /invite is a proxy,
  // because the invitation email links into a Flask route and uses a Flask template
  '/api/onboarding/invite',
  '/api/onboarding/invite/cancel',
  // Proxied to Flask by the Django service: Flask sends the email (template, accept link)
  '/api/onboarding/invite/resend',
  // Proxied to Flask by the Django service. Listed so the wizard still talks to one
  // base URL; delete a line to route it straight at Flask instead.
  '/api/onboarding/account-codes',
  '/api/onboarding/contacts',
  '/api/onboarding/contacts/create',
  '/api/onboarding/bill-codes',
  '/api/onboarding/modules',
  '/api/onboarding/payment-method',
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

const DJANGO_PATTERNS = DJANGO_PATHS.map((p) => p.split('/'));

function matches(pattern: string[], segments: string[]): boolean {
  if (pattern.length !== segments.length) return false;
  return pattern.every((part, i) => part.startsWith(':') || part === segments[i]);
}

/** The base URL that answers `path`. Exported for tests and for debugging. */
export function baseFor(path: string | null | undefined): string {
  // Compare the path only. A query string is never part of the routing decision,
  // and `?entity_id=…` on /state would otherwise defeat an exact match.
  const pathname = String(path || '')
    .split('?')[0]
    .split('#')[0];
  const segments = pathname.split('/');
  return DJANGO_PATTERNS.some((p) => matches(p, segments)) ? ONBOARDING_API_BASE : FLASK_BASE;
}

/**
 * Absolute URL for an app-relative path, routed to whichever service owns it.
 *
 *   urlFor('/api/onboarding/state?entity_id=abc')  -> the onboarding service
 *   urlFor('/entity')                              -> Flask (a Flask page)
 *
 * Used for fetches AND for navigations, because the question is the same either
 * way: which service serves this path.
 */
export function urlFor(path: string | null | undefined): string {
  const suffix = String(path || '');
  return `${baseFor(suffix)}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
}
