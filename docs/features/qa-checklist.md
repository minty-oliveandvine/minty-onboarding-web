# Manual QA checklist — onboarding wizard

A manual walkthrough checklist for the nine-step wizard at `minty-onboarding-web`, to run
alongside the automated suites (`## Tests` in [wizard.md](wizard.md),
[authentication.md](authentication.md) and [xero-step.md](xero-step.md)). This is not a
replacement for those — it exists for exercising the wizard by hand in a browser before a
release. Tick each box against a disposable test entity — never one you care about (see
"Never land on step 9 against a real entity" below).

## Entry and auth ([authentication.md](authentication.md))

- [ ] Launching with `?token=<jwt>&entity_id=…` opens the wizard at the entity's saved
      step, and the URL is stripped of `token`/`entity_id`/`entity_name`/`fresh` before
      anything else renders — reload the page and confirm the query string is gone, not
      just hidden.
- [ ] A forged, expired, or wrong-scope token is refused, not silently accepted.
- [ ] `fresh=1` on the launch URL starts a brand-new company even though an unfinished one
      exists for the same user.
- [ ] A reload in the same tab keeps the session (`sessionStorage`); opening the link in a
      new tab does not (the token lives in memory + this tab's `sessionStorage` only).
- [ ] The old `/auth` and `/auth/confirm` addresses redirect through Flask (sign-up to
      `/register`, anything else to `/`) — nothing in this app answers them directly.

## Step 1 — Basic Information

- [ ] Business email with non-ASCII characters (e.g. an IME composition) is dropped once
      composition ends, and the field explains why — never silently accepted.
- [ ] A malformed business email (no dot in the domain, etc.) is refused before advancing.
- [ ] The field is `type="text"`, not `type="email"` — confirm no browser email-validation
      UI appears (the English-only rule depends on this).
- [ ] Editing step 1 after the first advance uses `PUT /entity/{id}`, not another `POST
      /create` (re-opening the same company, not duplicating it).
- [ ] **DB:** `SELECT status, business_email, country_code, currency_id FROM
      pettycashv3.entities WHERE id = '<id>';` — one row, `status = 'onboarding'`, the
      fields just entered; re-saving unchanged fields does not bump `updated_at`.

## Step 2 — Select Module

- [ ] Picking Petty Cash only, Payment Request only, and both renders the right downstream
      steps (step 8 — Payment Request Settings — appears only when Payment Request is
      chosen).
- [ ] Picking the second module while one is already selected fires the confetti burst
      from behind the cards' two top corners, and it is gone within ~2 seconds.
- [ ] The price summary shows the plan, the card under its network's mark (our own
      wordmark — Mastercard's circles drawn as circles, not the issuer's artwork), and the
      after-trial price.
- [ ] The billing sheet (card capture + consent) opens from this step and Stripe.js loads
      only once it is opened, not on page load.
- [ ] Card network marks on this screen and on minty-web's equivalent summary render at
      the same size (sub-pay-mark: 74 wide, mark at most 42 tall) — spot-check side by
      side if both are available.
- [ ] **DB:** `SELECT * FROM pettycashv3.entity_function_map WHERE entity_id = '<id>';`
      reflects exactly the modules picked — this table is Flask's, written through the
      `/modules` proxy, not by this service.

## Step 3 — User Invite

- [ ] On arrival, the "invite your accountant" prompt appears once, in minty-web's modal
      design, with Minty and Ollie under the title.
- [ ] The modal has one button, *Ok* — there is no *Skip* on the modal itself.
- [ ] *Add later* at the foot of the page moves on without sending an invite.
- [ ] Sending an invite with a non-ASCII email surfaces Flask's 400 through the wizard
      unchanged (this call proxies to Flask).
- [ ] Cancelling a pending invite removes it from the visible list (the row is revoked, not
      deleted, on the backend — only the UI effect is checkable here).
- [ ] **DB:** `SELECT status FROM pettycashv3.invitation WHERE entity_id = '<id>' ORDER BY
      created_at DESC;` — a cancelled row reads `revoked`, still present (never deleted); a
      failed send (toast shown) leaves no new row at all.

## Step 4 — Connect to Accounting System (Xero) ([xero-step.md](xero-step.md))

