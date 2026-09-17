import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  RECEPTION_TABLET,
  STORAGE_STATE_FILE,
  environmentStatus,
} from "./support/environment";

const status = environmentStatus();

const SUITE_LABEL = /^Suite\s+\d+$/;

async function timelineBox(page: Page): Promise<Locator> {
  const box = page.locator("div.overflow-x-auto").filter({
    has: page.getByText(SUITE_LABEL).first(),
  });

  await expect(
    box.first(),
    "no horizontally scrollable box contains the suite lanes",
  ).toBeVisible({ timeout: 30_000 });

  return box.first();
}

async function pageScrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return (
      root.scrollWidth > root.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth
    );
  });
}

const VIEWS = [
  { name: "the day board", url: "/reception/board?view=day" },
  { name: "the wide timeline", url: "/reception/board?view=timeline" },
  { name: "the Today overview", url: "/reception" },
];

test.describe("SYSTEM.md 9.8 — the seven-suite timeline at 1024×768, the Reception tablet [§9.1]", () => {
  test.skip(!status.serverReachable, status.serverMessage);
  test.skip(!status.signedIn, status.sessionMessage);
  test.use({
    storageState: STORAGE_STATE_FILE,
    viewport: { width: RECEPTION_TABLET.width, height: RECEPTION_TABLET.height },
  });

  for (const view of VIEWS) {
    test(`${view.name} never makes the page itself scroll sideways`, async ({
      page,
    }) => {
      await page.goto(view.url, { waitUntil: "load" });
      await expect(page.locator("main")).toBeVisible();

      expect(
        await pageScrollsSideways(page),
        "the whole console page scrolls sideways at 1024px, so the sticky suite column " +
          "and every other chrome element leaves the screen with it",
      ).toBe(false);
    });
  }

  test("keeps the timeline's own box as the only thing that scrolls sideways", async ({
    page,
  }) => {
    await page.goto("/reception/board?view=timeline", { waitUntil: "load" });

    const box = await timelineBox(page);

    const overflow = await box.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));

    expect(
      overflow.scrollWidth,
      "the wide timeline does not overflow its box at 1024px, so nothing was proved " +
        "about scrolling — check the opening hours the board is drawing",
    ).toBeGreaterThan(overflow.clientWidth);

    expect(overflow.overflowX).toBe("auto");
    expect(await pageScrollsSideways(page)).toBe(false);
  });

  test("holds the suite column still while the hours scroll under it", async ({
    page,
  }) => {
    await page.goto("/reception/board?view=timeline", { waitUntil: "load" });

    const box = await timelineBox(page);
    const suiteLabel = page.getByText(SUITE_LABEL).first();

    await expect(suiteLabel).toBeVisible();

    const before = await suiteLabel.boundingBox();
    const scrolledBy = await box.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });

    expect(
      scrolledBy,
      "the timeline box did not move, so the sticky assertion below is vacuous",
    ).toBeGreaterThan(0);

    const after = await suiteLabel.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(
      Math.round(after!.x),
      "the suite column scrolled away with the hours; it must stay pinned to the left",
    ).toBe(Math.round(before!.x));

    await expect(suiteLabel).toBeInViewport();
    expect(await pageScrollsSideways(page)).toBe(false);
  });

  test("shows every one of the venue's suites as its own lane", async ({ page }) => {
    await page.goto("/reception/board?view=timeline", { waitUntil: "load" });
    await timelineBox(page);

    const lanes = await page.getByText(SUITE_LABEL).allInnerTexts();
    const numbers = lanes
      .map((label) => Number(label.replace(/\D+/g, "")))
      .filter((value) => Number.isFinite(value));

    expect(numbers.length, "the timeline drew no suite lanes").toBeGreaterThan(0);
    expect(new Set(numbers).size, "a suite lane is drawn twice").toBe(numbers.length);
  });
});
