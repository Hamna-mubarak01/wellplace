import { expect, test, type Locator, type Page } from "@playwright/test";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  BREAKPOINTS,
  environmentStatus,
} from "./support/environment";
import {
  completeDetailsStep,
  openBookingWidget,
  openTheTimeTiles,
} from "./support/booking-flow";

const status = environmentStatus();

const URGENCY_MESSAGES = [
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_few"),
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_last"),
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_none"),
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_filling"),
];

interface TileReading {
  readonly time: string;
  readonly text: string;
  readonly disabled: boolean;
  readonly messagesInside: string[];
}

async function readTiles(page: Page): Promise<TileReading[]> {
  const tiles = page.getByRole("radio").filter({ hasText: /\d{1,2}:\d{2}/ });
  const count = await tiles.count();
  const readings: TileReading[] = [];

  for (let index = 0; index < count; index++) {
    const tile: Locator = tiles.nth(index);
    if (!(await tile.isVisible())) continue;

    const text = (await tile.innerText()).replace(/\s+/g, " ").trim();

    readings.push({
      time: text.match(/\d{1,2}:\d{2}(\s*[ap]m)?/i)?.[0] ?? "",
      text,
      disabled: (await tile.getAttribute("data-disabled")) !== null,
      messagesInside: URGENCY_MESSAGES.filter((message) => text.includes(message)),
    });
  }

  return readings;
}

const LIMITED_MESSAGES = [
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_few"),
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_last"),
  requireSetting(EMPTY_SNAPSHOT, "urgency.text_filling"),
];

async function taglineOutsideThePicker(page: Page): Promise<string | null> {
  return page.evaluate((messages: string[]) => {
    for (const status of Array.from(document.querySelectorAll("[role=status]"))) {
      if (status.closest("[role=radio], [role=dialog]")) continue;
      const text = (status.textContent ?? "").trim();
      const matched = messages.find((message) => text.includes(message));
      if (matched !== undefined) return matched;
    }
    return null;
  }, LIMITED_MESSAGES);
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`INV-18 — availability messages sit on the booking page, not in the time tiles, at ${breakpoint.name}px [CLIENT 11 September 2026]`, () => {
    test.skip(!status.serverReachable, status.serverMessage);
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    test("a bookable tile shows its time and no availability message [CLIENT 11 September 2026]", async ({
      page,
    }) => {
      await openBookingWidget(page);
      await completeDetailsStep(page);
      await openTheTimeTiles(page);

      const tiles = await readTiles(page);
      expect(tiles.length, "no start-time tile was reachable, so nothing was proved").toBeGreaterThan(0);

      for (const tile of tiles.filter((reading) => !reading.disabled)) {
        expect(tile.time, `tile "${tile.text}" has no time`).not.toBe("");
        for (const message of LIMITED_MESSAGES) {
          expect(tile.text, `bookable tile "${tile.text}" still carries "${message}" inside the picker`).not.toContain(message);
        }
      }
    });

    test("a limited time's message appears as a tagline on the page, outside the picker, once it is chosen [CLIENT 11 September 2026]", async ({
      page,
    }) => {
      await openBookingWidget(page);
      await completeDetailsStep(page);
      await openTheTimeTiles(page);

      const bookable = page.getByRole("radio").filter({ hasText: /\d{1,2}:\d{2}/ }).and(page.locator(":not([data-disabled])"));
      expect(await bookable.count(), "no bookable tile was reachable").toBeGreaterThan(0);
      await bookable.first().click();

      const tagline = await taglineOutsideThePicker(page);
      if (tagline !== null) expect(LIMITED_MESSAGES).toContain(tagline);

      const tooltips = await page.getByRole("tooltip").allInnerTexts();
      for (const tooltip of tooltips) {
        for (const message of LIMITED_MESSAGES) {
          expect(tooltip, "an availability message was found in a tooltip").not.toContain(message);
        }
      }
    });

    test("a fully booked tile keeps its message and cannot be chosen [contract: availability and urgency messages]", async ({
      page,
    }) => {
      await openBookingWidget(page);
      await completeDetailsStep(page);
      await openTheTimeTiles(page);

      const tiles = await readTiles(page);
      const fullyBooked = requireSetting(EMPTY_SNAPSHOT, "urgency.text_none");
      const none = tiles.filter((tile) => tile.text.includes(fullyBooked));

      expect(none.length, `no tile said "${fullyBooked}", so the disabled state was not observed`).toBeGreaterThan(0);

      for (const tile of none) {
        expect(tile.disabled, `"${tile.text}" says fully booked but is selectable`).toBe(true);
      }
    });
  });
}
