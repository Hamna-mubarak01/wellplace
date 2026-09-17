import { expect, type Page } from "@playwright/test";

export const BOOKING_PREVIEW_URL = "/book?state=no-addons";

export async function openBookingWidget(page: Page): Promise<void> {
  await page.goto(BOOKING_PREVIEW_URL, { waitUntil: "domcontentloaded" });

  await expect(page.locator(".booking-loading-page")).toHaveCount(0, {
    timeout: 60_000,
  });

  await expect(page.getByRole("radiogroup", { name: "Title" })).toBeVisible({
    timeout: 30_000,
  });
}

async function chooseFromSelect(
  page: Page,
  trigger: string,
  option: string,
): Promise<void> {
  await page.getByRole("combobox", { name: trigger }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("combobox", { name: trigger })).toContainText(option);
}

export async function completeDetailsStep(page: Page): Promise<void> {
  await page.getByText("Mr.", { exact: true }).click();
  await page.fill("#book-first-name", "Test");
  await page.fill("#book-last-name", "Fixture");
  await page.fill("#book-email", "e2e.fixture@example.test");

  await chooseFromSelect(page, "Date of birth — day", "4");
  await chooseFromSelect(page, "Date of birth — month", "Jun");
  await chooseFromSelect(page, "Date of birth — year", "1990");

  await page.fill("#book-phone", "501234567");

  await page.getByRole("button", { name: "Continue to date and time" }).click();
}

export async function openTheTimeTiles(page: Page): Promise<void> {
  const days = page.getByRole("gridcell").locator("button:not([disabled])");
  await expect(days.first()).toBeVisible({ timeout: 30_000 });

  const count = await days.count();

  for (let index = 0; index < count; index++) {
    await days.nth(index).click();
    const tiles = page.getByRole("radio").filter({ hasText: /\d{1,2}:\d{2}/ });
    if ((await tiles.count()) > 0) return;
  }

  throw new Error(
    "No day in the booking calendar produced any start-time tile, so INV-18 " +
      "could not be observed. This is a finding about the page, not the test.",
  );
}
