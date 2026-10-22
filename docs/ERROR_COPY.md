# Error copy

How a failure becomes something a user can read. The copy standard is shared
across Minty, minty-payment-request-api, minty-payment-request-web and minty-onboarding-web; the canonical
write-up lives in the Minty repo as `docs/features/ERROR_MESSAGE_LEAKS.md`.

## The standard

> `I couldn't <do the specific thing>. <Short next step>?`

1. Under two sentences.
2. First person -- not `Error:`, not `Failed to`.
3. Name the specific thing. This app is good at that already -- keep it:
   `Oh, "Acme Ltd" is taken already! Do you have another name in mind?`
4. Warm close, no blame. Drop the apology when retrying won't help and state the
   requirement instead: `I'll need a starting balance here.`
5. No codes, stack text or HTTP statuses in the visible string.
6. Sentence case, no `Error:` prefix, no exclamation marks on failures.

House fallback: `Something went wrong on my end. Mind trying again?`

## The mechanism

This app talks to **two** backends: the Minty Flask app (`PETTY_CASH_URL`)
for auth, legal and the Xero hand-off, and the extracted onboarding service
(`ONBOARDING_API_URL`) for `/api/onboarding/*`. Which one answers a given path
is decided in `lib/apiRoutes.ts`. Both speak the same `{error}` shape, so the copy rules
below are unchanged -- and the onboarding service deliberately uses `error` rather than
Django's conventional `detail` for exactly that reason.

There is one wrapper (`lib/billing.ts`) and ~26 hand-rolled `fetch` calls, so
`@minty/shared/errorCopy` is the shared seam instead (this app's `lib/errorCopy.ts` until
2026-10-21; one module in every app since):

```js
import { friendlyError } from '@minty/shared/errorCopy';

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  return { ok: false, error: friendlyError(data, "I couldn't save that. Mind trying again?") };
}
```

- **`friendlyError(data, fallback)`** reads Flask's `{error}`, then Django's
  `{detail}`, then the auth endpoints' `{message}` - the first that holds text is
  judged - and hands it to `errorCopy`.
- **`errorCopy(message, fallback)`** returns the server's words only when they
  read as a sentence. It refuses network/parser text (`Failed to fetch`,
  `Unexpected token '<'`), bare machine codes (`invalid_state`), single words in
  any case (`Forbidden`, `INVALID_STATE`), markup and braces, HTTP statuses
  (`HTTP 502`, `http500`), bare reason phrases (`Bad Gateway`), and anything over
  200 characters. A list or a field-error map (`{"email": ["…"]}`) is flattened to
  its sentences first.

Always pass the specific fallback **into** `friendlyError` rather than writing
`friendlyError(data, '') || "..."` -- the helper already falls back, so the
trailing `||` would be unreachable.

## Two habits worth keeping

- **Don't assert a cause you don't know.** The `catch` blocks used to say
  "My connection timed out" for every failure, including CORS rejections, DNS
  failures and malformed JSON. They are cause-neutral now.
- **Always give a fallback.** Two 429 handlers in `app/auth/confirm/page.tsx` (moved to minty-web's `/login/confirm`, 2026-10-05)
  did `if (data.message) setError(data.message)`, so a silent server response
  left the banner blank.

## Deliberate exception

`components/BillingSheet.tsx` shows Stripe.js `error.message` verbatim -- it is
the only account of what the card issuer said, and it is written for
cardholders. See the comment there.
