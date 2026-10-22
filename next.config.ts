import { withMintyDefaults } from '@minty/shared/next';
import path from 'node:path';

import { FLASK_BASE } from './lib/apiRoutes';

/**
 * Sign-in is minty-web's since phase 2 (2026-10-05): log in, sign up and invitations were this
 * app's /auth and /auth/confirm. Nothing links there any more; an old bookmark goes through Flask,
 * which knows where sign-in lives - `/register` forwards to sign-up, `/` to log in. Flask's address
 * is the one this app already has (lib/apiRoutes.ts), so no variable of minty-web's is needed here.
 *
 * withMintyDefaults (@minty/shared/next) supplies what every Minty app sends and needs: the
 * security headers on every path (the URL security round, 2026-10-05), no X-Powered-By,
 * `transpilePackages: ['@minty/shared']` (the package ships .ts source) and 127.0.0.1 as an
 * allowed dev origin. Only this app's own settings are below.
 */
export default withMintyDefaults({
  async redirects() {
    return [
      {
        source: '/auth',
        has: [{ type: 'query', key: 'mode', value: 'signup' }],
        destination: `${FLASK_BASE}/register`,
        permanent: false,
      },
      { source: '/auth', destination: `${FLASK_BASE}/`, permanent: false },
      { source: '/auth/confirm', destination: `${FLASK_BASE}/`, permanent: false },
    ];
  },
  turbopack: {
    // Pin the workspace root to this folder so Next.js doesn't infer the
    // parent repo as the root (multiple lockfiles exist in the monorepo).
    root: path.join(__dirname),
  },
  // The two sibling URLs this app reads, inlined at build time into the client bundle
  // and the server. Raw values only ('' when unset - Next skips an undefined key and
  // leaves `process.env.X` un-inlined); the defaults, the trim, the trailing-slash strip
  // and the production throw live where both are read: lib/apiRoutes.ts, through
  // @minty/shared/env's envUrl.
  env: {
    PETTY_CASH_URL: process.env.PETTY_CASH_URL ?? '',
    ONBOARDING_API_URL: process.env.ONBOARDING_API_URL ?? '',
  },
});
