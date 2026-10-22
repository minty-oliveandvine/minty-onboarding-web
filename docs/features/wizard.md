# The wizard — nine steps from a company name to a live company

`components/OnboardingApp.tsx` is the state machine (one `WizardState`, `lib/types.ts`;
`initialState()` and the step rules in `lib/wizardSteps.ts`), `components/OnboardingSteps.tsx`
the nine screens, `components/Stepper.tsx` the rail. Every write goes to
`/api/onboarding/*` through `lib/api.ts` with the launch token
(`minty-onboarding-api/docs/features/wizard-api.md` is the contract).

## The steps (`lib/wizardSteps.STEPS`)

| # | Screen | Component | Writes |
|---|---|---|---|
| 1 | Basic Information — name, country, currency (all three required), phone, email (optional). A new company starts **empty**, Country and Currency included, like the phone's code (owner, 2026-10-19; *Select a country* / *Select a currency*); picking a country fills an empty currency with its own (`lib/countryCurrency.ts`) and moves the phone's code, and the browser's timezone goes with the save, with nothing on screen (`lib/browserTimezone.ts`) | `StepCreateEntity` | `POST /create` on the first advance, `PUT /entity/{id}` after |
| 2 | Select Module — Petty Cash, Payment Request (the 9C hybrid, 2026-10-19 - see *Step 2's module cards* below); the price summary (01-A/B/C: the plan, the card under its network's mark, the after-trial price) and the billing sheet (`BillingSheet.tsx`: card capture through Stripe, consent); the click that picks the second module bursts confetti out from behind the cards' two top corners, gone within two seconds | `StepSelectModule` | `POST /modules`, the `billing/*` routes |
| 3 | User Invite — **optional** (the 9E choices, 2026-10-19 - see *Step 3's choices* below): invite colleagues with a role; on arrival a prompt in minty-web's modal design (`components/ModalFrame.tsx`) recommends inviting the accountant, with Minty and Ollie under the title; its one button *Ok* closes it (no Skip in it; *Skip for now* at the foot of the page moves on); each pending row says when it expires (`inviteExpiryLabel`) and offers *Resend* | `StepInvite` | `POST /invite`, `/invite/cancel`, `/invite/resend` |
| 4 | Connect to Accounting System — Xero | `StepConnectXero` | Minty's `/xero_connect` ([xero-step.md](xero-step.md)) |
| 5 | Sales Setting — electronic and delivery methods (both start empty; *Auto Fill* fills Flask's default set, *Revert* empties them again — a new company is seeded with Cash only), and the opening balance (the cash in the drawer on day one), typed in the currency's decimal places (`currencyDecimals`; JPY is whole amounts) | `StepSalesSetting` | `POST /sales-methods`, `POST /opening-balance` |
| 6 | Account Code Setting — the expense accounts and the petty-cash account mapping | `StepAccountCode` | `POST /account-codes` |
| 7 | Others — the three petty-cash contacts (director, cash sale, discrepancy; a new one can be created in Xero; the open list says to type a name to add one) | `StepOthers` | `POST /contacts`, `/contacts/create` |
| 8 | Payment Request Settings — the bills' account codes, and an optional default code from the ticked ones | `StepBills` | `POST /bill-codes` (`default_code`) |
| 9 | All Set | `StepAllSet` | **`POST /finalize` on arrival**; *Try again* re-posts it after a failure; a 409 for unfinished setup lists each gap with *Go to <step>* (`returnToStep`, the one way out of the locked stepper), titles the screen *Almost there* and holds the confetti (it flies only once finalize succeeds); the needs-Xero dialog never opens over All Set |

The rail groups 5–7 as *Petty Cash Settings* and shows 8 only when that module was
chosen (`getDisplaySteps`); `isStepComplete` decides the ticks. Its tiles are buttons (Round
2.1, 2026-10-16): a reachable tile takes Tab and Enter, the active one is `aria-current="step"`,
and one that leads nowhere (locked, or every tile once on All Set) is `aria-disabled` and out of
the Tab order. Each screen's chrome (the
Save & Next / Save & Exit buttons, the errors) is `components/steps/StepChrome.tsx`;
shared fields in `components/steps/pettyCashFields.tsx`, the pricing in
`components/steps/modulePricing.tsx`; selects and the date picker are the app's own
(`MintySelect`, `MintyDatePicker`).

### Step 2's module cards (9C, 2026-10-19)

The owner asked for a hybrid: the revised step's copy, selection logic, pricing summary and
progress, with the old live app's bigger, coloured module art. Each card (`StepSelectModule`,
`.module-pick` in `app/globals.css`):

