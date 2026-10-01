# Features — the onboarding wizard

`onboarding` is the Next.js wizard a person walks to create a company in Minty: nine
steps from the company name to a live company, entered with a token Minty minted. It
talks to two backends — `onboarding-backend` for `/api/onboarding/*` and Minty for
sign-in, legal text and the Xero connection — and never verifies anything itself.

| Feature | Document |
|---|---|
| Entering with Minty's token; the sign-in page (email OTP, Xero, invitations); the terms modal; which backend answers what | [authentication.md](authentication.md) — the system-wide picture is `Minty/docs/features/authentication.md` |
| The nine steps, saving and resuming, All Set finalizing on arrival | [wizard.md](wizard.md) |
| Step 4 — connecting to Xero, the three returns, disconnecting, the network-layer fake in tests | [xero-step.md](xero-step.md) |
| User-facing error copy | [../ERROR_COPY.md](../ERROR_COPY.md) |

Email fields take English only (2026-10-01): the sign-in email, the business email (step 1),
the invite (step 8) and the billing email spread `useEmailInput` (`lib/emailInput.ts`; the
rules, `EMAIL_RE`, `sanitizeEmailInput` and `EMAIL_ASCII_HINT`, are in `lib/validation.ts`).
The inputs are `type="text" inputMode="email"`, because the browser's `type="email"` let Hangul
through after the "@". Anything outside printable ASCII is dropped once an IME composition
ends, and the field says why. onboarding-backend and Flask refuse it again with a 400.

Running it and the two `NEXT_PUBLIC_*` variables: the repo `README.md` (port 3001). Tests:
`npm test` (Vitest) and `npm run test:e2e` (Playwright against a running stack —
`e2e/README.md`; 23 on 2026-09-18 against the deployed hosts, Xero faked at the browser).
The cleanse log is in `../code_cleanse/`.
