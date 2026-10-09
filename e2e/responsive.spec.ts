// Nothing is wider than the screen on the Accounting step, at 360 / 768 / 1440.
//
// THE ONLY SPEC HERE THAT NEEDS NO CREDENTIALS. The wizard reads its Xero outcome off the
// address (`?xero=…`), and it does that whatever the auth state, so the step and its refused-
// connect dialog can both be drawn standalone - no entity, no token, no onboarding service.
// That matters: the other four specs skip without E2E_JWT_SECRET/E2E_USER_ID/E2E_ENTITY_ID,
// so on a machine (or a CI job) without them this file is the only browser coverage running.
//
// What it pins, all found by measuring rather than by eye (2026-10-09):
//   * the heading's info tooltip is `opacity: 0`, never `display: none` - it sits in the
//     layout at all times, so a centred 360px-wide popup on an icon near the right edge put
//     137px of the page off-screen at 360px, scrollable sideways, with nothing to see.
//   * [Back] [Save & Exit] [Save & Next] and the "…to continue" reminder were one unwrapping
//     row, 30px wider than a 360px phone.
// Both are CSS-only (`app/globals.css`), and only a real browser can catch either: jsdom
// measures nothing, so a unit test here would be vacuous.

import { expect, test, type Page } from '@playwright/test';
import { reachable } from './helpers';
import { BASE_URL } from './urls';

/** The Accounting step, standalone. `cancelled` is the "came back with nothing" return. */
const STEP_4 = '/?xero=cancelled&step=3';
/** The same step with the refused-connect dialog up, and a company it may offer to free. */
const REFUSED =
  '/?xero=conflict&conflict_entity=A%20Company%20With%20A%20Fairly%20Long%20Name&conflict_entity_id=e-x&conflict_can_move=1&step=3';

const WIDTHS = [360, 768, 1440] as const;

/** How far the page can be scrolled sideways. Anything above 0 is a horizontal scrollbar. */
const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeEach(async () => {
  test.skip(!(await reachable(BASE_URL)), `The wizard is not answering on ${BASE_URL}`);
});

for (const width of WIDTHS) {
  test(`the Accounting step fits the screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(STEP_4);
    await expect(page.locator('.status-card .pill-status')).toBeVisible();

    expect(await pageOverflow(page), 'step 4 at rest').toBeLessThanOrEqual(0);

    // The tooltip is in the layout whether or not it is shown, so check it both ways - and
    // opened, because that is when its box is the one a person can actually run into.
    const tip = page.locator('.info-tip').first();
    await tip.hover();
    const pop = page.locator('.info-tip-pop').first();
    await expect(pop).toHaveCSS('opacity', '1');

    const box = await pop.boundingBox();
    expect(box, 'the tooltip has a box').not.toBeNull();
    expect(box!.x, 'tooltip left edge is on screen').toBeGreaterThanOrEqual(-0.5);
    expect(box!.x + box!.width, 'tooltip right edge is on screen').toBeLessThanOrEqual(width + 0.5);
    // Clamping it must not shrink it to a column of single words.
    expect(box!.width, 'the tooltip is still readable').toBeGreaterThan(120);
    expect(await pageOverflow(page), 'step 4 with the tooltip open').toBeLessThanOrEqual(0);
  });

  test(`the refused-connect dialog fits the screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(REFUSED);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Minty sits beside the title, as minty-web's ConfirmDialog draws her.
    await expect(dialog.locator('img.mw-dialog-figure')).toBeVisible();
    // Both answers are reachable, and big enough to hit on a phone.
    for (const name of ['Go back', 'Move it here']) {
      const button = dialog.getByRole('button', { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box!.height, `"${name}" is a 44px target`).toBeGreaterThanOrEqual(44);
    }
    // A long company name must wrap inside the card, not push it wide.
    expect(await dialog.evaluate((e) => e.scrollWidth - e.clientWidth), 'inside the card').toBeLessThanOrEqual(0);
    expect(await pageOverflow(page), 'the page behind the dialog').toBeLessThanOrEqual(0);
  });
}
