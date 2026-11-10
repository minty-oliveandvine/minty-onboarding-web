// Accounting Setup (step 4, Xero optional; Figma 348:1007) on a phone: 4.1 -> 4.2 -> 4.3 at 360px,
// against the real onboarding service. It chooses "Use Minty independently" on the disposable
// entity, answers the business questions, adds a sales account and takes it out again, and checks
// nothing is wider than the screen on the way. Afterwards the entity is put back on Xero (the
// other specs need step 4 to open on Connect to Xero) with no account of its own left.

import { expect, test, type Page } from "@playwright/test";
import { requireCredentials, type Credentials } from "./helpers";
import { chooseMode, land, restoreSavedStep, stashSavedStep } from "./onboardingApi";
import { ONBOARDING_API_URL } from "./urls";

let creds: Credentials;
let originalStep: number | null = null;
const NAME = `E2E sales ${Date.now().toString(36)}`;

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeEach(async ({ request }) => {
  creds = requireCredentials();
  originalStep = await stashSavedStep(request, creds);
});

test.afterEach(async ({ request }) => {
  if (!creds) return;
  // Take out anything this spec added, then hand the entity back to the Xero path.
  const headers = { Authorization: `Bearer ${creds.token}` };
  const res = await request.get(
    `${ONBOARDING_API_URL}/api/onboarding/accounting?entity_id=${creds.entityId}`,
    {
      headers,
    },
  );
  if (res.ok()) {
    const body = await res.json();
    for (const a of [...body.accounts.sales, ...body.accounts.expense]) {
      if (String(a.name).startsWith("E2E sales")) {
        await request.delete(
          `${ONBOARDING_API_URL}/api/onboarding/accounting/accounts/${a.id}?entity_id=${creds.entityId}`,
          { headers },
        );
      }
    }
  }
  await chooseMode(request, creds, "xero");
  await restoreSavedStep(request, creds, originalStep);
});

test("a phone walks Minty-on-its-own through 4.1, 4.2 and 4.3", async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await land(page, request, creds, 4); // opens on Connect to Xero (land chooses Xero)
  await page.getByRole("button", { name: /Back/ }).first().click();

  await expect(page.getByText("How would you like Minty to work?")).toBeVisible();
  expect(await pageOverflow(page), "4.1").toBeLessThanOrEqual(0);
  await page.getByRole("radio", { name: /Use Minty independently/ }).click();
  await page.getByRole("button", { name: /Save & Next/ }).click();

  await expect(page.getByText("What best describes your business?")).toBeVisible();
  expect(await pageOverflow(page), "4.2").toBeLessThanOrEqual(0);
  await page.getByRole("radio", { name: /Retail shop/ }).click();
  await page.getByRole("radio", { name: /Not sure/ }).click();
  await page.getByRole("button", { name: /Save & Next/ }).click();

  await expect(page.getByText("Your sales categories")).toBeVisible();
  await page.getByRole("button", { name: /Add another sales category/ }).click();
  expect(await pageOverflow(page), "4.3 add form").toBeLessThanOrEqual(0);
  await page.getByLabel(/^Name/).fill(NAME);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.locator(".acs-coa-row", { hasText: NAME });
  await expect(row).toBeVisible();
  await row.locator(".acs-coa-check").click(); // the tick circle; the row goes once the server has taken it out
  await expect(row).toHaveCount(0);

  const state = await (
    await request.get(`${ONBOARDING_API_URL}/api/onboarding/state?entity_id=${creds.entityId}`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    })
  ).json();
  expect(state.accounting).toMatchObject({
    mode: "minty",
    business_type: "retail",
    uses_sales_cash: true,
  });
});
