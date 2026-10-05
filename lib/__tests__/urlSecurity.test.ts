// The URL security round (2026-10-05): the launch token leaves the address bar at once and
// lives in this tab's sessionStorage only; /auth hands /auth/confirm its details in storage,
// never in the URL.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('takeLaunchParams', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('reads the launch parameters and clears them from the address bar', async () => {
    window.history.replaceState(null, '', '/?token=abc.def.ghi&entity_id=e1&fresh=1&keep=1#top');
    const { takeLaunchParams } = await import('@/lib/wizardSession');

    const params = takeLaunchParams();

    expect(params.get('token')).toBe('abc.def.ghi');
    expect(params.get('entity_id')).toBe('e1');
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#top');
  });

  it('answers the same on a second call (StrictMode runs the init effect twice)', async () => {
    window.history.replaceState(null, '', '/?token=t1&xero=connected&org=Acme');
    const { takeLaunchParams } = await import('@/lib/wizardSession');

    takeLaunchParams();
    const again = takeLaunchParams();

    expect(again.get('token')).toBe('t1');
    expect(again.get('org')).toBe('Acme');
    expect(window.location.search).toBe('');
  });
});

describe('the tab token', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('is kept in sessionStorage, never localStorage', async () => {
    const { readTabToken, writeTabToken, TAB_TOKEN_KEY } = await import('@/lib/wizardSession');

    writeTabToken('tok');

    expect(readTabToken()).toBe('tok');
    expect(window.sessionStorage.getItem(TAB_TOKEN_KEY)).toBe('tok');
    expect(window.localStorage.length).toBe(0);
  });

  it('is not cleared by an empty write (the first render persists before the token is set)', async () => {
    const { readTabToken, writeTabToken } = await import('@/lib/wizardSession');

    writeTabToken('tok');
    writeTabToken('');

    expect(readTabToken()).toBe('tok');
  });
});

describe('the /auth -> /auth/confirm handover', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('round-trips through sessionStorage and is gone once cleared', async () => {
    const { saveConfirmContext, readConfirmContext, clearConfirmContext } = await import(
      '@/lib/authHandover'
    );
    const context = {
      email: 'a@b.test',
      invite: 'secret-invite',
      firstName: 'Ann',
      lastName: 'Bee',
      termsAccepted: true,
      termsVersion: 'beta-1',
    };

    expect(saveConfirmContext(context)).toBe(true);
    expect(readConfirmContext()).toEqual(context);

    clearConfirmContext();
    expect(readConfirmContext()).toBeNull();
  });

  it('refuses a handover without an email', async () => {
    const { readConfirmContext } = await import('@/lib/authHandover');
    window.sessionStorage.setItem('minty_auth_confirm', JSON.stringify({ invite: 'x' }));

    expect(readConfirmContext()).toBeNull();
  });
});
