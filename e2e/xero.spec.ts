// Step 4, "Connect to Accounting System", with the Xero round-trip faked at the browser.
//
// See e2e/xeroFake.ts for what is faked and why it is safe to trust: the wizard's whole
// dependency on Xero is one redirect out, three query parameters back, and one boolean
// in /state. Everything under test here -- stashing progress before leaving, restoring
// it on return, reading the outcome off the URL, stripping it, gating Save & Next,
// re-checking the backend on every landing -- is the wizard's own code, running
// unchanged against those same inputs.
//
// WHAT THIS SPEC WRITES
//
// `land()` pins saved_step on E2E_ENTITY_ID before every navigation and afterEach puts
// the original back. Nothing here reaches step 9, so nothing here finalizes.

import { expect, test, type Page } from '@playwright/test';
import { FAKE_ORG } from './fixtures/xero';
import { reachable, requireCredentials, type Credentials } from './helpers';
import {
  activeStep,
  land,
  restoreSavedStep,
  stashSavedStep,
} from './onboardingApi';
import { ONBOARDING_API_URL } from './urls';
import { installXeroFake, type XeroFake } from './xeroFake';

/** The key the wizard stashes its progress under while the tab is away at Xero. */
const XERO_RESUME_KEY = 'minty_onboarding_xero_resume';

let creds: Credentials;
let fake: XeroFake;
let originalStep: number | null;

test.beforeEach(async ({ page, request }) => {
  creds = requireCredentials();
  test.skip(
    !(await reachable(`${ONBOARDING_API_URL}/api/onboarding/server-time`)),
    `The onboarding service is not answering on ${ONBOARDING_API_URL}`,
  );
  fake = await installXeroFake(page);
  originalStep = await stashSavedStep(request, creds);
});

test.afterEach(async ({ request }) => {
  // Also runs after a beforeEach skip, when there are no credentials to restore with.
  if (!creds) return;
  await restoreSavedStep(request, creds, originalStep);
});

const status = (page: Page) => page.locator('.status-card .pill-status');
const saveNext = (page: Page) => page.getByRole('button', { name: /Save & Next/ });
const connect = (page: Page) => page.getByRole('button', { name: 'Connect to Xero' });
// The error toast. Next's route announcer is a role="alert" too, so filter to the one with copy.
const errorToast = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ });

test('connecting round-trips through Xero and comes back connected on step 4', async ({
  page,
  request,
}) => {
  await land(page, request, creds, 4);
  await expect(status(page)).toHaveText('Not connected');
  await expect(saveNext(page)).toBeDisabled();

  await connect(page).click();

  // The tab left for Flask, was bounced straight back with ?xero=connected, and the
  // wizard rebuilt itself from the stash it made before leaving.
  await expect(status(page)).toHaveText('Connected');
  await expect(page.locator('.status-meta')).toContainText(`Xero Entity: ${FAKE_ORG}`);
  expect(await activeStep(page)).toBe(4);
  await expect(saveNext(page)).toBeEnabled();
  expect(fake.connected).toBe(true);

  // The outcome params are consumed, not left for a refresh to replay.
  const params = new URL(page.url()).searchParams;
  expect(params.has('xero')).toBe(false);
  expect(params.has('org')).toBe(false);
  // And so is the stash.
  expect(await page.evaluate((k) => window.sessionStorage.getItem(k), XERO_RESUME_KEY)).toBeNull();
});

test('a wrong-account return names the email to sign in with and stays disconnected', async ({
  page,
  request,
}) => {
  fake.setOutcome({ kind: 'mismatch', expected: 'owner@example.com' });
  await land(page, request, creds, 4);

  await connect(page).click();

  await expect(errorToast(page)).toContainText('owner@example.com');
  await expect(status(page)).toHaveText('Not connected');
  await expect(saveNext(page)).toBeDisabled();
  expect(fake.connected).toBe(false);
});

