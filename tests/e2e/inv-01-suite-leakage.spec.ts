import { expect, test } from "@playwright/test";

import {
  BREAKPOINTS,
  STORAGE_STATE_FILE,
  environmentStatus,
} from "./support/environment";

const status = environmentStatus();

const NEVER_IN_A_GUEST_RESPONSE: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  { name: "a suite id", pattern: /suite_id|suiteId/ },
  { name: "a suite number", pattern: /suite_number|suiteNumber/ },
  { name: "an occupancy row", pattern: /suite_occupancy|suiteOccupancy/ },
  { name: "a remaining-capacity count", pattern: /"remaining"\s*:/ },
  { name: "a suite capacity", pattern: /"?(suite|total|max)_?capacity"?\s*[:=]/i },
  { name: "a suite count", pattern: /"?(total|suite)_?(suites|count)"?\s*:\s*\d/i },
];

function offences(label: string, body: string): string[] {
  return NEVER_IN_A_GUEST_RESPONSE.filter(({ pattern }) => pattern.test(body)).map(
    ({ name, pattern }) =>
      `${label} carries ${name} — matched ${pattern} near ` +
      `"${body.slice(Math.max(0, body.search(pattern) - 60), body.search(pattern) + 60)}"`,
  );
}

test.describe("INV-01 — guests never see suite numbers or total capacity, not in the UI and not in the JSON [§3]", () => {
  test.skip(!status.serverReachable, status.serverMessage);

  test("the availability endpoint refuses a caller with no staff session [§13]", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/availability?date=2026-12-01&durationHours=2",
    );

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ status: "unauthorised" });
  });

  test("it refuses even a well-formed request for today, and says nothing else", async ({
    request,
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request.get(
      `/api/availability?date=${today}&durationHours=2&guestCount=2`,
    );

    expect(response.status()).toBe(401);
    expect(offences("the 401 body", await response.text())).toEqual([]);
  });

  test("it refuses before it validates, so an invalid query learns nothing either", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/availability?date=not-a-date&durationHours=nonsense",
    );

    expect(response.status()).toBe(401);
  });

  for (const breakpoint of BREAKPOINTS) {
    test(`the public booking page hands the browser no suite identifier at ${breakpoint.name}px`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height,
      });

      const found: string[] = [];

      page.on("response", async (response) => {
        const type = response.request().resourceType();
        if (type !== "document" && type !== "fetch" && type !== "xhr") return;

        const body = await response.text().catch(() => "");
        if (body === "") return;

        found.push(...offences(`${type} ${response.url()}`, body));
      });

      await page.goto("/book", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      expect(found).toEqual([]);
    });
  }

  test("the rendered booking page never prints the word Suite beside a number", async ({
    page,
  }) => {
    await page.goto("/book", { waitUntil: "domcontentloaded" });

    const text = await page.locator("body").innerText();

    expect(text).not.toMatch(/suite\s*#?\s*\d/i);
    expect(text).not.toMatch(/\d+\s+suites\b/i);
  });

  test("a guest reading the served markup cannot count the suites from an alt attribute [§3]", async ({
    page,
  }) => {
    await page.goto("/book", { waitUntil: "domcontentloaded" });

    const alts = await page.locator("img[alt]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("alt") ?? ""),
    );

    for (const alt of alts) {
      expect(alt, `alt text "${alt}"`).not.toMatch(/suite\s*#?\s*\d/i);
    }
  });
});

test.describe("INV-01 — with a staff session, the availability response still carries no suite [§3]", () => {
  test.skip(!status.serverReachable, status.serverMessage);
  test.skip(!status.signedIn, status.sessionMessage);
  test.use({ storageState: STORAGE_STATE_FILE });

  test("answers a signed-in caller with start times only, never a suite", async ({
    request,
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request.get(
      `/api/availability?date=${today}&durationHours=2`,
    );

    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      status: string;
      slots: Record<string, unknown>[];
    };

    expect(offences("the availability response", JSON.stringify(body))).toEqual([]);

    for (const slot of body.slots) {
      expect(Object.keys(slot).toSorted()).toEqual([
        "disabled",
        "kind",
        "label",
        "message",
        "startsAt",
      ]);
    }
  });
});
