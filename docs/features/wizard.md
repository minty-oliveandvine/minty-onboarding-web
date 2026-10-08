# The wizard — nine steps from a company name to a live company

`components/OnboardingApp.tsx` is the state machine (one `WizardState`, `lib/types.ts`;
`initialState()` and the step rules in `lib/wizardSteps.ts`), `components/OnboardingSteps.tsx`
the nine screens, `components/Stepper.tsx` the rail. Every write goes to
`/api/onboarding/*` through `lib/api.ts` with the launch token
(`minty-onboarding-api/docs/features/wizard-api.md` is the contract).

## The steps (`lib/wizardSteps.STEPS`)

| # | Screen | Component | Writes |
|---|---|---|---|
| 1 | Basic Information — name, country, currency, phone, email | `StepCreateEntity` | `POST /create` on the first advance, `PUT /entity/{id}` after |
| 2 | Select Module — Petty Cash, Payment Request (cards in the old live app's design: accent gradient, large illustration, the description over the card on hover/focus, a teal gradient frame when picked); the price summary (01-A/B/C: the plan, the card under its network's mark, the after-trial price) and the billing sheet (`BillingSheet.tsx`: card capture through Stripe, consent); the click that picks the second module bursts confetti out from behind the cards' two top corners, gone within two seconds | `StepSelectModule` | `POST /modules`, the `billing/*` routes |
| 3 | User Invite — invite colleagues with a role; on arrival a prompt in minty-web's modal design (`components/ModalFrame.tsx`) recommends inviting the accountant, with Minty and Ollie under the title; its one button *Ok* closes it (no Skip; *Add later* at the foot of the page moves on) | `StepInvite` | `POST /invite`, `/invite/cancel` |
| 4 | Connect to Accounting System — Xero | `StepConnectXero` | Minty's `/xero_connect` ([xero-step.md](xero-step.md)) |
| 5 | Sales Setting — electronic and delivery methods (both start empty; *Auto Fill* fills Flask's default set, *Revert* empties them again — a new company is seeded with Cash only), and the opening balance (the cash in the drawer on day one) | `StepSalesSetting` | `POST /sales-methods`, `POST /opening-balance` |
| 6 | Account Code Setting — the expense accounts and the petty-cash account mapping | `StepAccountCode` | `POST /account-codes` |
| 7 | Others — the three petty-cash contacts (director, cash sale, discrepancy; a new one can be created in Xero; the open list says to type a name to add one) | `StepOthers` | `POST /contacts`, `/contacts/create` |
| 8 | Payment Request Settings — the bills' account codes | `StepBills` | `POST /bill-codes` |
| 9 | All Set | `StepAllSet` | **`POST /finalize` on arrival**; *Try again* re-posts it after a failure |

The rail groups 5–7 as *Petty Cash Settings* and shows 8 only when that module was
chosen (`getDisplaySteps`); `isStepComplete` decides the ticks. Each screen's chrome (the
Save & Next / Save & Exit buttons, the errors) is `components/steps/StepChrome.tsx`;
shared fields in `components/steps/pettyCashFields.tsx`, the pricing in
`components/steps/modulePricing.tsx`; selects and the date picker are the app's own
(`MintySelect`, `MintyDatePicker`).

A card's network mark is `components/CardBrand.tsx`: our own wordmark (Mastercard's circles
drawn as circles), never the issuers' licensed artwork. It has two fits — `tile`, the picker
chip's (`pm-brand`), and `mark`, cropped to the logo itself for the summary's slot
(`sub-pay-mark`: 74 wide, as tall as the mark, at most 42, so 01-C's Mastercard lands 63 x 42
against the frame's 68 x 42). minty-web's copy draws the same marks at the same size in its
summaries; change the two together.

## Saving and resuming

- Every advance and *Save & Exit* post `saved_step` (`POST /saved-step`), so a resume
  lands where the person left off; the app also mirrors state and the furthest step
  reached into `sessionStorage`.
- On launch with an `entity_id` (or after a reload) the app reads `GET /state` and
  **trusts the database**: the saved step is where it lands; the backend's
  `current_step` / `max_reached` only raise the ceiling of unlocked steps — the backend
  derives its number from a different ordering (modules → Xero → petty cash → bills)
  and using it as the landing step once jumped people straight to *Connect to
  Accounting*. Never make the two orderings one.
- `fresh=1` starts a brand-new company even when an unfinished one exists.
- **Left unfinished, it is mailed about (2026-10-01).** minty-subscription-api's daily pass sends
  whoever started a company still in setup a "Finish setting up {Company} on Minty" email 1, 3
  and 7 days after its last save, listing the steps from `saved_step` on; its button opens
  Flask's `/entity/{id}`, which brings them back here at that step (minty-subscription-api
  `docs/features/subscriptions-api.md`, "The setup reminder"). Renumbering the steps means
  updating `notify.ONBOARDING_STEPS` there too.

