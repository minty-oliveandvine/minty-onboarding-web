// lib/billing -- the billing sheet's wire half. `call()` is private, so it is pinned
// through the exported wrappers, with fetch stubbed.
//
// This app's call() THROWS a BillingError; it does not return an { ok, error } bag (that
// convention is OnboardingApp's submit functions, not this module).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOUSE_FALLBACK } from '@minty/shared/errorCopy';

const DJANGO = 'https://django.example';

async function load() {
  vi.resetModules();
  vi.stubEnv('PETTY_CASH_URL', 'https://flask.example');
  vi.stubEnv('ONBOARDING_API_URL', DJANGO);
  return import('../billing');
}

function respond(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return Promise.resolve(new Response(text, { status }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllEnvs();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function caught(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as { name: string; message: string; status: number };
  }
  throw new Error('expected a rejection');
}

describe('billing call()', () => {
  // Pins billing.ts's call() result and error shapes before it moves to @minty/shared (the
  // shared-code refactor, 2026-10-21).

  it('with no token throws a 401 "session expired" without calling fetch', async () => {
    const { fetchBillingAccounts, BillingError } = await load();
    for (const token of [null, undefined, '']) {
      const err = await caught(fetchBillingAccounts(token));
      expect(err).toBeInstanceOf(BillingError);
      expect(err.name).toBe('BillingError');
      expect(err.message).toBe('Your session expired. Sign in again to keep going.');
      expect(err.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GETs with only the bearer header, routed to the onboarding API', async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(200, { accounts: [], methods: [] }));
    await expect(fetchBillingAccounts('tok')).resolves.toEqual({ accounts: [], methods: [] });
    expect(fetchMock).toHaveBeenCalledWith(DJANGO + '/api/onboarding/billing/accounts', {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('encodes the entity id into the payment-method query', async () => {
    const { fetchBillingStatus } = await load();
    fetchMock.mockReturnValue(respond(200, { has_payment_method: false }));
    await fetchBillingStatus('tok', 'a b&c');
    expect(fetchMock.mock.calls[0][0]).toBe(
      DJANGO + '/api/onboarding/payment-method?entity_id=a%20b%26c',
    );
  });

  it('POSTs a JSON body with Content-Type only when there is a body', async () => {
    const { authorizeBilling, startCardSetup } = await load();
    fetchMock.mockImplementation(() => respond(200, {}));
    await authorizeBilling('tok', 'ent-1', 'pm_1');
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: 'ent-1', payment_method: 'pm_1' }),
    });
    await authorizeBilling('tok', 'ent-1', null);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ entity_id: 'ent-1' }));
    await startCardSetup('tok');
    expect(fetchMock.mock.calls[2][1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('confirmCardSetup sends make_default as a boolean and only the account fields given', async () => {
    const { confirmCardSetup } = await load();
    fetchMock.mockImplementation(() => respond(200, {}));
    await confirmCardSetup('tok', 'seti_1', true, { billingGroupId: 'bg-1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      setup_intent: 'seti_1',
      make_default: true,
      billing_group_id: 'bg-1',
    });
    // Empty strings are sent for email/company (!= null), but an empty group id is not.
    await confirmCardSetup('tok', 'seti_1', false, { billingGroupId: '', email: '', company: '' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      setup_intent: 'seti_1',
      make_default: false,
      billing_email: '',
      billing_company: '',
    });
    await confirmCardSetup('tok', 'seti_1', false);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      setup_intent: 'seti_1',
      make_default: false,
    });
  });

  it('a network failure throws status 0 with its own wording', async () => {
    const { fetchBillingAccounts, BillingError } = await load();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await caught(fetchBillingAccounts('tok'));
    expect(err).toBeInstanceOf(BillingError);
    expect(err.message).toBe("I couldn't reach the server. Mind trying again?");
    expect(err.status).toBe(0);
  });

  it("a refused call shows the server's `error` sentence with the HTTP status", async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(422, { error: 'Choose a billing account for this card.' }));
    const err = await caught(fetchBillingAccounts('tok'));
    expect(err.message).toBe('Choose a billing account for this card.');
    expect(err.status).toBe(422);
    expect(console.warn).toHaveBeenCalledWith(
      'billing call failed',
      '/api/onboarding/billing/accounts',
      422,
    );
  });

  it('ignores `message` on a refused call: only `error` is read', async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(400, { message: 'A perfectly good sentence.' }));
    const err = await caught(fetchBillingAccounts('tok'));
    expect(err.message).toBe(HOUSE_FALLBACK);
    expect(err.status).toBe(400);
  });

  it('falls back to the house copy for machinery or a non-JSON body', async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(500, { error: 'invalid_state' }));
    expect((await caught(fetchBillingAccounts('tok'))).message).toBe(HOUSE_FALLBACK);
    fetchMock.mockReturnValue(respond(502, '<html>Bad gateway</html>'));
    const err = await caught(fetchBillingAccounts('tok'));
    expect(err.message).toBe(HOUSE_FALLBACK);
    expect(err.status).toBe(502);
  });

  it('a 401 from the server is NOT the "session expired" copy', async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(401, {}));
    const err = await caught(fetchBillingAccounts('tok'));
    expect(err.message).toBe(HOUSE_FALLBACK);
    expect(err.status).toBe(401);
  });

  it('a 2xx with a non-JSON body resolves to {} rather than throwing', async () => {
    const { fetchBillingAccounts } = await load();
    fetchMock.mockReturnValue(respond(200, 'not json'));
    await expect(fetchBillingAccounts('tok')).resolves.toEqual({});
  });

  it('a 2xx body carrying `error` still resolves (only res.ok decides)', async () => {
    const { authorizeBilling } = await load();
    fetchMock.mockReturnValue(respond(200, { error: 'Something odd.' }));
    await expect(authorizeBilling('tok', 'ent-1')).resolves.toEqual({ error: 'Something odd.' });
  });
});
