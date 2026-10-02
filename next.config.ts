import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
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
