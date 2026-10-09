# Step 4 — Connect to Accounting System (Xero)

The one step that leaves the wizard. `StepConnectXero` (`components/OnboardingSteps.tsx`)
and the handlers in `components/OnboardingApp.tsx` (`connectXero`, `disconnectXero`, the
return-path parsing).

## Connecting

*Connect to Xero* navigates the tab to Minty:
`{FLASK_BASE}/xero_connect?from=onboarding&entity_id=<id>&entity_name=<name>` — the
entity travels in the query so Minty can embed it in the OAuth `state` and bind the
tenant to **exactly this company** on the callback (`entity_id` is the exact match,
`entity_name` the fallback; neither would fall back to the person's latest in-progress
company). Before leaving, the app stashes its state in `sessionStorage` so the return
lands on the same step. Minty does the OAuth round-trip with its minimal scope set, stores
the token on the connecting person, starts the accounts/contacts sync and sends the
browser back to the wizard root with one of:

| Return | Meaning | What the step shows |
|---|---|---|
| `/?xero=connected&step=3&org=<tenant>` | connected; the tenant name | *Connected to <org>*, the Save & Next unlocks |
| `/?xero=mismatch&expected=<email>` | the person signed into Xero as somebody else | the mismatch notice with the expected email; the connection is not made |
| `/?xero=conflict&conflict_entity=<name>[&conflict_entity_id=<id>&conflict_can_move=1]` | that Xero organisation is already connected to another company | the **"That Xero organisation is taken"** dialog — see below |

On every landing at step 4 or later the app re-reads `GET /state` and takes
`xero.connected` / `xero.org` from the database, so a reload after the round-trip is
consistent.

## An organisation already in use (2026-10-09)

One Xero organisation belongs to one company, so a connect that picks one already in use is
refused — including when the person's **own** other company holds it, which until 2026-10-09
connected anyway and silently unlinked that company (the wizard showed a plain success, and
the other company lost Xero with nobody told).

A `conflict` return raises a dialog rather than a toast, because the way on is a real
disconnect of another company and that has to be asked for. It is minty-web's
`ConfirmDialog` as this app draws it (`.mw-dialog*` in `app/globals.css`), Minty's picture
beside the title included — `public/assets/minty-dont.png`, the same art and the same
100×130 as the Entity & Integration tab's, since the two dialogs say the same thing. `conflict_entity_id` and
`conflict_can_move=1` are what make the offer possible; without them (no permission there, or
Minty could not say) the dialog only names the company to ask, with one *Close*.

*Move it here* does it in two steps, since the grant the refused attempt created was handed
back to Xero and there is no token left to reuse:

1. `POST /api/onboarding/xero/release` with the **other** company's `entity_id` — Minty
   authorizes `XERO_SETTINGS_UPDATE` on that company and leaves it `disconnected` (not
   `onboarding`, which `xero/disconnect` would, and which is wrong for a live company);
2. then `connectXero()` again, straight back through Xero's consent screen for this company.

A refusal is shown in the dialog and it stays open to retry — the success case leaves the
page, so a toast would not outlive it. *Go back* and Escape change nothing.
`e2e/xero.spec.ts` covers all four outcomes (no offer, go back, the move, a refused release).

## Disconnecting

*Disconnect* posts `POST /api/onboarding/xero/disconnect` (proxied to Minty, which
revokes the connection at Xero and clears the token state); the company stays in
`onboarding` and is still resumable. Steps 6–8 need a connected organisation — their
endpoints (`account-codes`, `contacts`, `bill-codes`) answer 409 without one.

## In the browser tests

No test can walk login.xero.com, so `e2e/xeroFake.ts` fakes Xero **at the network layer**
with `page.route()`, and only the four things the wizard depends on: the navigation to
`/xero_connect` is answered with the redirect Minty would send; `/state` is fetched for
real and only its `xero` (and `modules`) overwritten; the four Xero-backed endpoints get
fixtures (`e2e/fixtures/xero.ts`); `payment-method` on All Set answers "no card, no
consent". The fake is stateful (`connected` flips on connect and disconnect) and keeps
every body the wizard posted so a spec can assert on it. `e2e/xero.spec.ts` covers the
three returns, disconnecting, and resuming past step 4 without a connection (sent back to
Connect); `walk.spec.ts` uses the fake to reach All Set. Everything not listed reaches the
real stack.
