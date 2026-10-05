# Authentication — the onboarding app's half

The wizard is entered one way: Minty launches it with a Minty-minted JWT in the URL. Nothing
is verified here: every call carries the token to a backend that checks it
(`minty-onboarding-api/docs/features/authentication.md`). Signing in happens before, on
minty-web's `/login` (§2; the system-wide picture is `Minty/docs/features/authentication.md`).

## 1. Launched from Minty

Minty's *Create company* (and *resume*) send the browser to `/?token=<jwt>[&entity_id=…]
[&entity_name=…][&fresh=1]` — the 60-minute `scope: "onboarding"` token
(`lib/wizardSession.ts::takeLaunchParams` reads `token`, `entity_id`, `entity_name`, `fresh`
and the Xero-return parameters ONCE and clears them from the address bar before anything else
runs - until 2026-10-05 a fresh launch left `?token=` there for the whole wizard, and Stripe's
`return_url` carried it). The token lives in memory and in this tab's `sessionStorage`
(`minty_onboarding_token`: survives a reload, not a new tab); the state and the step reached
are cached in `localStorage` WITHOUT the token. The **database is the source of truth** for
resume; the browser copy is a cache (`GET /api/onboarding/state`). `?profile_url=` is no longer
read: Flask never sent it, and the avatar followed it into `location.href`, so a `javascript:`
value ran on click. Stripe.js is imported from `@stripe/stripe-js/pure` and loads when the
billing sheet opens; its `return_url` is the page without a query.

## 2. Sign-in left this app (phase 2, 2026-10-05)

Log in, sign up and invitations were this app's `/auth` and `/auth/confirm` until 2026-10-05.
They are minty-web's `/login` and `/login/confirm` now (`minty-web/features/auth`, its
`docs/features/authentication.md`): sign-in is person-level, and each app holds only its own
app - this one is the wizard. Nothing links to the old addresses any more; `next.config.ts`
`redirects()` sends a bookmark of them through Flask (`PETTY_CASH_URL`), which knows where sign-in
lives: `/auth?mode=signup` to Flask's `/register` (sign-up), any other `/auth` or `/auth/confirm` to
Flask's `/` (log in). Deleted with the pages:
`lib/authHandover.ts`, `lib/pendingInvite.ts`, `components/AuthTopbar.tsx`,
`components/TermsModal.tsx`.

## Where the calls go

`lib/flaskBase.ts`: `PETTY_CASH_URL` — Minty; `lib/apiRoutes.ts`:
`ONBOARDING_API_URL` — minty-onboarding-api, for the paths listed in
`DJANGO_PATHS`; everything else (`/xero_connect`, `/logout`, `/entity`, and the old `/auth*`
forwards) is Minty. Both are inlined at build time (`next.config.ts` `env`) — an unset
value silently means `localhost` and breaks the OTP and Xero calls in a deployment.

## Tests

`e2e/resume.spec.ts` (a valid launch token opens the wizard, the token is stripped from
the address bar, a forged / expired / wrong-scope token is refused), `e2e/stack.spec.ts`;
the suite mints its own tokens with the shared `SECRET_KEY` (`e2e/README.md`).
Unit tests (`npm test`, Vitest): `lib/__tests__/apiRoutes.test.ts` (which service answers
each path), `invites.test.ts`, `validation.test.ts`, `wizardSteps.test.ts`, `date.test.ts`.