// An org already in use blocks the connect and ASKS what to do about it: freeing it is a
// real disconnect of another company, so nothing happens until the person says so. Before
// 2026-10-09 this case connected anyway and silently unlinked the other company.
test('an org already linked elsewhere asks in a dialog, and leaves the step disconnected', async ({
  page,
  request,
}) => {
  fake.setOutcome({ kind: 'conflict', conflictEntity: 'Another Entity Ltd' });
  await land(page, request, creds, 4);

  await connect(page).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('That Xero organisation is taken');
  await expect(dialog).toContainText('Another Entity Ltd');
  // No id/permission came back, so there is nothing to offer - only who to ask.
  await expect(dialog).toContainText('Ask an accountant or admin');
  await expect(dialog.getByRole('button', { name: 'Move it here' })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(status(page)).toHaveText('Not connected');
  await expect(saveNext(page)).toBeDisabled();
  expect(fake.connected).toBe(false);
  expect(fake.posted['xero/release']).toBeUndefined();
});

test('Go back on the conflict dialog moves nothing', async ({ page, request }) => {
  fake.setOutcome({
    kind: 'conflict',
    conflictEntity: 'Another Entity Ltd',
    conflictEntityId: 'e-other',
    conflictCanMove: true,
  });
  await land(page, request, creds, 4);

  await connect(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Go back' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(status(page)).toHaveText('Not connected');
  expect(fake.posted['xero/release']).toBeUndefined();
});

test('Move it here frees the other company, then connects this one', async ({ page, request }) => {
  fake.setOutcome({
    kind: 'conflict',
    conflictEntity: 'Another Entity Ltd',
    conflictEntityId: 'e-other',
    conflictCanMove: true,
  });
  await land(page, request, creds, 4);

  await connect(page).click();
  // The second trip through Xero succeeds: the organisation is free now.
  fake.setOutcome({ kind: 'connected' });
  await page.getByRole('dialog').getByRole('button', { name: 'Move it here' }).click();

  await expect(status(page)).toHaveText('Connected');
  await expect(saveNext(page)).toBeEnabled();
  // The company freed is the OTHER one, never the one being onboarded.
  expect(fake.posted['xero/release']).toEqual([{ entity_id: 'e-other' }]);
  expect(fake.connected).toBe(true);
});

test('a refused release stays in the dialog, so it can be tried again', async ({
  page,
  request,
}) => {
  fake.setOutcome({
    kind: 'conflict',
    conflictEntity: 'Another Entity Ltd',
    conflictEntityId: 'e-other',
    conflictCanMove: true,
  });
  fake.setReleaseFails(true);
  await land(page, request, creds, 4);

  await connect(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Move it here' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Xero would not let go of that one.');
  await expect(dialog.getByRole('button', { name: 'Move it here' })).toBeEnabled();
  await expect(status(page)).toHaveText('Not connected');
  expect(fake.connected).toBe(false);
});

test('disconnecting asks the backend and returns the step to Not connected', async ({
  page,
  request,
}) => {
  await land(page, request, creds, 4);
  await connect(page).click();
  await expect(status(page)).toHaveText('Connected');

  await page.getByRole('button', { name: 'Disconnect from Xero' }).click();

  await expect(status(page)).toHaveText('Not connected');
  await expect(saveNext(page)).toBeDisabled();
  expect(fake.connected).toBe(false);
  expect(fake.posted['xero/disconnect']).toEqual([{ entity_id: creds.entityId }]);
});

test('resuming past step 4 without a connection is sent back to Connect', async ({
  page,
  request,
}) => {
  // The row says step 6 but the backend says no Xero org: the wizard keeps the place
  // and raises the prompt, and the prompt's only button goes to step 4.
  fake.setConnected(false);
  await land(page, request, creds, 6);

  const prompt = page.locator('.skip-modal[role="dialog"]');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Connect to your accounting system first.');

  await prompt.getByRole('button', { name: 'Go to Connect step' }).click();

  await expect(prompt).toBeHidden();
  expect(await activeStep(page)).toBe(4);
  await expect(status(page)).toHaveText('Not connected');
});
