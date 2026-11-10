// Base URL of the accounts service (minty-accounts-api, which replaced Flask) —
// ACCOUNTS_API_URL. The OTP endpoints, the live Terms VERSION (/auth/email/*,
// /legal/current) and the Xero OAuth entry point (/xero_auth) live there, and every
// /api/onboarding/* path lib/apiRoutes.ts does not send to the onboarding API falls
// through to it.
//
// The legal documents themselves are NOT here: they moved to minty-web on 2026-10-12 and are
// read at my.dailyminty.com/terms and /privacy. Flask's /legal/terms and /legal/privacy 404.
//
// next.config.ts lists ACCOUNTS_API_URL under `env`, so this literal
// `process.env.ACCOUNTS_API_URL` is inlined at build time: in a deployed environment it
// MUST be set before building — an unset value silently falls back to localhost and
// breaks the Xero and OTP request/verify calls. A trailing slash is stripped.
export const FLASK_BASE = (process.env.ACCOUNTS_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);