- **is a checkbox** (`role="checkbox"`, `aria-checked`, named by the module, described by its
  benefit and trial lines) - several may be picked (Part 15.8c), so not a radio. Tab reaches it;
  Space or Enter toggles it; the whole card is the target.
- **has an identity band**: the module's Part 13 wash with a 4px stripe of its identity colour
  and the module art at up to 208px (Part 13 §13.10's ceiling for selection). The colours are
  `--mv2-module-pettycash|payment` (`-wash`, `-ink`) in `:root`, the same values as
  `@minty/shared`'s `--color-module-*` (this app does not import `tokens.css`); `MODULES[].tone`
  picks them, so no hex lives in the component. Identity only - the name, the state and the
  buttons stay neutral/teal.
- **always shows its benefit line** (`MODULES[].desc`). It used to appear only over the card on
  hover/focus, which a touch screen never shows.
- **shows the picked state three ways**: the selected (teal) border, a filled check box, and the
  word *Selected* (*Select* when not) - never colour alone.
- On a phone (≤ 700px) the cards stack full width; from 701px they sit side by side at 300px.

Unchanged: multi-select, Save & Next held until one is picked (with its reason), the save-then-
advance order, the price summary beside the cards, and the confetti on the click that completes
the pair (it is decorative and blocks nothing). Tests: `StepSelectModule.cards.test.tsx` (the
card's accessibility), `StepSelectModule.selection.test.tsx` (what must not change),
`StepSelectModule.test.tsx` (confetti).

### Amounts and prices (owner, 2026-10-21)

One money rule in every app, from `@minty/shared/money` (this app's old `lib/amount.ts` became
it): an amount is the ISO code, a non-breaking space (U+00A0, so a line never splits the code
from its amount), then the number grouped in threes with the currency's decimal places -
`HKD 1,234.50`. Never a symbol (`HK$`); with no code the number stands alone;
extra decimals are cut, not rounded. Step 5's opening balance uses `formatAmount` /
`acceptAmountInput` with `currencyDecimals` (the code sits in the field's prefix).

The exception here is a **price** - Step 2's after-trial tile and its struck bundle subtotal -
which drops a trailing `.00` through `formatPrice`: `HKD 560`, but `HKD 560.50`. The label is
the plan's `currency_code`; the API's `currency_symbol` is never read, so a symbol cannot show.
The struck subtotal carries no code, because it sits directly above one. Tests:
`modulePricing.money.test.ts`, `lib/__tests__/amount.test.ts` (consumer-side proof).

### Step 3's choices (9E, 2026-10-19)

The step is optional and says so with three explicit choices, not copy alone:

- **An *Optional* pill** (neutral `pill-status off`) beside the *User Invite* title, and one line
  under it.
- **The people to invite**: one row (a `<fieldset>`, *Invite a person*) to start;
  **+ Add another person** (secondary button) adds *Person 2*, *Person 3*… each with a 44px
  remove button. Rows live in the component only, never in `WizardState`.
- **Footer**: Back · Save & Exit · **Skip for now** (a secondary button, same row/stack, never a
  link) · **Send invitations** (primary).
  - *Send invitations* sends every complete row (one `POST /invite` each), ignores empty rows,
    and moves on once all went out. A row that fails (or whose email did not go out) stays
    filled and the step stays. A started-but-unfinished row refuses the send: each field gives
    its Part 11 message (*The role is still empty. Choose their role to send this invitation.*),
    one problem takes focus, two or more raise the error summary (with *Person N:* once there
    are several rows). Empty fields turn red only after that refused send; the email's format
    message waits for the field to be left once, then follows each keystroke. With nothing typed
    and nobody invited it is disabled with its reason beside it.
  - *Skip for now* moves on and **sends nothing**, whatever the rows hold - a half-filled row
    never blocks it. Once somebody has been invited and the rows are empty, the primary reads
    *Continue* and Skip is not shown (they would be the same move).
- `isStepComplete(3)` is still always true and `deriveResumeStep` still counts step 3 as saved
  only when an invitation was sent, so skipping leaves nothing to resume to.

Tests: `StepInvite.flow.test.tsx` (the choices), `StepInvite.test.tsx` (the arrival prompt);
`e2e/responsive.spec.ts` checks both steps at 360/768/1440 against the disposable entity.

### Phone Number (Step 1, `components/PhoneField.tsx`, since 2026-10-12)

A dial-code picker beside the number, labelled *Phone Number (optional)* (it was *Contact
Phone*, an 8–11-digit box with no country code). No hint line under it (the user's call).
- **The picker** is a searchable `MintySelect`: the menu rows read `Hong Kong +852`, the closed
  field `HK +852` (`valueLabel`). No flag emoji: Windows draws them as letters. Its list is
  `GET /countries`' `phone_code`, so a country without one is not offered. Those codes live in
  `country_info.phone_code`, filled by `Minty/docs/schema/seed_country_phone_codes.sql`
  (`load_catalogue.py` loads it). A database without them offers no codes, and the API refuses
  every number.
- **It follows the Country** until the user picks a code; picking the Country's own code
  makes it follow again. Pasting `+65 6123 4567` into the number moves it to +65. On a shared
  code (+1, +44, +7…) the company's Country wins when it is one of them, else the code's main
  country (`MAIN_COUNTRY`: +44 is the UK, not Guernsey, which sorts first). A pasted number's
  national part is kept as digits only.
- **State** (`EntityForm.phone`) is `+<code> <national as typed>` ("+852 9123 4567"), and
  `phoneCountry` is the user's own pick ("" = follows). The API is sent compact E.164
  (`phoneForApi`: "+85291234567", the domestic trunk 0 dropped except for +39/+378). A stored
  number, or a digits-only one from before the picker, is split back into the field's form once
  the list is in (`splitStoredPhone`, under the Country's code, minus that code if it was typed
  in front).
- **The rule** (`lib/validation.ts` `phoneError`, mirrored in the API's `resolve.PHONE_LENGTHS`,
  change both together): exactly 8 digits for +852, the one market Minty sells in (the user,
  2026-10-12: strict on Hong Kong only for now - add a code when its market opens); otherwise
  E.164's bounds (4+ national digits, 15 in all). The message (*A +852 number has 8 digits.*,
  worded by code because the registry's names are the official ones, "Hong Kong SAR China")
  waits for the first blur; Save & Next stays off while it stands. A number with no code to
  judge it by is blocked the same way (*Please choose a country code.*), so a bare number can
  never reach the API, which refuses it.
- **No digit past the maximum** (`maxNationalDigits`: 8 for +852, else what 15 leaves after the
  code). A keystroke on a full number is refused outright (so a digit typed mid-number cannot
  push the last one out), a paste is cut at the limit (`capNational`, punctuation kept, a
  dropped trunk 0 not counted), and deleting always works, even on a number a code change
  left too long.
- **There is no default Country** since 2026-10-19 (owner): a new company starts with Country,
  Currency and the phone's code all empty. Before that the default was the label
  `'Hong Kong'` / `'Hong Kong Dollar'`; a session saved then may still carry them, so Step 1
  still matches a label to its registry row - exactly or by a UNIQUE prefix (the API's own
  fallback), since the registry holds the official name ("Hong Kong SAR China").

The billing sheet's address (Stripe's AddressElement) starts on the company's Step 1 Country
(`BillingSheet`'s `country` → `defaultValues`, since 2026-10-12). Left to itself Stripe guesses
from the browser's location, so a Hong Kong payer on a US-set browser met "United States".

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

`@minty/shared/errorCopy` (`friendlyError`, `errorCopy`, `HOUSE_FALLBACK`; this app's
`lib/errorCopy.ts` until 2026-10-21) and `docs/ERROR_COPY.md`: the backends answer
`{"error": "…"}` in the words the wizard shows; the app never invents a message for a status it
does not know.

### Dates

Every date the wizard shows is `@minty/shared/dates`' format, "12 Sep 2026" (owner,
2026-10-21; it was "12 SEP 2026"): Xero's *Last connected* is `formatDay(todayIso())` - today
in Hong Kong, not the browser's zone - and All Set's trial end is `formatInstantDay`, the day
the trial ends in Hong Kong. Step 5's opening-date cap falls back to `todayIso()` when the
server's time cannot be read. Tests: `lib/__tests__/date.test.ts`.

## Tests

Unit (`npm test`): `lib/__tests__/wizardSteps.test.ts`, `validation.test.ts`, `invites.test.ts`,
`components/__tests__/Stepper.test.tsx`, `StepChrome.test.tsx`, `StepInvite.test.tsx` (the arrival prompt's Ok), `StepInvite.flow.test.tsx` (Optional, Add another person, Skip for now, Send invitations), `StepSelectModule*.test.tsx` (the module cards, the selection, the confetti), `MintySelect.test.tsx` (the type-to-add hint), `pettyCashFields.test.tsx`,
`MethodList.test.tsx`, `CardBrand.test.tsx` (the two fits and their crops). Browser (`npm run test:e2e`): `e2e/stack.spec.ts` (the two backends
answer), `resume.spec.ts` (the database decides the landing step; `saved_step` and
`current_step` may disagree; an out-of-range step is refused), `xero.spec.ts`,
`walk.spec.ts` (the whole wizard to All Set, Xero faked; the first finalize is forced to a
502, the failure UI asserted, then *Try again* runs the real one) — 23 on 2026-09-18 against the
deployed hosts; 23 passed on 2026-10-06.

## Required fields

**A mandatory field shows a red `*` from the moment its step opens**, and its control turns red
only once Next has actually been refused (every gated step already keeps a `showErrors` flag
for that, so no new state was needed).

- The mark is `.req` in `app/globals.css`, commented *"shared by every form"* since it was
  added. As of 2026-10-09 it finally is: it had been applied to 5 fields out of ~19.
- It is **`aria-hidden`**, because an asterisk read aloud is "star". Requiredness is announced
  on the CONTROL instead - `aria-required` on the inputs, and `MintySelect` takes `required`
  and `invalid` props for the same reason. Both halves are needed.
- Steps 6 and 7 draw their fields through `PCSection` (`components/steps/pettyCashFields.tsx`),
  so the mark is rendered **once** there rather than nine times at the call sites. `PCField`'s
  `required` defaults ON, because everything PCSection draws today is a hard gate - an optional
  field is the one that has to say so.
- Marked: Entity Name, Country and Currency (step 1), the "Add New Method" name (step 5), the six account-code fields
  (step 6), the three contacts (step 7), Payment Account Code (step 8), and the billing sheet's
  Email and Billing company. Phone Number and Business Email stay unmarked - they are genuinely
  optional, and already labelled so. (Country and Currency were unmarked while they came
  pre-filled; they start empty and are required since 2026-10-19.)

### Step 1's required fields (2026-10-19)

Entity Name, Country and Currency are required (`isStepComplete(1)` needs all three, so a resume
never counts a company without a country or currency as past step 1; the onboarding API refuses
one too). Save & Next is **not** disabled for them - only while saving, or while a typed phone or
email is malformed. Pressing it with one empty is a refused submit (`showErrors`):

- each empty field turns red and says so, in Part 11 wording - *The company name is still empty.
  Add the company name to continue.*, *The country is still empty. Choose the company's country
  to continue.*, *The currency is still empty. Choose the company's currency to continue.* -
  and its message clears the moment the field has a value;
- one problem moves focus to that field; two or more show `components/steps/ErrorSummary.tsx`
  (`.error-summary`, a copy of minty-payment-request-web's Part 15.3 summary in this app's
  tokens) at the top of the form, which takes focus and links to each field;
- each label carries the red `*` and a screen-reader-only *(required)* (`.sr-only`), the control
  `aria-required` (`MintySelect` now takes `id` and `ariaDescribedBy` for the label and message);
- Save & Exit is never blocked by them (its save is best-effort; an entity the API refuses is
  simply not saved).

Tests: `components/__tests__/StepCreateEntity.test.tsx`, `lib/__tests__/wizardSteps.test.ts`,
and `e2e/phone.spec.ts`'s new-company case.

### The dropdowns could not turn red at all

`MintySelect` is a `<div>`, so `.pc-field.field-error` - which only targets
`input/select/textarea` - never reached it. **Nine** mandatory fields in steps 6 and 7 printed
their message while the dropdown stayed neutral. `app/globals.css` now has a rule for
`.mselect.is-invalid .mselect-trigger` (and the `.field-error` descendant forms), so they
redden like everything else.

Still open: `.pc-card.is-error` glows `var(--accent)` - **mint**, not `var(--danger)` - so an
errored card looks highlighted rather than wrong. Changing it is a visual decision, not part of
the marker work.

`.billing-label .req` mirrors minty-web's `SHEET_REQUIRED`; the note at the top of
`minty-web/components/ui/sheetClasses.ts` applies - the same dialog in two apps must be the
same dialog, so change both or neither.