- [ ] *Connect to Xero* leaves the tab entirely (navigates to Minty's `/xero_connect`) —
      confirm the wizard's in-memory state survives the round trip via `sessionStorage`.
- [ ] A successful connection lands back on `/?xero=connected&step=3&org=<tenant>`, shows
      *Connected to \<org\>*, and unlocks Save & Next.
- [ ] A mismatch return (`?xero=mismatch&expected=<email>`) shows the mismatch notice with
      the expected email, and leaves the connection unmade.
- [ ] A conflict return (`?xero=conflict&conflict_entity=<name>`) raises the *That Xero
      organisation is taken* dialog naming the other company, and the connection is not made.
      Without `conflict_can_move=1` there is no *Move it here*, only who to ask.
- [ ] *Move it here* disconnects the other company and comes back connected; *Go back* and
      Escape change nothing on either company. A refused release stays in the dialog.
- [ ] At 360px the step scrolls only downwards — the heading's info tooltip stays on screen
      (it hangs from the icon's right below 760px) and the footer row wraps, the reminder on
      its own line. `e2e/responsive.spec.ts` measures this and needs no credentials; run it
      after any change to the step's chrome.
- [ ] *Disconnect* clears the connection but leaves the company in `onboarding`, still
      resumable — reload and confirm step 4 shows disconnected (state is re-read from
      `GET /state`, not cached).
- [ ] Resuming past step 4 on an entity with no Xero connection sends the wizard back to
      Connect, not forward.
- [ ] Attempting steps 6, 7 or 8 without a connected organisation surfaces the backend's
      409, not a generic error (account-codes / contacts / bill-codes all require Xero).
- [ ] **DB:** `SELECT status, xero_org_id, xero_tenant_name, connected_by_user_id,
      last_connected_at FROM pettycashv3.entities WHERE id = '<id>';` — connect sets all
      four non-null; disconnect clears `xero_org_id`/`xero_tenant_name` but leaves `status
      = 'onboarding'` (disconnect never touches `status` outside the step-9 reset flow).

## Steps 5–7 — Petty Cash Settings

- [ ] A new company's electronic and delivery sales methods start empty (only Cash is
      seeded) until *Auto Fill* is used.
- [ ] *Auto Fill* populates Flask's default set; *Revert* empties electronic/delivery back
      out again (Cash stays).
- [ ] The opening balance (cash in the drawer on day one) saves and is reflected if you
      step back to this screen.
- [ ] Step 6's account-code mapping and step 7's three contacts (director, cash sale,
      discrepancy) list rows already synced from Xero — nothing here triggers a live Xero
      call.
- [ ] On step 7's open contact list, typing a name that doesn't match any existing contact
      offers to create one in Xero (the list's own "type a name to add one" hint).
- [ ] **DB:** `SELECT sale_id, is_active, display_order FROM pettycashv3.entity_sale_setting
      WHERE entity_id = '<id>';` — save twice with overlapping method names and confirm
      `sale_id` values are unchanged across the two saves (reconciled, not deleted and
      reinserted).
- [ ] **DB:** `SELECT opening_balance, start_date, pettycash_account_id, bank_account_id,
      cash_sale_account_id, discrepancy_bank_account_id, discrepancy_account_id,
      director_account_id, cash_sale_contact_id, director_contact_id,
      discrepancy_contact_id FROM pettycashv3.entity_pettycash_settings WHERE entity_id =
      '<id>';` — one row per entity; step 5 fills `opening_balance`/`start_date`, step 6
      the four account columns, step 7 the three contact columns.
- [ ] **DB:** `SELECT status, opening_balance, cash_addition FROM pettycashv3.report WHERE
      entity_id = '<id>' AND status = 'draft';` — the one draft row mirrors step 5's
      opening balance; `cash_addition` stays `0`/`NULL` here — it is never written by the
      wizard (the API checklist's dead-field warning, confirmed at the row level).

## Step 8 — Payment Request Settings (only when that module is chosen)

- [ ] This step is entirely absent from the rail and from navigation when Payment Request
      was not selected in step 2.
- [ ] The bill account-code mapping lists rows already synced from Xero, same 409-without-
      connection rule as step 6.
- [ ] **DB:** this step's row lives in minty-payment-request-api's own snapshot table, not
      in anything this repo owns — confirm the tick state by re-opening step 8, not by
      querying `pettycashv3` here.

## Resume, Save & Exit, and the stepper

- [ ] *Save & Exit* (and every advance) posts `saved_step`; leaving and re-entering via the
      launch link lands on exactly that step.
- [ ] The database wins on conflict: if `saved_step` and the backend's derived
      `current_step` disagree, the wizard lands on the **saved** step, not the derived one
      (a known trap — using the derived number once jumped people straight to Connect
      Accounting).
- [ ] An out-of-range saved step (not 1–9) is refused rather than silently clamped.
- [ ] **DB:** `SELECT onboarding_saved_step FROM pettycashv3.entities WHERE id = '<id>';`
      matches the frontend step id (1–9) exactly, verbatim — never the backend's derived
      `current_step` ordering.
- [ ] The rail groups steps 5–7 under one *Petty Cash Settings* label and shows step 8 only
      when Payment Request is enabled; ticks on the rail match `isStepComplete`, not just
      "visited".
- [ ] A company left unfinished does not block resuming later, no matter how long it sits
      (the 1/3/7-day reminder emails are a separate, backend-driven concern — not part of
      this UI checklist).

## All Set (step 9) and finalize

- [ ] On a **successful** finalize, the saved session (`localStorage`/`sessionStorage`) is
      cleared and *Go to entity list* leaves cleanly.
- [ ] On a **failed** finalize (e.g. a 502) or a network error, the session is **not**
      cleared — reloading lands back on All Set, not back at step 1.
- [ ] The failure message reads "Your N-day \<module\> trial hasn't started yet.", shows the
      server's own sentence inline via `role="alert"` (no toast), and the primary button
      becomes *Try again*.
- [ ] *Try again* re-runs the same commit (opening balance + `/finalize`) rather than
      restarting the wizard.
- [ ] *Add Payment Now* and the payment nudge stay hidden until a trial actually exists.
- [ ] *Go to entity list* is disabled while a retry is in flight, not clickable mid-request.
- [ ] **DB:** `SELECT status FROM pettycashv3.entities WHERE id = '<id>';` flips to
      `connected`/`disconnected` only on a successful finalize — stays `onboarding` after a
      failed one (reload-and-retry depends on this).
- [ ] **DB:** `SELECT function_code, phase, trial_end, payer_user_id FROM
      pettycashv3.entity_module_subscription WHERE entity_id = '<id>';` — exactly one row
      per enabled module (unique on `entity_id, function_code`); clicking *Try again* after
      a failure must not add a second row for the same module. Since 2026-10-08
      `payer_user_id` must be **NULL**: finalize establishes no subscriber, and the person
      who finished the wizard is not liable for the company.
- [ ] Skip the billing sheet on step 2 entirely, then finish: the company still goes live
      with its trials, there is no `pettycashv3.entity_billing_group` row and no
      `entity_billing_consent` row for it, and minty-web's module page offers *Activate
      Subscription* — to ANY admin of it, not only the one who ran the wizard.
- [ ] Complete the billing sheet instead: `entity_billing_group` and consent exist for the
      person who completed it, and after finalize every module row is stamped with them.

## Never land on step 9 against a real entity

**The sharpest edge in this app.** Reaching step 9 is not a passive screen — arrival itself
runs `completeOnboarding()`, which submits the opening balance and calls `POST /finalize`.
That flips the entity from `onboarding` to `connected`/`disconnected` and starts a trial
subscription **per enabled module**. There is no undo screen; by the time All Set renders,
the commit already happened.

This has already cost a dev entity: an early version of a resume test landed on whatever
step a row held, happened to be 9, and finalized + trialed it before anyone could stop it.

For a manual session:

- Never paste a launch link, type a `saved_step`, or otherwise jump a browser session
  straight to step 9 against any entity other than the disposable one.
- Only ever click through to *Complete* on step 8 — the one way a real user reaches All
  Set — against the dedicated E2E/QA test entity (`e2e/README.md`'s
  `ee72f706-49f2-4690-83d6-e5f8d284ba2c`, *"E2E Test Entity (do not use)"*), never a
  company a person is actually setting up.
- After testing All Set, reset the entity the same way the automated suite does
  (`resetEntity()` in `e2e/onboardingApi.ts`):
  1. `POST /api/onboarding/xero/disconnect` — puts `status` back to `onboarding`.
  2. `POST /api/onboarding/saved-step` with the value the entity held before the walk.
  3. If the entity has modules enabled in `entity_function_map`, clear any trial rows by
     hand: `DELETE FROM pettycashv3.entity_module_subscription WHERE entity_id = '<id>';`
     (the seeded test entity enables none, so a fresh one accumulates nothing).

## Out of scope for this checklist

- **Real Xero OAuth** — login.xero.com itself is never exercised here, by hand or
  automated; Minty's own tests cover that side. Manually testing Xero returns means
  observing what the wizard does with the three documented returns, not walking the real
  flow.
- **Email OTP sign-in** — ends at a real inbox; happens on minty-web's `/login` before the
  wizard is even entered, and is out of scope for this doc.

## See also

- [wizard.md](wizard.md) — the nine-step reference and the resume/finalize rules this
  checklist is derived from.
- [xero-step.md](xero-step.md) — the three Xero returns and the real-vs-faked table.
- [authentication.md](authentication.md) — the launch-token handling behind the first
  section.
- `e2e/README.md` — the automated browser suite, the full Xero real-vs-faked table, and the
  step-9 incident this checklist's warning is based on.
- `minty-onboarding-api/docs/features/qa-checklist.md` — the backend's half of this same
  checklist, including the step-9 reset in API terms.

## Required fields

- [ ] Every mandatory field shows a red `*` as its step opens: Entity Name (1), the opening
      balance (5), all six account codes (6), all three contacts (7), Payment Account Code (8),
      and the billing sheet's Email and Billing company. Nothing is red yet.
- [ ] Press Next on an empty step 6 or 7: the first missing field scrolls into view, **its
      dropdown turns red** (not just the sentence under it - nine of these could not redden at
      all before 2026-10-09) and the message appears. Choosing a value clears both.
- [ ] Country, Currency, Contact Phone and Business Email are **not** marked - the first two
      are pre-filled, the last two are optional and say so.
- [ ] A screen reader says "Entity Name, required", not "Entity Name star".
