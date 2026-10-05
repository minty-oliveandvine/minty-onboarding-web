import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * Sent with every response (the URL security round, 2026-10-05). Same values in minty-web,
 * minty-payment-request-web and minty-onboarding-web, and in Flask (pettycash/core/http_hardening.py).
 * - Referrer-Policy same-origin: another site never sees a path or query from here (tokens).
 * - frame-ancestors / X-Frame-Options: only this app may frame its pages (clickjacking).
 * - HSTS in production builds only; a browser ignores it over plain http anyway.
 */
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  turbopack: {
    // Pin the workspace root to this folder so Next.js doesn't infer the
    // parent repo as the root (multiple lockfiles exist in the monorepo).
    root: path.join(__dirname),
  },
  // The two sibling URLs this app reads, inlined at build time into the client bundle
  // and the server. Raw values only ('' when unset - Next skips an undefined key and
  // leaves `process.env.X` un-inlined); the defaults and the trailing-slash strip live
  // where they are read: PETTY_CASH_URL in lib/flaskBase.ts, ONBOARDING_API_URL in
  // lib/apiRoutes.ts.
  env: {
    PETTY_CASH_URL: process.env.PETTY_CASH_URL ?? '',
    ONBOARDING_API_URL: process.env.ONBOARDING_API_URL ?? '',
  },
};

export default nextConfig;