## All Set finalizes on arrival

Reaching step 9 runs `completeOnboarding()`: it submits the opening balance and posts
`/finalize`, which flips the company from `onboarding` to `connected`/`disconnected` and
starts the trials (minty-onboarding-api → minty-subscription-api `trials/start`, 2026-10-06);
the screen itself commits nothing, and *Go to entity list* leaves.

**The trials have no subscriber** (the user, 2026-10-08). Starting a trial is free and
commits nobody, so finalize establishes no payer for the company. The wizard's one door onto
the billing relationship is **step 2's billing sheet** (`authorizeBilling`, `lib/billing.ts`
-> `POST /billing/authorize`), and it is skippable: a person who skips it finishes with
card-free trials nobody is liable for. Those trials expire at term end rather than
converting, every admin of the company may act on its subscription, and any of them can
confirm billing later with *Activate Subscription* on minty-web's module settings page.
Nothing in the wizard changes - this is what *Add Payment Now* on All Set is for.

Complete the sheet and the company DOES get its subscriber: the confirm is made on step 2,
before the module rows exist, so the engine lands the stamp at finalize
(`store.confirmed_payer_for_entity`, asked by company rather than by whoever finished - so
a wizard completed by a different member still credits the person who agreed to pay).

**A failed finalize is shown, not hidden (2026-10-06).** `completeOnboarding` checks
`res.ok`; a failed finalize (or a network error) resolves `{ok: false, error}`, and the
saved session (`localStorage`/`sessionStorage`) is cleared only after a successful one, so a
reload after a failure lands back on All Set and finishes. On failure `StepAllSet` says
"Your N-day <module> trial hasn't started yet.", shows the server's sentence inline
(`role="alert"`, `.billing-error`; no toast), and its primary button is *Try again* (it
re-runs the commit and replaces `commit.current`, so the billing sheet's `onDone` still
awaits it). *Add Payment Now* and the payment nudge stay hidden until the trial exists;
*Go to entity list* stays available (disabled while a retry is in flight).

**Never navigate a test straight to step 9**
(`e2e/README.md`, `land()` in `e2e/onboardingApi.ts` refuses it); `walk.spec.ts` reaches it
by clicking *Complete* on step 8 against the disposable entity.

## Copy and errors

`lib/errorCopy.ts` and `docs/ERROR_COPY.md`: the backends answer `{"error": "…"}` in the
words the wizard shows; the app never invents a message for a status it does not know.

## Tests

Unit (`npm test`): `lib/__tests__/wizardSteps.test.ts`, `validation.test.ts`, `invites.test.ts`,
`components/__tests__/Stepper.test.tsx`, `StepChrome.test.tsx`, `StepInvite.test.tsx` (the arrival prompt's Ok / Skip), `MintySelect.test.tsx` (the type-to-add hint), `pettyCashFields.test.tsx`,
`MethodList.test.tsx`, `CardBrand.test.tsx` (the two fits and their crops). Browser (`npm run test:e2e`): `e2e/stack.spec.ts` (the two backends
answer), `resume.spec.ts` (the database decides the landing step; `saved_step` and
`current_step` may disagree; an out-of-range step is refused), `xero.spec.ts`,
`walk.spec.ts` (the whole wizard to All Set, Xero faked; the first finalize is forced to a
502, the failure UI asserted, then *Try again* runs the real one) — 23 on 2026-09-18 against the
deployed hosts; 23 passed on 2026-10-06.
