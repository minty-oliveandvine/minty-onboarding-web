// Step 1's Phone Number at a phone's width: the dial-code picker beside the number, the length
// message, a pasted international number moving the picker, and the E.164 value that reaches
// the database and comes back on a cold resume.
//
// WHAT THIS SPEC WRITES
//
// The disposable entity's contact_phone (PUT /entity/{id}, through Save & Next) and its saved
// step. Both are put back afterwards: the phone through the same PUT, the step through
// restoreSavedStep. It lands on step 1 and leaves on step 2 -- never near step 9 (see
// e2e/onboardingApi.ts).

import { expect, test, type APIRequestContext } from "@playwright/test";
import { reachable, requireCredentials, type Credentials } from "./helpers";
import * as api from "./onboardingApi";
import { ONBOARDING_API_URL } from "./urls";

let creds: Credentials;

test.beforeEach(async () => {
  creds = requireCredentials();
  test.skip(
    !(await reachable(`${ONBOARDING_API_URL}/api/onboarding/server-time`)),
    `The onboarding service is not answering on ${ONBOARDING_API_URL}`,
  );
});

async function putPhone(request: APIRequestContext, phone: string) {
  const res = await request.put(`${ONBOARDING_API_URL}/api/onboarding/entity/${creds.entityId}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
    data: { contact_phone: phone },
  });
  expect(res.status(), `PUT contact_phone=${phone || '""'}`).toBe(200);
}

test("Phone Number: picker, length message, paste and resume at 360px", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const before = await api.readState(request, creds);
  const originalStep: number | null = before.saved_step ?? null;
  const originalPhone: string = before.entity?.phone ?? "";
  // The step-1 land below starts from no number, whatever an earlier run left.
  await putPhone(request, "");
  try {
    await api.land(page, request, creds, 1);
    const picker = page.getByLabel("Country code");
    const number = page.getByLabel("Phone Number");
    const save = page.getByRole("button", { name: "Save & Next" });

    // Follows the disposable company's saved Country (Hong Kong), shown short.
    await expect(picker).toHaveValue("HK +852");
    await expect(number).toHaveValue("");

    // Seven digits: the message waits for the blur, and Save stays off.
    await number.fill("9123 456");
    await expect(page.getByText("A +852 number has 8 digits.")).toHaveCount(0);
    await number.blur();
    await expect(page.getByText("A +852 number has 8 digits.")).toBeVisible();
    await expect(save).toBeDisabled();
    await number.fill("9123 4567");
    await expect(page.getByText("A +852 number has 8 digits.")).toHaveCount(0);
    await expect(save).toBeEnabled();

    // The picker searches by name and by code.
    await picker.click();
    await picker.fill("sing");
    await page.getByRole("option", { name: "Singapore +65" }).click();
    await expect(picker).toHaveValue("SG +65");
    await expect(number).toHaveValue("9123 4567");

    // A pasted international number moves the picker and keeps the national part.
    await number.fill("+44 07700 900123");
    await expect(picker).toHaveValue("GB +44");
    await expect(number).toHaveValue("07700900123");

    // Nothing overflows the phone's width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "horizontal overflow at 360px").toBeLessThanOrEqual(0);

    // Saved as E.164, the trunk 0 dropped.
    await save.click();
    await expect.poll(() => api.activeStep(page)).toBe(2);
    expect((await api.readState(request, creds)).entity.phone).toBe("+447700900123");

    // A cold resume splits the stored number back into the picker and the box.
    await page.evaluate(() => window.localStorage.clear());
    await api.land(page, request, creds, 1);
    await expect(page.getByLabel("Country code")).toHaveValue("GB +44");
    await expect(page.getByLabel("Phone Number")).toHaveValue("7700900123");
  } finally {
    await putPhone(request, originalPhone);
    await api.restoreSavedStep(request, creds, originalStep);
  }
});

test("a new company starts empty; choosing Hong Kong sets the currency and the phone's +852, and a short number cannot be saved", async ({
  page,
}) => {
  // fresh=1 starts a brand-new company; nothing here presses Save, so nothing is created.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/?token=${creds.token}&fresh=1`);
  const picker = page.getByLabel("Country code");
  const country = page.locator("#entity-country");
  const currency = page.locator("#entity-currency");
  // Empty, like the phone's code (owner, 2026-10-19): no Country, no Currency, no code.
  await expect(picker).toHaveValue("");
  await expect(picker).toHaveAttribute("placeholder", "Code");
  await expect(country).toHaveValue("");
  await expect(country).toHaveAttribute("placeholder", "Select a country");
  await expect(currency).toHaveValue("");
  await expect(currency).toHaveAttribute("placeholder", "Select a currency");

  // Choosing the Country fills the empty Currency with its own and moves the phone's code.
  await country.click();
  await country.fill("Hong Kong");
  await page.getByRole("option", { name: "Hong Kong SAR China" }).click();
  await expect(country).toHaveValue("Hong Kong SAR China");
  await expect(currency).toHaveValue("Hong Kong Dollar");
  await expect(picker).toHaveValue("HK +852");

  await page.getByPlaceholder("Please enter your company name").fill("Phone Gap Test");
  const save = page.getByRole("button", { name: "Save & Next" });
  await expect(save).toBeEnabled();
  await page.getByLabel("Phone Number").fill("123");
  await page.getByLabel("Phone Number").blur();
  await expect(page.getByText("A +852 number has 8 digits.")).toBeVisible();
  await expect(save).toBeDisabled();

  // No ninth digit: a paste is cut at eight, and a keystroke on a full number does nothing.
  const number = page.getByLabel("Phone Number");
  await number.fill("9123 45678");
  await expect(number).toHaveValue("9123 4567");
  await number.press("End");
  await number.pressSequentially("9");
  await expect(number).toHaveValue("9123 4567");
  await number.press("Home");
  await number.pressSequentially("5");
  await expect(number).toHaveValue("9123 4567");
  // Deleting still works.
  await number.press("End");
  await number.press("Backspace");
  await expect(number).toHaveValue("9123 456");
  await expect(save).toBeDisabled();
});
