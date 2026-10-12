# Features — the onboarding wizard

`minty-onboarding-web` is the Next.js wizard a person walks to create a company in Minty: nine
steps from the company name to a live company, entered with a token Minty minted. It
talks to two backends — `minty-onboarding-api` for `/api/onboarding/*` and Minty for
sign-in, legal text and the Xero connection — and never verifies anything itself.

| Feature | Document |
|---|---|
| Entering with Minty's token; `/auth*` forwarding to minty-web's sign-in (phase 2); which backend answers what | [authentication.md](authentication.md) — the system-wide picture is `Minty/docs/features/authentication.md` |
| The nine steps, saving and resuming, All Set finalizing on arrival | [wizard.md](wizard.md) |
| Step 4 — connecting to Xero, the three returns, disconnecting, the network-layer fake in tests | [xero-step.md](xero-step.md) |
| Toasts - `components/Toast.tsx`, minty-web's card, one at a time | `Minty/docs/features/toasts.md` - the system-wide rule and the look, value for value |
| User-facing error copy | [../ERROR_COPY.md](../ERROR_COPY.md) |
| Manual QA checklist for the wizard, grounded in the docs above and the e2e suite's traps, plus the `pettycashv3` rows each step writes | [qa-checklist.md](qa-checklist.md) |

Email fields take English only (2026-10-01): the sign-in email, the business email (step 1),
the invite (step 8) and the billing email spread `useEmailInput` (`lib/emailInput.ts`; the
rules, `EMAIL_RE`, `sanitizeEmailInput` and `EMAIL_ASCII_HINT`, are in `lib/validation.ts`).
The inputs are `type="text" inputMode="email"`, because the browser's `type="email"` let Hangul
through after the "@". Anything outside printable ASCII is dropped once an IME composition
ends, and the field says why. minty-onboarding-api and Flask refuse it again with a 400.

Fonts (2026-10-12): **Inter** for the body, **Plus Jakarta Sans 700 for the "Minty" wordmark only**
(`.topbar .brand` in `app/globals.css`, drawn by `components/OnboardingApp.tsx`) — the same three
values as minty-web's `components/ui/Wordmark.tsx`, so change the two together. Both faces are
self-hosted through `next/font` in `app/layout.tsx`; this replaced a Google Fonts `<link>`, and the
point of the move is the metric-matched fallback `next/font` generates (`src: local(Arial)` plus
`size-adjust`), which stops text reflowing when the webfont lands. The `@theme` font block in
`app/globals.css` is a **copy of minty-web's, byte for byte** — its
`docs/features/README.md` carries the reasoning — so change them together until `@minty/shared`
takes the tokens at Part 3 step 4. Two tokens only, `--font-sans` and `--font-brand`: no
`--font-mono` (nothing uses the mono utility, and Tailwind's own default keeps it monospace) and no
emoji tail. The icon font is now the `material-symbols` npm package rather than a Google `<link>`,
imported **without** `layer(base)`, so its unlayered `font-size: 24px` wins: every glyph renders at
24px and the 26px / 22px font-size utilities on the spans in `components/NavMenu.tsx` do nothing.
That was already the case through the old `<link>`, so no icon changed size. The one
`fonts.googleapis.com` URL left is Stripe's `cssSrc` in `components/BillingSheet.tsx`, fetched
inside Stripe's cross-origin iframe, which cannot see our `@font-face`. Do not write a bare
Tailwind class name in prose here: v4's source detection scans Markdown and CSS too, so naming a
class is enough to generate it.

Running it and the two variables (`PETTY_CASH_URL`, `ONBOARDING_API_URL`): the repo `README.md` (port 3030). Tests:
`npm test` (Vitest) and `npm run test:e2e` (Playwright against a running stack —
`e2e/README.md`; 23 on 2026-09-18 against the deployed hosts, Xero faked at the browser).
The cleanse log is in `../code_cleanse/`.
